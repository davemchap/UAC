import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { count } from "drizzle-orm";
import { getDb } from "./index";
import {
	alertThresholds,
	avalancheForecasts,
	avalancheProblems,
	escalationRules,
	forecastZones,
	snowpackReadings,
	snotelStations,
	weatherReadings,
} from "./schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ZoneConfig {
	zone_id: number;
	name: string;
	slug: string;
	lat: number;
	lon: number;
	snotel: string[];
	forecast_url: string;
	api_url: string;
}

interface AlertThresholdsFile {
	alert_thresholds: { danger_level: number; name: string; action: string; description: string }[];
	escalation_rules: { condition: string; description: string; action: string }[];
}

interface Advisory {
	date_issued: string;
	date_issued_timestamp?: string;
	overall_danger_rating: string;
	overall_danger_rose?: string;
	avalanche_problem_1?: string;
	avalanche_problem_1_description?: string;
	danger_rose_1?: string;
	avalanche_problem_2?: string;
	avalanche_problem_2_description?: string;
	danger_rose_2?: string;
	avalanche_problem_3?: string;
	avalanche_problem_3_description?: string;
	danger_rose_3?: string;
	bottom_line?: string;
	current_conditions?: string;
	region: string;
	Nid: string;
	special_avalanche_bulletin?: string;
}

interface WeatherPeriod {
	number: number;
	startTime: string;
	endTime?: string;
	temperature?: number;
	temperatureUnit?: string;
	shortForecast?: string;
	windSpeed?: string;
	windDirection?: string;
	isDaytime?: boolean;
}

interface SnowpackElement {
	stationElement: { elementCode: string; storedUnitCode: string };
	values: { date: string; value: number }[];
}

interface SnowpackStation {
	stationTriplet: string;
	data: SnowpackElement[];
}

interface ZoneSnapshot {
	zone_id: number;
	forecast: { advisories: { advisory: Advisory }[] };
	weather: { periods: WeatherPeriod[] } | null;
	snowpack: SnowpackStation[] | null;
}

interface Snapshot {
	zones: Record<string, ZoneSnapshot>;
}

// ---------------------------------------------------------------------------
// Seed reference data (zones, SNOTEL stations, alert config)
// Called on every startup — safe to run repeatedly via upsert logic.
// ---------------------------------------------------------------------------

export async function seedReferenceData(): Promise<void> {
	const dataDir = resolve(process.cwd(), "data/black-diamond");
	const db = getDb();

	const zoneConfigs = JSON.parse(readFileSync(resolve(dataDir, "zone-config.json"), "utf8")) as ZoneConfig[];
	const thresholds = JSON.parse(readFileSync(resolve(dataDir, "alert-thresholds.json"), "utf8")) as AlertThresholdsFile;

	for (const zone of zoneConfigs) {
		await db
			.insert(forecastZones)
			.values({
				zoneId: zone.zone_id,
				name: zone.name,
				slug: zone.slug,
				lat: zone.lat,
				lon: zone.lon,
				forecastUrl: zone.forecast_url,
				apiUrl: zone.api_url,
			})
			.onConflictDoUpdate({
				target: forecastZones.zoneId,
				set: { name: zone.name, slug: zone.slug, lat: zone.lat, lon: zone.lon },
			});

		for (const triplet of zone.snotel) {
			await db.insert(snotelStations).values({ triplet, zoneId: zone.zone_id }).onConflictDoNothing();
		}
	}

	for (const t of thresholds.alert_thresholds) {
		await db
			.insert(alertThresholds)
			.values({ dangerLevel: t.danger_level, name: t.name, action: t.action, description: t.description })
			.onConflictDoUpdate({
				target: alertThresholds.dangerLevel,
				set: { name: t.name, action: t.action, description: t.description },
			});
	}

	for (const r of thresholds.escalation_rules) {
		await db
			.insert(escalationRules)
			.values({ condition: r.condition, description: r.description, action: r.action })
			.onConflictDoUpdate({
				target: escalationRules.condition,
				set: { description: r.description, action: r.action },
			});
	}

	console.log(
		`[db] Reference data seeded: ${zoneConfigs.length} zones, ${thresholds.alert_thresholds.length} thresholds`,
	);
}

// ---------------------------------------------------------------------------
// Seed snapshot forecast data — only if DB has no forecasts yet.
// Safe to call on every startup; skips if data already exists.
// ---------------------------------------------------------------------------

