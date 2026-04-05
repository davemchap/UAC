/**
 * Scorecard scheduler — runs daily at 6am MT (13:00 UTC), scores all zones
 * against all active personas, and persists results to scorecard_runs.
 */

import { getDb } from "../db";
import { scorecardRuns } from "../db/schema";
import { getAllPersonas } from "../persona-trainer";
import { scoreForecast, normalizeText, getLatestForecastsForScoring, getForecastsForScoringByDate } from "../scorecard";
import type { Persona, PersonaId } from "../scorecard";

// ---------------------------------------------------------------------------
// MT offset helpers
// ---------------------------------------------------------------------------

/** Mountain Time is UTC-7 (MST, no DST adjustment needed — runs at 6am MT). */
const MT_OFFSET_HOURS = 7;

/** Ms until next 6:00 AM MT from now. */
function msUntilNext6amMT(): number {
	const now = new Date();
	// Compute current MT time
	const nowUtcMs = now.getTime();
	const nowMtMs = nowUtcMs - MT_OFFSET_HOURS * 60 * 60 * 1000;
	const nowMt = new Date(nowMtMs);

	// Build next 6am MT as a UTC timestamp
	const next6amMt = new Date(nowMt);
	next6amMt.setUTCHours(6, 0, 0, 0);
	if (next6amMt.getTime() <= nowMt.getTime()) {
		// Already past 6am MT today — target tomorrow
		next6amMt.setUTCDate(next6amMt.getUTCDate() + 1);
	}
	// Convert back to real UTC
	const next6amUtcMs = next6amMt.getTime() + MT_OFFSET_HOURS * 60 * 60 * 1000;
	return Math.max(0, next6amUtcMs - nowUtcMs);
}

// ---------------------------------------------------------------------------
// Map DB PersonaRecord to scoring Persona
// ---------------------------------------------------------------------------

function toScoringPersona(r: Awaited<ReturnType<typeof getAllPersonas>>[number]): Persona {
	return {
		id: r.personaKey as PersonaId,
		name: r.name,
		role: r.role,
		color: r.color,
		literacyLevel: r.literacyLevel as Persona["literacyLevel"],
		unknownTerms: r.unknownTerms,
		maxSentenceLength: r.maxSentenceLength,
		maxGradeLevel: r.maxGradeLevel,
		successCriteria: r.successCriteria,
		tags: r.tags,
		travelMode: r.travelMode,
		yearsOfMountainExperience: r.yearsOfMountainExperience,
		avalancheTrainingLevel: r.avalancheTrainingLevel,
		backcountryDaysPerSeason: r.backcountryDaysPerSeason,
		weatherPatternRecognition: r.weatherPatternRecognition,
		terrainAssessmentSkill: r.terrainAssessmentSkill,
		riskTolerance: r.riskTolerance,
		groupDecisionTendency: r.groupDecisionTendency,
		localTerrainFamiliarity: r.localTerrainFamiliarity,
	};
}

// ---------------------------------------------------------------------------
// Comprehension level derived from persona score
// ---------------------------------------------------------------------------

function deriveComprehensionLevel(overall: number): string {
	if (overall >= 80) return "high";
	if (overall >= 60) return "moderate";
	if (overall >= 40) return "low";
	return "critical";
}

// ---------------------------------------------------------------------------
// Batch run
// ---------------------------------------------------------------------------

