/**
 * Historical UAC forecast seeder.
 *
 * Fetches 60 days of avalanche forecasts for all 9 UAC zones using the
 * paginated API endpoint: GET /api/forecasts/{slug}?page=N
 * (page 0 = today, page 59 = ~60 days ago)
 *
 * Saves fetched data to data/black-diamond/historical-forecasts.json so it
 * can be committed to the repo and loaded at production deploy time without
 * making live API calls. See seedHistoricalData() in seed-reference.ts.
 *
 * Usage:
 *   bun run db:seed:historical
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { avalancheForecasts, avalancheProblems } from "./schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UacForecast {
	Date?: string; // "2026/04/07"
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

interface ZoneConfig {
	zone_id: number;
	name: string;
	slug: string;
	api_url: string;
}

export interface HistoricalForecastRecord {
	zoneId: number;
	zoneName: string;
	zoneSlug: string;
	nid: string;
	dateIssued: string; // YYYY-MM-DD
	overallDangerRating: string;
	overallDangerRose: string | null;
	avalancheProblem1: string | null;
	avalancheProblem1Description: string | null;
	avalancheProblem1Rose: string | null;
	avalancheProblem2: string | null;
	avalancheProblem2Description: string | null;
	avalancheProblem2Rose: string | null;
	avalancheProblem3: string | null;
	avalancheProblem3Description: string | null;
	avalancheProblem3Rose: string | null;
	bottomLine: string | null;
	currentConditions: string | null;
	region: string | null;
	forecasterName: string | null;
	specialBulletin: string | null;
}

export interface HistoricalForecastsFile {
	generated_at: string;
	page_count: number;
	zone_count: number;
	records: HistoricalForecastRecord[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PAGES = 60;
const DELAY_MS = 400; // be respectful of Cloudflare rate limits

const dataDir = resolve(process.cwd(), "data/black-diamond");
const outputPath = resolve(dataDir, "historical-forecasts.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
	return new Promise((res) => setTimeout(res, ms));
}

async function fetchForecastPage(apiUrl: string, page: number): Promise<UacForecast | null> {
	const url = `${apiUrl}?page=${page}`;
	try {
		const res = await fetch(url, {
			method: "GET",
			headers: { "User-Agent": "UAC Avalanche Scorecard/1.0 (research)" },
		});
		if (!res.ok) {
			console.warn(`  [fetch] HTTP ${res.status}: ${url}`);
			return null;
		}
		const data = (await res.json()) as UacForecastsResponse;
		return data.forecasts?.[0]?.forecast ?? null;
	} catch (err) {
		console.warn(`  [fetch] error on ${url}: ${String(err)}`);
		return null;
	}
}

/** "2026/04/07" → "2026-04-07" */
function normalizeDate(raw: string): string {
	return raw.replace(/\//g, "-");
}

function toRecord(zoneId: number, zoneName: string, zoneSlug: string, f: UacForecast): HistoricalForecastRecord {
	return {
		zoneId,
		zoneName,
		zoneSlug,
		nid: f.Nid ?? "",
		dateIssued: normalizeDate(f.Date ?? ""),
		overallDangerRating: f["Overall Danger Rating"] ?? "Unknown",
		overallDangerRose: f["Overall rose"] ?? null,
		avalancheProblem1: f["Type 1"] ?? null,
		avalancheProblem1Description: f["Description 1"] ?? null,
		avalancheProblem1Rose: f["Rose 1"] ?? null,
		avalancheProblem2: f["Type 2"] ?? null,
		avalancheProblem2Description: f["Description 2"] ?? null,
		avalancheProblem2Rose: f["Rose 2"] ?? null,
		avalancheProblem3: f["Type 3"] ?? null,
		avalancheProblem3Description: f["Description 3"] ?? null,
		avalancheProblem3Rose: f["Rose 3"] ?? null,
		bottomLine: f.Summary ?? null,
		currentConditions: f["Snow and Weather"] ?? null,
		region: f.Region ?? null,
		forecasterName: f["Author name"] ?? null,
		specialBulletin: f["Special Announcement"] ?? null,
	};
}

// ---------------------------------------------------------------------------
// Fetch phase
// ---------------------------------------------------------------------------

async function fetchAllHistoricalForecasts(zones: ZoneConfig[]): Promise<HistoricalForecastRecord[]> {
	const records: HistoricalForecastRecord[] = [];
	const seenKeys = new Set<string>();

	for (const zone of zones) {
		console.log(`\n[zone] ${zone.name} (${zone.slug})`);
		let fetched = 0;

		for (let page = 0; page < PAGES; page++) {
			const forecast = await fetchForecastPage(zone.api_url, page);
			if (!forecast?.Nid || !forecast.Date) {
				await sleep(DELAY_MS);
				continue;
			}

			const key = `${zone.zone_id}:${forecast.Nid}`;
			if (!seenKeys.has(key)) {
				seenKeys.add(key);
				records.push(toRecord(zone.zone_id, zone.name, zone.slug, forecast));
				fetched++;
			}

			process.stdout.write(`\r  page ${page + 1}/${PAGES} — ${normalizeDate(forecast.Date)} — ${fetched} unique`);
			await sleep(DELAY_MS);
		}
		console.log(`\n  ✓ ${fetched} records`);
	}

	return records;
}

// ---------------------------------------------------------------------------
// Persist phase
// ---------------------------------------------------------------------------

async function upsertAll(records: HistoricalForecastRecord[]): Promise<void> {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error("DATABASE_URL is not set — skipping DB upsert");
		return;
	}

	// Safety guard — refuse to run against production unless explicitly opted in
	const isProduction = databaseUrl.includes("rds.amazonaws.com") || databaseUrl.includes("prod");
	if (isProduction && !process.env.ALLOW_PRODUCTION_SEED) {
		console.warn("\n⚠️  DATABASE_URL points to a production database.");
		console.warn("   Set ALLOW_PRODUCTION_SEED=1 to seed production intentionally.");
		console.warn(
			"   To seed local only: DATABASE_URL=postgresql://aiAssistant@localhost:5432/shipsummit_dev bun run db:seed:historical",
		);
		return;
	}

	const client = postgres(databaseUrl, { max: 1 });
	const db = drizzle(client);

	let count = 0;
	for (const r of records) {
		if (!r.nid || !r.dateIssued) continue;

		const [row] = await db
			.insert(avalancheForecasts)
			.values({
				zoneId: r.zoneId,
				nid: r.nid,
				dateIssued: r.dateIssued,
				dateIssuedTimestamp: null,
				overallDangerRating: r.overallDangerRating,
				overallDangerRose: r.overallDangerRose,
				avalancheProblem1: r.avalancheProblem1,
				avalancheProblem2: r.avalancheProblem2,
				avalancheProblem3: r.avalancheProblem3,
				bottomLine: r.bottomLine,
				currentConditions: r.currentConditions,
				region: r.region,
				forecasterName: r.forecasterName,
				specialBulletin: r.specialBulletin,
			})
			.onConflictDoUpdate({
				target: [avalancheForecasts.zoneId, avalancheForecasts.nid],
				set: {
					overallDangerRating: r.overallDangerRating,
					bottomLine: r.bottomLine,
					currentConditions: r.currentConditions,
					avalancheProblem1: r.avalancheProblem1,
					avalancheProblem2: r.avalancheProblem2,
					avalancheProblem3: r.avalancheProblem3,
					forecasterName: r.forecasterName,
					updatedAt: new Date(),
				},
			})
			.returning({ id: avalancheForecasts.id });

		const problems = [
			{ num: 1, type: r.avalancheProblem1, desc: r.avalancheProblem1Description, rose: r.avalancheProblem1Rose },
			{ num: 2, type: r.avalancheProblem2, desc: r.avalancheProblem2Description, rose: r.avalancheProblem2Rose },
			{ num: 3, type: r.avalancheProblem3, desc: r.avalancheProblem3Description, rose: r.avalancheProblem3Rose },
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

		count++;
		if (count % 50 === 0) process.stdout.write(`\r  [db] ${count}/${records.length} upserted`);
	}

	console.log(`\n  [db] ${count} records upserted`);
	await client.end();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const zoneConfigs = JSON.parse(readFileSync(resolve(dataDir, "zone-config.json"), "utf8")) as ZoneConfig[];

console.log("=== UAC Historical Forecast Seeder ===");
console.log(`${zoneConfigs.length} zones × ${PAGES} pages ≈ ${zoneConfigs.length * PAGES} requests @ ${DELAY_MS}ms`);
console.log(`Estimated time: ~${Math.ceil((zoneConfigs.length * PAGES * DELAY_MS) / 60000)} min\n`);

const records = await fetchAllHistoricalForecasts(zoneConfigs);
console.log(`\n[fetch] ${records.length} unique forecast records`);

const file: HistoricalForecastsFile = {
	generated_at: new Date().toISOString(),
	page_count: PAGES,
	zone_count: zoneConfigs.length,
	records,
};
writeFileSync(outputPath, JSON.stringify(file, null, 2));
console.log(`[file]  → ${outputPath}`);

await upsertAll(records);

console.log("\n✅ Done. Next steps:");
console.log(
	'   1. Verify data: psql ... -c "SELECT zone_id, date_issued FROM avalanche_forecasts ORDER BY date_issued DESC LIMIT 20"',
);
console.log("   2. Commit data/black-diamond/historical-forecasts.json for production seeding");
console.log("   3. When ready to deploy: uncomment seedHistoricalData() in src/bases/http/app.ts");