export async function seedSnapshotData(): Promise<void> {
	const db = getDb();

	const [{ value: existingCount }] = await db.select({ value: count() }).from(avalancheForecasts);
	if (existingCount > 0) {
		console.log(`[db] Snapshot seed skipped — ${existingCount} forecasts already present`);
		return;
	}

	const dataDir = resolve(process.cwd(), "data/black-diamond");
	const snapshot = JSON.parse(readFileSync(resolve(dataDir, "multi-zone-snapshot.json"), "utf8")) as Snapshot;

	for (const [slug, zoneData] of Object.entries(snapshot.zones)) {
		const advisory = zoneData.forecast.advisories.at(0)?.advisory;
		if (!advisory) {
			console.warn(`[db] No advisory for zone ${slug}, skipping`);
			continue;
		}
		await seedZoneSnapshot(db, advisory, zoneData);
	}

	console.log("[db] Snapshot data seeded from multi-zone-snapshot.json");
}

async function seedZoneSnapshot(
	db: ReturnType<typeof getDb>,
	advisory: Advisory,
	zoneData: ZoneSnapshot,
): Promise<void> {
	const [forecast] = await db
		.insert(avalancheForecasts)
		.values({
			zoneId: zoneData.zone_id,
			nid: advisory.Nid,
			dateIssued: advisory.date_issued,
			dateIssuedTimestamp: advisory.date_issued_timestamp ?? null,
			overallDangerRating: advisory.overall_danger_rating,
			overallDangerRose: advisory.overall_danger_rose ?? null,
			avalancheProblem1: advisory.avalanche_problem_1 ?? null,
			avalancheProblem2: advisory.avalanche_problem_2 ?? null,
			avalancheProblem3: advisory.avalanche_problem_3 ?? null,
			bottomLine: advisory.bottom_line ?? null,
			currentConditions: advisory.current_conditions ?? null,
			region: advisory.region,
			specialBulletin: advisory.special_avalanche_bulletin ?? null,
		})
		.onConflictDoUpdate({
			target: [avalancheForecasts.zoneId, avalancheForecasts.nid],
			set: { overallDangerRating: advisory.overall_danger_rating, updatedAt: new Date() },
		})
		.returning({ id: avalancheForecasts.id });

	await seedProblems(db, forecast.id, advisory);
	await seedWeather(db, zoneData);
	await seedSnowpack(db, zoneData);
}

async function seedProblems(db: ReturnType<typeof getDb>, forecastId: number, advisory: Advisory): Promise<void> {
	const problems = [
		{
			num: 1,
			type: advisory.avalanche_problem_1,
			desc: advisory.avalanche_problem_1_description,
			rose: advisory.danger_rose_1,
		},
		{
			num: 2,
			type: advisory.avalanche_problem_2,
			desc: advisory.avalanche_problem_2_description,
			rose: advisory.danger_rose_2,
		},
		{
			num: 3,
			type: advisory.avalanche_problem_3,
			desc: advisory.avalanche_problem_3_description,
			rose: advisory.danger_rose_3,
		},
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

async function seedWeather(db: ReturnType<typeof getDb>, zoneData: ZoneSnapshot): Promise<void> {
	if (!zoneData.weather?.periods) return;
	for (const period of zoneData.weather.periods) {
		await db
			.insert(weatherReadings)
			.values({
				zoneId: zoneData.zone_id,
				periodNumber: period.number,
				startTime: period.startTime,
				endTime: period.endTime ?? null,
				temperature: period.temperature ?? null,
				temperatureUnit: period.temperatureUnit ?? null,
				shortForecast: period.shortForecast ?? null,
				windSpeed: period.windSpeed ?? null,
				windDirection: period.windDirection ?? null,
				isDaytime: period.isDaytime ?? null,
			})
			.onConflictDoNothing();
	}
}

async function seedSnowpack(db: ReturnType<typeof getDb>, zoneData: ZoneSnapshot): Promise<void> {
	if (!zoneData.snowpack) return;
	for (const station of zoneData.snowpack) {
		for (const element of station.data) {
			for (const reading of element.values) {
				await db
					.insert(snowpackReadings)
					.values({
						stationTriplet: station.stationTriplet,
						date: reading.date,
						elementCode: element.stationElement.elementCode,
						value: reading.value,
						unitCode: element.stationElement.storedUnitCode,
					})
					.onConflictDoNothing();
			}
		}
	}
}
