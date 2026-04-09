/**
 * Live UAC forecast fetcher.
 * Used when a requested date isn't in the local DB — fetches from the UAC API,
 * upserts the result, and returns the record ready for scoring.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { avalancheForecasts, avalancheProblems, forecastZones } from "../db/schema";
import type { ForecastForScoring } from "./queries";

interface UacForecastRaw {
	Date?: string;
	Region?: string;
	"Overall Danger Rating"?: string;
	"Overall rose"?: string;
	"Type 1"?: string;
	"Description 1"?: string;
	"Rose 1"?: string;
	"Type 2"?: string;
	"Description 2"?: string;
	"Rose 2"?: string;
	"Type 3"?: string;
	"Description 3"?: string;
	"Rose 3"?: string;
	Summary?: string;
	"Snow and Weather"?: string;
	"Author name"?: string;
	Nid?: string;
	"Special Announcement"?: string;
}

interface UacForecastsResponse {
	forecasts?: { forecast: UacForecastRaw }[];
}

function uacDateToIso(raw: string): string {
	return raw.replace(/\//g, "-");
}

function daysAgo(isoDate: string): number {
	const today = new Date();
	today.setUTCHours(12, 0, 0, 0);
	const target = new Date(`${isoDate}T12:00:00Z`);
	return Math.round((today.getTime() - target.getTime()) / 86_400_000);
}

async function fetchPage(apiUrl: string, page: number): Promise<UacForecastRaw | null> {
	try {
		const res = await fetch(`${apiUrl}?page=${page}`, {
			headers: { "User-Agent": "UAC Avalanche Scorecard/1.0 (research)" },
		});
		if (!res.ok) return null;
		const data = (await res.json()) as UacForecastsResponse;
		return data.forecasts?.[0]?.forecast ?? null;
	} catch {
		return null;
	}
}

/**
 * Search ±5 pages around the expected page for a specific date.
 * UAC publishes on an irregular schedule so the page number is approximate.
 */
async function fetchByDate(apiUrl: string, targetDate: string): Promise<UacForecastRaw | null> {
	const expected = daysAgo(targetDate);
	// Build search order: expected page first, then alternating ±1, ±2, ... ±5
	const pages: number[] = [expected];
	for (let offset = 1; offset <= 5; offset++) {
		pages.push(expected + offset, expected - offset);
	}
	const valid = pages.filter((p) => p >= 0 && p <= 90);

	for (const page of valid) {
		const raw = await fetchPage(apiUrl, page);
		if (!raw?.Date || !raw.Nid) continue;
		if (uacDateToIso(raw.Date) === targetDate) return raw;
	}
	return null;
}

async function upsertForecast(
	zone: { zoneId: number; name: string; slug: string },
	raw: UacForecastRaw,
	targetDate: string,
): Promise<ForecastForScoring> {
	const db = getDb();
	const nid = raw.Nid ?? `live-${zone.slug}-${targetDate}`;
	const dateIssued = raw.Date ? uacDateToIso(raw.Date) : targetDate;

	const [row] = await db
		.insert(avalancheForecasts)
		.values({
			zoneId: zone.zoneId,
			nid,
			dateIssued,
			dateIssuedTimestamp: null,
			overallDangerRating: raw["Overall Danger Rating"] ?? "Unknown",
			overallDangerRose: raw["Overall rose"] ?? null,
			avalancheProblem1: raw["Type 1"] ?? null,
			avalancheProblem2: raw["Type 2"] ?? null,
			avalancheProblem3: raw["Type 3"] ?? null,
			bottomLine: raw.Summary ?? null,
			currentConditions: raw["Snow and Weather"] ?? null,
			region: raw.Region ?? null,
			forecasterName: raw["Author name"] ?? null,
			specialBulletin: raw["Special Announcement"] ?? null,
		})
		.onConflictDoUpdate({
			target: [avalancheForecasts.zoneId, avalancheForecasts.nid],
			set: {
				overallDangerRating: raw["Overall Danger Rating"] ?? "Unknown",
				bottomLine: raw.Summary ?? null,
				currentConditions: raw["Snow and Weather"] ?? null,
				updatedAt: new Date(),
			},
		})
		.returning({ id: avalancheForecasts.id });

	const problems = [
		{ num: 1, type: raw["Type 1"], desc: raw["Description 1"], rose: raw["Rose 1"] },
		{ num: 2, type: raw["Type 2"], desc: raw["Description 2"], rose: raw["Rose 2"] },
		{ num: 3, type: raw["Type 3"], desc: raw["Description 3"], rose: raw["Rose 3"] },
	].filter((p): p is typeof p & { type: string } => Boolean(p.type));

	for (const p of problems) {
		await db
			.insert(avalancheProblems)
			.values({
				forecastId: row.id,
				problemNumber: p.num,
				problemType: p.type,
				description: p.desc ?? null,
				dangerRose: p.rose ?? null,
			})
			.onConflictDoNothing();
	}

	return {
		id: row.id,
		zoneId: zone.zoneId,
		zoneName: zone.name,
		zoneSlug: zone.slug,
		forecasterName: raw["Author name"] ?? null,
		dateIssued,
		overallDangerRating: raw["Overall Danger Rating"] ?? "Unknown",
		bottomLine: raw.Summary ?? null,
		currentConditions: raw["Snow and Weather"] ?? null,
		avalancheProblem1: raw["Type 1"] ?? null,
		avalancheProblem2: raw["Type 2"] ?? null,
		avalancheProblem3: raw["Type 3"] ?? null,
	};
}

/**
 * Fetch a forecast for a zone+date from the UAC API.
 * Upserts into the DB on success so future requests are served from cache.
 * Returns null if the zone is unknown or UAC has no data for that date.
 */
export async function fetchForecastLive(zoneSlug: string, targetDate: string): Promise<ForecastForScoring | null> {
	const db = getDb();
	const zoneRows = await db.select().from(forecastZones).where(eq(forecastZones.slug, zoneSlug)).limit(1);
	if (zoneRows.length === 0) return null;
	const zone = zoneRows[0];

	const raw = await fetchByDate(zone.apiUrl, targetDate);
	if (!raw) return null;

	return upsertForecast({ zoneId: zone.zoneId, name: zone.name, slug: zone.slug }, raw, targetDate);
}
