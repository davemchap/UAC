import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDb } from "./index";
import { alertThresholds, escalationRules, forecastZones, snotelStations } from "./schema";

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
