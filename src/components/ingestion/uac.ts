import { getDb } from "../db";
import { avalancheForecasts, avalancheProblems, forecastZones } from "../db/schema";

// ---------------------------------------------------------------------------
// UAC /api/forecasts API types
// ---------------------------------------------------------------------------

interface UacForecast {
	Date?: string; // "2026/04/07" or "Thursday, April 2, 2026 - 7:42am"
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
	forecasts?: { forecast: UacForecast }[];
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchUacForecast(apiUrl: string): Promise<UacForecast | null> {
	const res = await fetch(apiUrl, { method: "GET" });
	if (!res.ok) throw new Error(`UAC fetch failed: ${res.status} ${res.statusText}`);
	const data = (await res.json()) as UacForecastsResponse;
	return data.forecasts?.at(0)?.forecast ?? null;
}

// ---------------------------------------------------------------------------
// Date normalization
// ---------------------------------------------------------------------------

/**
 * Normalize any UAC date string to YYYY-MM-DD.
 * Handles:
 *   "2026/04/07"                       → "2026-04-07"
 *   "Thursday, April 2, 2026 - 7:42am" → "2026-04-02"
 */
function normalizeUacDate(raw: string): string {
	// Already YYYY-MM-DD
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

	// YYYY/MM/DD
	if (/^\d{4}\/\d{2}\/\d{2}$/.test(raw)) return raw.replace(/\//g, "-");

	// Verbose: "Thursday, April 2, 2026 - 7:42am" — try parsing directly
	const parsed = new Date(raw);
	if (!Number.isNaN(parsed.getTime())) {
		const y = parsed.getFullYear();
		const m = String(parsed.getMonth() + 1).padStart(2, "0");
		const d = String(parsed.getDate()).padStart(2, "0");
		return `${y}-${m}-${d}`;
	}

	// Fallback: slash-to-dash
	return raw.replace(/\//g, "-");
}

// ---------------------------------------------------------------------------
// Persist
// ---------------------------------------------------------------------------

async function persistUacForecast(zoneId: number, forecast: UacForecast): Promise<void> {
	const nid = forecast.Nid;
	const dateRaw = forecast.Date;
	const dangerRating = forecast["Overall Danger Rating"];

	if (!nid || !dateRaw || !dangerRating) {
		throw new Error(`UAC forecast for zone ${zoneId} missing required fields`);
	}

	// Normalize to YYYY-MM-DD regardless of UAC format:
	//   "2026/04/07"                      → "2026-04-07"
	//   "Thursday, April 2, 2026 - 7:42am" → "2026-04-02"
	const dateIssued = normalizeUacDate(dateRaw);

	const db = getDb();

	const [row] = await db
		.insert(avalancheForecasts)
		.values({
			zoneId,
			nid,
			dateIssued,
			dateIssuedTimestamp: null,
			overallDangerRating: dangerRating,
			overallDangerRose: forecast["Overall rose"] ?? null,
			avalancheProblem1: forecast["Type 1"] ?? null,
			avalancheProblem2: forecast["Type 2"] ?? null,
			avalancheProblem3: forecast["Type 3"] ?? null,
			bottomLine: forecast.Summary ?? null,
			currentConditions: forecast["Snow and Weather"] ?? null,
			region: forecast.Region ?? null,
			forecasterName: forecast["Author name"] ?? null,
			specialBulletin: forecast["Special Announcement"] ?? null,
		})
		.onConflictDoUpdate({
			target: [avalancheForecasts.zoneId, avalancheForecasts.nid],
			set: {
				overallDangerRating: dangerRating,
				overallDangerRose: forecast["Overall rose"] ?? null,
				updatedAt: new Date(),
			},
		})
		.returning({ id: avalancheForecasts.id });

	const forecastId = row.id;

	const problems = [
		{ num: 1, type: forecast["Type 1"], desc: forecast["Description 1"], rose: forecast["Rose 1"] },
		{ num: 2, type: forecast["Type 2"], desc: forecast["Description 2"], rose: forecast["Rose 2"] },
		{ num: 3, type: forecast["Type 3"], desc: forecast["Description 3"], rose: forecast["Rose 3"] },
	].filter((p): p is typeof p & { type: string } => Boolean(p.type));

	for (const p of problems) {
		await db
			.insert(avalancheProblems)
			.values({
				forecastId,
				problemNumber: p.num,
				problemType: p.type,
				description: p.desc ?? null,
				dangerRose: p.rose ?? null,
			})
			.onConflictDoNothing();
	}
}

// ---------------------------------------------------------------------------
// Ingest all zones
// ---------------------------------------------------------------------------

export async function ingestAllUacZones(): Promise<void> {
	const db = getDb();
	const zones = await db
		.select({ zoneId: forecastZones.zoneId, slug: forecastZones.slug, apiUrl: forecastZones.apiUrl })
		.from(forecastZones);

	for (const zone of zones) {
		try {
			const forecast = await fetchUacForecast(zone.apiUrl);
			if (!forecast) {
				console.warn(`[uac] No forecast returned for zone ${zone.zoneId}`);
				continue;
			}
			await persistUacForecast(zone.zoneId, forecast);
			console.log(`[uac] Ingested zone ${zone.zoneId}`);
		} catch (err) {
			console.error(`[uac] Failed zone ${zone.zoneId}:`, err);
		}
	}
}
