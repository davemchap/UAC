/**
 * DB queries for the scorecard component.
 * Returns typed forecast data for scoring.
 */

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { avalancheForecasts, forecastZones } from "../db/schema";

export interface ForecastForScoring {
	id: number;
	zoneId: number;
	zoneName: string;
	zoneSlug: string;
	forecasterName: string | null;
	dateIssued: string;
	overallDangerRating: string;
	bottomLine: string | null;
	currentConditions: string | null;
	avalancheProblem1: string | null;
	avalancheProblem2: string | null;
	avalancheProblem3: string | null;
}

export async function getLatestForecastsForScoring(): Promise<ForecastForScoring[]> {
	const db = getDb();

	// Get the most recent forecast per zone by joining zones and getting latest per zoneId
	const zones = await db.select().from(forecastZones).orderBy(forecastZones.name);

	const forecasts = await Promise.all(
		zones.map(async (zone) => {
			const rows = await db
				.select()
				.from(avalancheForecasts)
				.where(eq(avalancheForecasts.zoneId, zone.zoneId))
				.orderBy(desc(avalancheForecasts.createdAt))
				.limit(1);

			if (rows.length === 0) return null;
			const f = rows[0];
			return {
				id: f.id,
				zoneId: zone.zoneId,
				zoneName: zone.name,
				zoneSlug: zone.slug,
				forecasterName: f.forecasterName,
				dateIssued: f.dateIssued,
				overallDangerRating: f.overallDangerRating,
				bottomLine: f.bottomLine,
				currentConditions: f.currentConditions,
				avalancheProblem1: f.avalancheProblem1,
				avalancheProblem2: f.avalancheProblem2,
				avalancheProblem3: f.avalancheProblem3,
			};
		}),
	);

	return forecasts.filter((f): f is ForecastForScoring => f !== null);
}

export async function getForecastForScoringByZone(zoneSlug: string): Promise<ForecastForScoring | null> {
	const db = getDb();
	const zoneRows = await db.select().from(forecastZones).where(eq(forecastZones.slug, zoneSlug)).limit(1);
	if (zoneRows.length === 0) return null;
	const zone = zoneRows[0];

	const rows = await db
		.select()
		.from(avalancheForecasts)
		.where(eq(avalancheForecasts.zoneId, zone.zoneId))
		.orderBy(desc(avalancheForecasts.createdAt))
		.limit(1);

	if (rows.length === 0) return null;
	const f = rows[0];
	return {
		id: f.id,
		zoneId: zone.zoneId,
		zoneName: zone.name,
		zoneSlug: zone.slug,
		forecasterName: f.forecasterName,
		dateIssued: f.dateIssued,
		overallDangerRating: f.overallDangerRating,
		bottomLine: f.bottomLine,
		currentConditions: f.currentConditions,
		avalancheProblem1: f.avalancheProblem1,
		avalancheProblem2: f.avalancheProblem2,
		avalancheProblem3: f.avalancheProblem3,
	};
}

export async function getForecastForScoringByZoneAndDate(
	zoneSlug: string,
	date: string, // YYYY-MM-DD
): Promise<ForecastForScoring | null> {
	const db = getDb();
	const zoneRows = await db.select().from(forecastZones).where(eq(forecastZones.slug, zoneSlug)).limit(1);
	if (zoneRows.length === 0) return null;
	const zone = zoneRows[0];

	const rows = await db
		.select()
		.from(avalancheForecasts)
		.where(and(eq(avalancheForecasts.zoneId, zone.zoneId), eq(avalancheForecasts.dateIssued, date)))
		.orderBy(desc(avalancheForecasts.createdAt))
		.limit(1);

	if (rows.length === 0) return null;
	const f = rows[0];
	return {
		id: f.id,
		zoneId: zone.zoneId,
		zoneName: zone.name,
		zoneSlug: zone.slug,
		forecasterName: f.forecasterName,
		dateIssued: f.dateIssued,
		overallDangerRating: f.overallDangerRating,
		bottomLine: f.bottomLine,
		currentConditions: f.currentConditions,
		avalancheProblem1: f.avalancheProblem1,
		avalancheProblem2: f.avalancheProblem2,
		avalancheProblem3: f.avalancheProblem3,
	};
}

/**
 * Returns distinct ISO dates (YYYY-MM-DD) that have forecast data for a zone,
 * most recent first, up to `daysBack` days ago.
 */
export async function getAvailableDatesForZone(zoneSlug: string, daysBack = 60): Promise<string[]> {
	const db = getDb();
	const cutoff = new Date();
	cutoff.setUTCDate(cutoff.getUTCDate() - daysBack);
	const cutoffStr = cutoff.toISOString().slice(0, 10);

	const zoneRows = await db.select().from(forecastZones).where(eq(forecastZones.slug, zoneSlug)).limit(1);
	if (zoneRows.length === 0) return [];
	const zone = zoneRows[0];

	const rows = await db
		.select({ dateIssued: avalancheForecasts.dateIssued })
		.from(avalancheForecasts)
		.where(
			and(
				eq(avalancheForecasts.zoneId, zone.zoneId),
				gte(avalancheForecasts.dateIssued, cutoffStr),
				sql`date_issued ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
			),
		)
		.orderBy(desc(avalancheForecasts.dateIssued));

	return rows.map((r) => r.dateIssued).filter(Boolean);
}

/** Returns all zones' latest forecast for a specific date (YYYY-MM-DD). */
export async function getForecastsForScoringByDate(date: string): Promise<ForecastForScoring[]> {
	const db = getDb();
	const zones = await db.select().from(forecastZones).orderBy(forecastZones.name);

	const forecasts = await Promise.all(
		zones.map(async (zone) => {
			const rows = await db
				.select()
				.from(avalancheForecasts)
				.where(and(eq(avalancheForecasts.zoneId, zone.zoneId), eq(avalancheForecasts.dateIssued, date)))
				.orderBy(desc(avalancheForecasts.createdAt))
				.limit(1);

			if (rows.length === 0) return null;
			const f = rows[0];
			return {
				id: f.id,
				zoneId: zone.zoneId,
				zoneName: zone.name,
				zoneSlug: zone.slug,
				forecasterName: f.forecasterName,
				dateIssued: f.dateIssued,
				overallDangerRating: f.overallDangerRating,
				bottomLine: f.bottomLine,
				currentConditions: f.currentConditions,
				avalancheProblem1: f.avalancheProblem1,
				avalancheProblem2: f.avalancheProblem2,
				avalancheProblem3: f.avalancheProblem3,
			};
		}),
	);

	return forecasts.filter((f): f is ForecastForScoring => f !== null);
}
