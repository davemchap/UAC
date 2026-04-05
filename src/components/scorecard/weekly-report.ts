/**
 * Weekly forecast quality report aggregated by forecaster and zone.
 * Pure business logic — no framework dependencies.
 */

import { and, gte, lte } from "drizzle-orm";
import { getDb } from "../db";
import { scorecardRuns } from "../db/schema";

export interface ForecasterWeeklyStats {
	forecasterName: string;
	zonesScored: number;
	forecastsScored: number;
	avgOverallScore: number;
	avgClarityScore: number;
	avgActionabilityScore: number;
	mostCommonFlag: string | null;
	worstPersonaComprehension: string | null; // personaId
	invertedDecisionCount: number;
}

export interface ZoneWeeklyStats {
	zoneId: number;
	zoneName: string;
	avgOverallScore: number;
	trend: "improving" | "declining" | "stable";
	forecastsScored: number;
}

export interface WeeklyReport {
	weekOf: string; // ISO date of Monday
	weekEnd: string; // ISO date of Sunday
	generatedAt: string;
	byForecaster: ForecasterWeeklyStats[];
	byZone: ZoneWeeklyStats[];
	summary: {
		bestForecaster: string | null;
		mostImprovedZone: string | null;
		mostDecliningZone: string | null;
		overallAvgScore: number;
		totalForecastsScored: number;
	};
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Parse YYYY-MM-DD into a Date at UTC midnight. */
function parseUtcDate(dateStr: string): Date {
	return new Date(`${dateStr}T00:00:00Z`);
}

/** Format a Date as YYYY-MM-DD in UTC. */
function formatUtcDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** Return the ISO date string (YYYY-MM-DD) for the Monday of the week containing `date`. */
function getMondayOf(date: Date): string {
	const d = new Date(date);
	const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
	const diff = day === 0 ? -6 : 1 - day; // shift to Monday
	d.setUTCDate(d.getUTCDate() + diff);
	return formatUtcDate(d);
}

/** Return Sunday date (6 days after Monday). */
function getSundayOf(monday: string): string {
	const d = parseUtcDate(monday);
	d.setUTCDate(d.getUTCDate() + 6);
	return formatUtcDate(d);
}

/** Subtract `weeks` weeks from a YYYY-MM-DD date string. */
function subtractWeeks(dateStr: string, weeks: number): string {
	const d = parseUtcDate(dateStr);
	d.setUTCDate(d.getUTCDate() - weeks * 7);
	return formatUtcDate(d);
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

interface RawRow {
	forecastId: number;
	zoneId: number;
	zoneName: string;
	forecasterName: string | null;
	personaId: string;
	overallScore: number;
	clarityScore: number;
	actionabilityScore: number;
	decisionConfidence: string;
	mostCommonFlag: string | null;
}

function avg(values: number[]): number {
	if (values.length === 0) return 0;
	return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

function mostFrequent<T>(items: T[]): T | null {
	if (items.length === 0) return null;
	const counts = new Map<T, number>();
	for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
	let best: T | null = null;
	let bestCount = 0;
	for (const [item, count] of counts) {
		if (count > bestCount) {
			best = item;
			bestCount = count;
		}
	}
	return best;
}

function buildForecasterStats(rows: RawRow[]): ForecasterWeeklyStats[] {
	// Group rows by forecaster name (null -> "Unknown")
	const byForecaster = new Map<string, RawRow[]>();
	for (const row of rows) {
		const name = row.forecasterName ?? "Unknown";
		if (!byForecaster.has(name)) byForecaster.set(name, []);
		byForecaster.get(name)?.push(row);
	}

	return Array.from(byForecaster.entries()).map(([forecasterName, fcRows]) => {
		// Unique forecast IDs per zone (one forecast can have multiple persona rows)
		const uniqueForecasts = new Set(fcRows.map((r) => r.forecastId));
		const uniqueZones = new Set(fcRows.map((r) => r.zoneId));

		// Per-forecast avg (collapse persona rows → one per forecast for score aggs)
		const perForecast = new Map<number, RawRow[]>();
		for (const r of fcRows) {
			if (!perForecast.has(r.forecastId)) perForecast.set(r.forecastId, []);
			perForecast.get(r.forecastId)?.push(r);
		}

		const overallScores = fcRows.map((r) => r.overallScore);
		const clarityScores = fcRows.map((r) => r.clarityScore);
		const actionabilityScores = fcRows.map((r) => r.actionabilityScore);

		// Most common flag across all persona rows
		const flags = fcRows.map((r) => r.mostCommonFlag).filter((f): f is string => f !== null);
		const mostCommonFlag = mostFrequent(flags);

		// Worst persona comprehension: persona with most INVERTED decision_confidence rows
		const invertedRows = fcRows.filter((r) => r.decisionConfidence === "INVERTED");
		const invertedPersonaCounts = new Map<string, number>();
		for (const r of invertedRows) {
			invertedPersonaCounts.set(r.personaId, (invertedPersonaCounts.get(r.personaId) ?? 0) + 1);
		}
		let worstPersonaComprehension: string | null = null;
		let worstCount = 0;
		for (const [pid, cnt] of invertedPersonaCounts) {
			if (cnt > worstCount) {
				worstPersonaComprehension = pid;
				worstCount = cnt;
			}
		}

		return {
			forecasterName,
			zonesScored: uniqueZones.size,
			forecastsScored: uniqueForecasts.size,
			avgOverallScore: avg(overallScores),
			avgClarityScore: avg(clarityScores),
			avgActionabilityScore: avg(actionabilityScores),
			mostCommonFlag,
			worstPersonaComprehension,
			invertedDecisionCount: invertedRows.length,
		};
	});
}

async function buildZoneStats(rows: RawRow[], weekMonday: string): Promise<ZoneWeeklyStats[]> {
	const db = getDb();

	// Unique zones in this week's data
	const zoneMap = new Map<number, { name: string; rows: RawRow[] }>();
	for (const row of rows) {
		if (!zoneMap.has(row.zoneId)) zoneMap.set(row.zoneId, { name: row.zoneName, rows: [] });
		zoneMap.get(row.zoneId)?.rows.push(row);
	}

	// Compute prior 3-week average for trend comparison
	const prior3Start = subtractWeeks(weekMonday, 3);
	const prior3End = subtractWeeks(weekMonday, 1); // exclusive: day before this Monday
	const prior3EndDate = parseUtcDate(prior3End);
	prior3EndDate.setUTCDate(prior3EndDate.getUTCDate() - 1); // Sunday before current Monday

	const prior3StartTs = parseUtcDate(prior3Start);
	const prior3EndTs = prior3EndDate;

	// Fetch prior 3-week rows in one query
	const prior3Rows = await db
		.select({
			zoneId: scorecardRuns.zoneId,
			overallScore: scorecardRuns.overallScore,
		})
		.from(scorecardRuns)
		.where(and(gte(scorecardRuns.scoredAt, prior3StartTs), lte(scorecardRuns.scoredAt, prior3EndTs)));

	// Group prior rows by zone
	const prior3ByZone = new Map<number, number[]>();
	for (const r of prior3Rows) {
		if (!prior3ByZone.has(r.zoneId)) prior3ByZone.set(r.zoneId, []);
		prior3ByZone.get(r.zoneId)?.push(r.overallScore);
	}

	return Array.from(zoneMap.entries()).map(([zoneId, { name, rows: zRows }]) => {
		const currentAvg = avg(zRows.map((r) => r.overallScore));
		const uniqueForecasts = new Set(zRows.map((r) => r.forecastId)).size;

		const priorScores = prior3ByZone.get(zoneId) ?? [];
		const priorAvg = avg(priorScores);

		let trend: ZoneWeeklyStats["trend"] = "stable";
		if (priorScores.length > 0) {
			if (currentAvg > priorAvg + 3) trend = "improving";
			else if (currentAvg < priorAvg - 3) trend = "declining";
		}

		return {
			zoneId,
			zoneName: name,
			avgOverallScore: currentAvg,
			trend,
			forecastsScored: uniqueForecasts,
		};
	});
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateWeeklyReport(weekOf?: string): Promise<WeeklyReport> {
	const generatedAt = new Date().toISOString();

	// Resolve Monday of the requested week (default: current week)
	const referenceDate = weekOf ? parseUtcDate(weekOf) : new Date();
	const weekMonday = getMondayOf(referenceDate);
	const weekEnd = getSundayOf(weekMonday);

	const weekStart = parseUtcDate(weekMonday);
	const weekEndTs = new Date(`${weekEnd}T23:59:59Z`);

	const db = getDb();

	// Fetch all scorecard_runs for the week
	const rawRows = await db
		.select({
			forecastId: scorecardRuns.forecastId,
			zoneId: scorecardRuns.zoneId,
			zoneName: scorecardRuns.zoneName,
			forecasterName: scorecardRuns.forecasterName,
			personaId: scorecardRuns.personaId,
			overallScore: scorecardRuns.overallScore,
			clarityScore: scorecardRuns.clarityScore,
			actionabilityScore: scorecardRuns.actionabilityScore,
			decisionConfidence: scorecardRuns.decisionConfidence,
			mostCommonFlag: scorecardRuns.mostCommonFlag,
		})
		.from(scorecardRuns)
		.where(and(gte(scorecardRuns.scoredAt, weekStart), lte(scorecardRuns.scoredAt, weekEndTs)));

	// Empty week — return zeroed report
	if (rawRows.length === 0) {
		return {
			weekOf: weekMonday,
			weekEnd,
			generatedAt,
			byForecaster: [],
			byZone: [],
			summary: {
				bestForecaster: null,
				mostImprovedZone: null,
				mostDecliningZone: null,
				overallAvgScore: 0,
				totalForecastsScored: 0,
			},
		};
	}

	const [byForecaster, byZone] = await Promise.all([
		Promise.resolve(buildForecasterStats(rawRows)),
		buildZoneStats(rawRows, weekMonday),
	]);

	// Summary
	const bestForecaster =
		byForecaster.length > 0
			? byForecaster.reduce<ForecasterWeeklyStats>(
					(best, f) => (f.avgOverallScore > best.avgOverallScore ? f : best),
					byForecaster[0],
				).forecasterName
			: null;

	const improvingZones = byZone.filter((z) => z.trend === "improving");
	const decliningZones = byZone.filter((z) => z.trend === "declining");

	const mostImprovedZone =
		improvingZones.length > 0
			? improvingZones.reduce<ZoneWeeklyStats>(
					(best, z) => (z.avgOverallScore > best.avgOverallScore ? z : best),
					improvingZones[0],
				).zoneName
			: null;

	const mostDecliningZone =
		decliningZones.length > 0
			? decliningZones.reduce<ZoneWeeklyStats>(
					(worst, z) => (z.avgOverallScore < worst.avgOverallScore ? z : worst),
					decliningZones[0],
				).zoneName
			: null;

	const overallAvgScore = avg(rawRows.map((r) => r.overallScore));
	const totalForecastsScored = new Set(rawRows.map((r) => r.forecastId)).size;

	return {
		weekOf: weekMonday,
		weekEnd,
		generatedAt,
		byForecaster,
		byZone,
		summary: {
			bestForecaster,
			mostImprovedZone,
			mostDecliningZone,
			overallAvgScore,
			totalForecastsScored,
		},
	};
}
