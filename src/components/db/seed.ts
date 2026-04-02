import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
// Types matching the JSON file structures
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

interface AlertThresholdsFile {
	alert_thresholds: { danger_level: number; name: string; action: string; description: string }[];
	escalation_rules: { condition: string; description: string; action: string }[];
}

// ---------------------------------------------------------------------------
// Load JSON files
// ---------------------------------------------------------------------------

const dataDir = resolve(process.cwd(), "data/black-diamond");

const zoneConfigs = JSON.parse(readFileSync(resolve(dataDir, "zone-config.json"), "utf8")) as ZoneConfig[];
const snapshot = JSON.parse(readFileSync(resolve(dataDir, "multi-zone-snapshot.json"), "utf8")) as Snapshot;
const thresholdsFile = JSON.parse(
	readFileSync(resolve(dataDir, "alert-thresholds.json"), "utf8"),
) as AlertThresholdsFile;

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error("DATABASE_URL is not set");
	process.exit(1);
}

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);

console.log("Seeding forecast_zones and snotel_stations...");

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

console.log("Seeding alert_thresholds and escalation_rules...");

for (const t of thresholdsFile.alert_thresholds) {
	await db
		.insert(alertThresholds)
		.values({ dangerLevel: t.danger_level, name: t.name, action: t.action, description: t.description })
		.onConflictDoUpdate({
			target: alertThresholds.dangerLevel,
			set: { name: t.name, action: t.action, description: t.description },
		});
}

for (const r of thresholdsFile.escalation_rules) {
	await db
		.insert(escalationRules)
		.values({ condition: r.condition, description: r.description, action: r.action })
		.onConflictDoUpdate({
			target: escalationRules.condition,
			set: { description: r.description, action: r.action },
		});
}

console.log("Seeding avalanche_forecasts, problems, weather_readings, snowpack_readings...");

for (const [slug, zoneData] of Object.entries(snapshot.zones)) {
	const advisory = zoneData.forecast.advisories.at(0)?.advisory;
	if (!advisory) {
		console.warn(`  No advisory for zone ${slug}, skipping forecast seed`);
		continue;
	}

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
		})
		.onConflictDoUpdate({
			target: [avalancheForecasts.zoneId, avalancheForecasts.nid],
			set: {
				overallDangerRating: advisory.overall_danger_rating,
				overallDangerRose: advisory.overall_danger_rose ?? null,
				updatedAt: new Date(),
			},
		})
		.returning({ id: avalancheForecasts.id });

	const forecastId = forecast.id;

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

	if (zoneData.weather?.periods) {
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

	if (zoneData.snowpack) {
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
}

console.log("Seed complete.");
await client.end();
