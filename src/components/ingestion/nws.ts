import { getDb } from "../db";
import { forecastZones, weatherReadings } from "../db/schema";

const NWS_USER_AGENT = "UAC-Alert-Engine (shipsummit@example.com)";
const NWS_BASE = "https://api.weather.gov";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NwsGridPoint {
	gridId: string;
	gridX: number;
	gridY: number;
}

interface NwsPointsResponse {
	properties?: {
		gridId?: string;
		gridX?: number;
		gridY?: number;
	};
}

interface NwsHourlyPeriod {
	number?: number;
	startTime?: string;
	endTime?: string;
	temperature?: number;
	temperatureUnit?: string;
	shortForecast?: string;
	windSpeed?: string;
	windDirection?: string;
	isDaytime?: boolean;
}

interface NwsHourlyResponse {
	properties?: {
		periods?: NwsHourlyPeriod[];
	};
}

// ---------------------------------------------------------------------------
// Grid point cache (in-memory, keyed by zone_id)
// ---------------------------------------------------------------------------

const gridPointCache = new Map<number, NwsGridPoint>();

async function resolveGridPoint(zoneId: number, lat: number, lon: number): Promise<NwsGridPoint> {
	const cached = gridPointCache.get(zoneId);
	if (cached) return cached;

	const res = await fetch(`${NWS_BASE}/points/${lat},${lon}`, {
		method: "GET",
		headers: { "User-Agent": NWS_USER_AGENT },
	});
	if (!res.ok) throw new Error(`NWS /points failed: ${res.status} ${res.statusText}`);

	const data = (await res.json()) as NwsPointsResponse;
	const props = data.properties;

	if (!props?.gridId || props.gridX === undefined || props.gridY === undefined) {
		throw new Error(`NWS /points for zone ${zoneId} returned incomplete grid data`);
	}

	const gridPoint: NwsGridPoint = { gridId: props.gridId, gridX: props.gridX, gridY: props.gridY };
	gridPointCache.set(zoneId, gridPoint);
	return gridPoint;
}

// ---------------------------------------------------------------------------
// Fetch hourly forecast
// ---------------------------------------------------------------------------

async function fetchHourlyForecast(gridPoint: NwsGridPoint): Promise<NwsHourlyPeriod[]> {
	const url = `${NWS_BASE}/gridpoints/${gridPoint.gridId}/${gridPoint.gridX},${gridPoint.gridY}/forecast/hourly`;
	const res = await fetch(url, {
		method: "GET",
		headers: { "User-Agent": NWS_USER_AGENT },
	});
	if (!res.ok) throw new Error(`NWS hourly forecast failed: ${res.status} ${res.statusText}`);
	const data = (await res.json()) as NwsHourlyResponse;
	return data.properties?.periods ?? [];
}

// ---------------------------------------------------------------------------
// Persist
// ---------------------------------------------------------------------------

async function persistWeatherReadings(zoneId: number, periods: NwsHourlyPeriod[]): Promise<void> {
	const db = getDb();
	for (const period of periods) {
		if (!period.startTime) continue;
		await db
			.insert(weatherReadings)
			.values({
				zoneId,
				periodNumber: period.number ?? 0,
				startTime: period.startTime,
				endTime: period.endTime ?? null,
				temperature: period.temperature ?? null,
				temperatureUnit: period.temperatureUnit ?? null,
				shortForecast: period.shortForecast ?? null,
				windSpeed: period.windSpeed ?? null,
				windDirection: period.windDirection ?? null,
				isDaytime: period.isDaytime ?? null,
			})
			.onConflictDoUpdate({
				target: [weatherReadings.zoneId, weatherReadings.startTime],
				set: {
					temperature: period.temperature ?? null,
					shortForecast: period.shortForecast ?? null,
					windSpeed: period.windSpeed ?? null,
					windDirection: period.windDirection ?? null,
				},
			});
	}
}

// ---------------------------------------------------------------------------
// Ingest all zones
// ---------------------------------------------------------------------------

export async function ingestAllNwsZones(): Promise<void> {
	const db = getDb();
	const zones = await db
		.select({ zoneId: forecastZones.zoneId, lat: forecastZones.lat, lon: forecastZones.lon })
		.from(forecastZones);

	for (const zone of zones) {
		try {
			const gridPoint = await resolveGridPoint(zone.zoneId, zone.lat, zone.lon);
			const periods = await fetchHourlyForecast(gridPoint);
			await persistWeatherReadings(zone.zoneId, periods);
			console.log(`[nws] Ingested zone ${zone.zoneId} (${periods.length} periods)`);
		} catch (err) {
			console.error(`[nws] Failed zone ${zone.zoneId}:`, err);
		}
	}
}