export async function runDailyScorecardBatch(): Promise<{ zonesScored: number; errors: string[] }> {
	console.log("[scorecard-scheduler] Starting daily batch run");

	const errors: string[] = [];
	let zonesScored = 0;

	// Load personas from DB; fall back to static defaults if unavailable
	let runtimePersonas: Persona[] | undefined;
	try {
		const records = await getAllPersonas();
		const active = records.filter((r) => r.active);
		runtimePersonas = active.length > 0 ? active.map(toScoringPersona) : undefined;
	} catch (err) {
		console.error("[scorecard-scheduler] Failed to load personas from DB, using static defaults:", err);
	}

	// Load latest forecasts per zone
	let forecasts: Awaited<ReturnType<typeof getLatestForecastsForScoring>>;
	try {
		forecasts = await getLatestForecastsForScoring();
	} catch (err) {
		const msg = `Failed to load forecasts: ${String(err)}`;
		console.error(`[scorecard-scheduler] ${msg}`);
		return { zonesScored: 0, errors: [msg] };
	}

	const db = getDb();

	for (const forecast of forecasts) {
		try {
			const bottomLine = normalizeText(forecast.bottomLine);
			const currentConditions = normalizeText(forecast.currentConditions);
			const problems = [forecast.avalancheProblem1, forecast.avalancheProblem2, forecast.avalancheProblem3].filter(
				Boolean,
			) as string[];
			const forecastText = [bottomLine, currentConditions].filter(Boolean).join("\n\n");

			const personaScores = scoreForecast(
				forecastText,
				forecast.overallDangerRating,
				problems,
				bottomLine,
				runtimePersonas,
			);

			for (const ps of personaScores) {
				const comprehensionLevel = deriveComprehensionLevel(ps.overall);

				await db
					.insert(scorecardRuns)
					.values({
						forecastId: forecast.id,
						zoneId: forecast.zoneId,
						zoneSlug: forecast.zoneSlug,
						zoneName: forecast.zoneName,
						forecasterName: forecast.forecasterName,
						dateIssued: forecast.dateIssued,
						overallDangerRating: forecast.overallDangerRating,
						personaId: ps.personaId,
						personaName: ps.personaName,
						overallScore: ps.overall,
						clarityScore: ps.clarity,
						jargonScore: ps.jargonLoad,
						actionabilityScore: ps.actionability,
						comprehensionLevel,
						divergenceScore: ps.flags.length,
						decisionConfidence: ps.decisionOutcome,
						assumptionDensity: ps.flags.filter((f) => !f.reason.includes("words")).length,
					})
					.onConflictDoUpdate({
						target: [scorecardRuns.forecastId, scorecardRuns.personaId],
						set: {
							overallScore: ps.overall,
							clarityScore: ps.clarity,
							jargonScore: ps.jargonLoad,
							actionabilityScore: ps.actionability,
							comprehensionLevel,
							divergenceScore: ps.flags.length,
							decisionConfidence: ps.decisionOutcome,
							assumptionDensity: ps.flags.filter((f) => !f.reason.includes("words")).length,
							scoredAt: new Date(),
						},
					});
			}

			zonesScored++;
			console.log(`[scorecard-scheduler] Scored zone ${forecast.zoneSlug} (${personaScores.length} personas)`);
		} catch (err) {
			const msg = `Zone ${forecast.zoneSlug}: ${String(err)}`;
			console.error(`[scorecard-scheduler] Error: ${msg}`);
			errors.push(msg);
		}
	}

	console.log(`[scorecard-scheduler] Batch complete — ${zonesScored} zones scored, ${errors.length} errors`);
	return { zonesScored, errors };
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

async function runSafe(): Promise<void> {
	try {
		await runDailyScorecardBatch();
	} catch (err) {
		console.error("[scorecard-scheduler] Unhandled error in batch run:", err);
	}
}

/** Score all zones for a specific date string (YYYY-MM-DD). Used by backfill. */
async function runBatchForDate(date: string, runtimePersonas: Persona[] | undefined): Promise<void> {
	const forecasts = await getForecastsForScoringByDate(date);
	if (forecasts.length === 0) return;

	const db = getDb();
	for (const forecast of forecasts) {
		try {
			const bottomLine = normalizeText(forecast.bottomLine);
			const currentConditions = normalizeText(forecast.currentConditions);
			const problems = [forecast.avalancheProblem1, forecast.avalancheProblem2, forecast.avalancheProblem3].filter(
				Boolean,
			) as string[];
			const forecastText = [bottomLine, currentConditions].filter(Boolean).join("\n\n");
			const personaScores = scoreForecast(
				forecastText,
				forecast.overallDangerRating,
				problems,
				bottomLine,
				runtimePersonas,
			);

			for (const ps of personaScores) {
				const comprehensionLevel = deriveComprehensionLevel(ps.overall);
				await db
					.insert(scorecardRuns)
					.values({
						forecastId: forecast.id,
						zoneId: forecast.zoneId,
						zoneSlug: forecast.zoneSlug,
						zoneName: forecast.zoneName,
						forecasterName: forecast.forecasterName,
						dateIssued: forecast.dateIssued,
						overallDangerRating: forecast.overallDangerRating,
						personaId: ps.personaId,
						personaName: ps.personaName,
						overallScore: ps.overall,
						clarityScore: ps.clarity,
						jargonScore: ps.jargonLoad,
						actionabilityScore: ps.actionability,
						comprehensionLevel,
						divergenceScore: ps.flags.length,
						decisionConfidence: ps.decisionOutcome,
						assumptionDensity: ps.flags.filter((f) => !f.reason.includes("words")).length,
					})
					.onConflictDoUpdate({
						target: [scorecardRuns.forecastId, scorecardRuns.personaId],
						set: {
							overallScore: ps.overall,
							clarityScore: ps.clarity,
							jargonScore: ps.jargonLoad,
							actionabilityScore: ps.actionability,
							comprehensionLevel,
							divergenceScore: ps.flags.length,
							decisionConfidence: ps.decisionOutcome,
							assumptionDensity: ps.flags.filter((f) => !f.reason.includes("words")).length,
							scoredAt: new Date(),
						},
					});
			}
		} catch (err) {
			console.error(`[scorecard-scheduler] Backfill error for zone ${forecast.zoneSlug} on ${date}:`, err);
		}
	}
	console.log(`[scorecard-scheduler] Backfilled ${forecasts.length} zones for ${date}`);
}

/** Score the past N days of ingested forecast data, skipping dates already scored. */
async function backfillLastNDays(days = 7): Promise<void> {
	let runtimePersonas: Persona[] | undefined;
	try {
		const records = await getAllPersonas();
		const active = records.filter((r) => r.active);
		runtimePersonas = active.length > 0 ? active.map(toScoringPersona) : undefined;
	} catch {
		/* use static defaults */
	}

	for (let i = 1; i <= days; i++) {
		const d = new Date();
		d.setUTCDate(d.getUTCDate() - i);
		const date = d.toISOString().slice(0, 10);
		await runBatchForDate(date, runtimePersonas);
	}
}

export function startScorecardScheduler(): void {
	// Fire immediately on startup + backfill last 7 days
	void runSafe();
	void backfillLastNDays(7);

	// Schedule next run at 6am MT, then every 24h
	const delayMs = msUntilNext6amMT();
	console.log(`[scorecard-scheduler] Next scheduled run in ${Math.round(delayMs / 60_000)} minutes`);

	setTimeout(() => {
		void runSafe();
		setInterval(() => void runSafe(), TWENTY_FOUR_HOURS_MS);
	}, delayMs);
}
