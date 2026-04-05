/**
 * Daily scorecard report builder.
 * Queries scorecard_runs for a given date and groups by zone + persona.
 * Pure business logic — no HTTP framework dependencies.
 */

import { and, gte, lt, sql } from "drizzle-orm";
import { getDb } from "../db";
import { scorecardRuns } from "../db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PersonaReportEntry {
	personaId: string;
	personaName: string;
	overall: number | null;
	comprehensionLevel: string | null;
	divergenceScore: number | null;
	decisionConfidence: string | null;
	assumptionDensity: number | null;
}

export interface ZoneReportEntry {
	zoneId: number;
	zoneName: string;
	zoneSlug: string;
	forecasterName: string | null;
	overallDangerRating: string | null;
	dateIssued: string;
	avgScore: number;
	personas: PersonaReportEntry[];
}

export interface DailyReportSummary {
	worstComprehensionZone: string | null;
	mostInvertedPersonaId: string | null;
	highestAssumptionDensityZone: string | null;
	avgOverallScore: number;
}

export interface DailyReport {
	date: string;
	generatedAt: string;
	zones: ZoneReportEntry[];
	summary: DailyReportSummary;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function avg(values: (number | null)[]): number {
	const valid = values.filter((v): v is number => v !== null);
	if (valid.length === 0) return 0;
	return Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length);
}

function todayDateString(): string {
	return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export async function buildDailyReport(date?: string): Promise<DailyReport> {
	const reportDate = date ?? todayDateString();

	// Build UTC day boundaries from the date string (YYYY-MM-DD)
	const dayStart = new Date(`${reportDate}T00:00:00.000Z`);
	const dayEnd = new Date(`${reportDate}T00:00:00.000Z`);
	dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

	const db = getDb();
	const rows = await db
		.select()
		.from(scorecardRuns)
		.where(and(gte(scorecardRuns.scoredAt, dayStart), lt(scorecardRuns.scoredAt, dayEnd)));

	// Group rows by zone
	const zoneMap = new Map<number, typeof rows>();
	for (const row of rows) {
		const existing = zoneMap.get(row.zoneId) ?? [];
		existing.push(row);
		zoneMap.set(row.zoneId, existing);
	}

	const zones: ZoneReportEntry[] = [];

	for (const [zoneId, zoneRows] of zoneMap) {
		const first = zoneRows[0];
		const personas: PersonaReportEntry[] = zoneRows.map((r) => ({
			personaId: r.personaId,
			personaName: r.personaName,
			overall: r.overallScore,
			comprehensionLevel: r.comprehensionLevel,
			divergenceScore: r.divergenceScore,
			decisionConfidence: r.decisionConfidence,
			assumptionDensity: r.assumptionDensity,
		}));

		zones.push({
			zoneId,
			zoneName: first.zoneName,
			zoneSlug: first.zoneSlug,
			forecasterName: first.forecasterName,
			overallDangerRating: first.overallDangerRating,
			dateIssued: first.dateIssued,
			avgScore: avg(zoneRows.map((r) => r.overallScore)),
			personas,
		});
	}

	// Sort zones by avgScore ascending (worst first)
	zones.sort((a, b) => a.avgScore - b.avgScore);

	// Summary computations
	const allScores = rows.map((r) => r.overallScore);
	const avgOverallScore = avg(allScores);

	// Worst comprehension zone: zone with lowest avgScore
	const worstComprehensionZone = zones.length > 0 ? (zones[0]?.zoneName ?? null) : null;

	// Most inverted persona: persona with highest assumption density across all zones
	const personaDensityMap = new Map<string, number>();
	for (const row of rows) {
		const current = personaDensityMap.get(row.personaId) ?? 0;
		personaDensityMap.set(row.personaId, current + (row.assumptionDensity ?? 0));
	}
	let mostInvertedPersonaId: string | null = null;
	let maxDensity = -1;
	for (const [personaId, density] of personaDensityMap) {
		if (density > maxDensity) {
			maxDensity = density;
			mostInvertedPersonaId = personaId;
		}
	}

	// Highest assumption density zone: zone whose total assumptionDensity is highest
	let highestAssumptionDensityZone: string | null = null;
	let maxZoneDensity = -1;
	for (const zone of zones) {
		const total = zone.personas.reduce((sum, p) => sum + (p.assumptionDensity ?? 0), 0);
		if (total > maxZoneDensity) {
			maxZoneDensity = total;
			highestAssumptionDensityZone = zone.zoneName;
		}
	}

	return {
		date: reportDate,
		generatedAt: new Date().toISOString(),
		zones,
		summary: {
			worstComprehensionZone,
			mostInvertedPersonaId,
			highestAssumptionDensityZone,
			avgOverallScore,
		},
	};
}

// ---------------------------------------------------------------------------
// Available dates
// ---------------------------------------------------------------------------

/**
 * Returns distinct dates (YYYY-MM-DD) that have scorecard_runs data,
 * most recent first, up to `limit` days back.
 */
export async function getAvailableReportDates(limit = 14): Promise<string[]> {
	const db = getDb();
	const cutoff = new Date();
	cutoff.setUTCDate(cutoff.getUTCDate() - limit);

	const rows = await db
		.selectDistinct({ dateIssued: scorecardRuns.dateIssued })
		.from(scorecardRuns)
		.where(and(gte(scorecardRuns.scoredAt, cutoff), sql`${scorecardRuns.dateIssued} IS NOT NULL`))
		.orderBy(sql`${scorecardRuns.dateIssued} DESC`);

	return rows.map((r) => r.dateIssued);
}
