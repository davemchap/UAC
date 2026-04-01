import { desc, eq } from "drizzle-orm";
import { getDb, queries } from "../db";
import { aiAlerts, avalancheForecasts, avalancheProblems } from "../db/schema";
import { generateStructuredAlert } from "../ai-alert";
import type { AiAlertInput } from "../ai-alert";

// ---------------------------------------------------------------------------
// Gather all data for a zone and generate an AI alert
// ---------------------------------------------------------------------------

async function gatherZoneData(zoneId: number): Promise<AiAlertInput | null> {
	const db = getDb();

	const zone = await queries.getZoneByZoneId(zoneId).then((rows) => rows.at(0));
	if (!zone) return null;

	const forecast = await db
		.select()
		.from(avalancheForecasts)
		.where(eq(avalancheForecasts.zoneId, zoneId))
		.orderBy(desc(avalancheForecasts.createdAt))
		.limit(1)
		.then((rows) => rows.at(0));

	if (!forecast) return null;

	const problems = await db
		.select({ problemType: avalancheProblems.problemType, description: avalancheProblems.description })
		.from(avalancheProblems)
		.where(eq(avalancheProblems.forecastId, forecast.id))
		.orderBy(avalancheProblems.problemNumber);

	const weatherRows = await queries.getWeatherReadings(zoneId);

	const stations = await queries.getSnotelStationsByZoneId(zoneId);
	const snowpackRows = [];
	for (const station of stations) {
		const readings = await queries.getSnowpackReadings(station.triplet);
		snowpackRows.push(...readings);
	}

	return {
		zoneName: zone.name,
		forecastNid: forecast.nid,
		bottomLine: forecast.bottomLine ?? "",
		currentConditions: forecast.currentConditions ?? "",
		problems,
		weather: weatherRows.map((w) => ({
			temperature: w.temperature,
			temperatureUnit: w.temperatureUnit,
			windSpeed: w.windSpeed,
			windDirection: w.windDirection,
			shortForecast: w.shortForecast,
		})),
		snowpack: snowpackRows.map((s) => ({
			stationTriplet: s.stationTriplet,
			date: s.date,
			elementCode: s.elementCode,
			value: s.value,
		})),
	};
}

// ---------------------------------------------------------------------------
// Generate and persist alert for a single zone
// ---------------------------------------------------------------------------

async function generateAndPersistAlert(zoneId: number): Promise<boolean> {
	const input = await gatherZoneData(zoneId);
	if (!input) {
		console.warn(`[alert-gen] No data available for zone ${zoneId}, skipping`);
		return false;
	}

	const alert = await generateStructuredAlert(input);

	const db = getDb();
	await db
		.insert(aiAlerts)
		.values({
			zoneId,
			dangerRating: alert.dangerRating,
			dangerLevel: alert.dangerLevel,
			dangerAboveTreelineRating: alert.dangerAboveTreelineRating,
			dangerAboveTreelineLevel: alert.dangerAboveTreelineLevel,
			dangerNearTreelineRating: alert.dangerNearTreelineRating,
			dangerNearTreelineLevel: alert.dangerNearTreelineLevel,
			dangerBelowTreelineRating: alert.dangerBelowTreelineRating,
			dangerBelowTreelineLevel: alert.dangerBelowTreelineLevel,
			avalancheProblems: alert.avalancheProblems,
			alertAction: alert.alertAction,
			alertReasoning: alert.alertReasoning,
			backcountrySummary: alert.backcountrySummary,
			model: alert.model,
			forecastNid: alert.forecastNid,
		})
		.onConflictDoUpdate({
			target: [aiAlerts.zoneId, aiAlerts.forecastNid],
			set: {
				dangerRating: alert.dangerRating,
				dangerLevel: alert.dangerLevel,
				dangerAboveTreelineRating: alert.dangerAboveTreelineRating,
				dangerAboveTreelineLevel: alert.dangerAboveTreelineLevel,
				dangerNearTreelineRating: alert.dangerNearTreelineRating,
				dangerNearTreelineLevel: alert.dangerNearTreelineLevel,
				dangerBelowTreelineRating: alert.dangerBelowTreelineRating,
				dangerBelowTreelineLevel: alert.dangerBelowTreelineLevel,
				avalancheProblems: alert.avalancheProblems,
				alertAction: alert.alertAction,
				alertReasoning: alert.alertReasoning,
				backcountrySummary: alert.backcountrySummary,
				model: alert.model,
			},
		});

	console.log(
		`[alert-gen] Zone ${zoneId} (${input.zoneName}): AI danger=${alert.dangerLevel} action=${alert.alertAction}`,
	);
	return true;
}

// ---------------------------------------------------------------------------
// Public: generate alerts for all zones
// ---------------------------------------------------------------------------

export async function generateAlertsForAllZones(): Promise<void> {
	const zones = await queries.getAllZones();
	let generated = 0;

	for (const zone of zones) {
		try {
			const ok = await generateAndPersistAlert(zone.zoneId);
			if (ok) generated++;
		} catch (err) {
			console.error(`[alert-gen] Failed zone ${zone.zoneId} (${zone.name}):`, err);
		}
	}

	console.log(`[alert-gen] Generated ${generated}/${zones.length} alerts`);
}
