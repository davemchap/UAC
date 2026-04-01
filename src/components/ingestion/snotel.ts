import { getDb } from "../db";
import { snowpackReadings, snotelStations } from "../db/schema";

const SNOTEL_BASE = "https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1";
const SNOTEL_ELEMENTS = "SNWD,WTEQ,TOBS";
const LOOKBACK_DAYS = 7;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SnotelValue {
	date?: string;
	value?: number;
}

interface SnotelElement {
	stationElement?: { elementCode?: string; storedUnitCode?: string };
	values?: SnotelValue[];
}

interface SnotelStationData {
	stationTriplet?: string;
	data?: SnotelElement[];
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

async function fetchSnotelData(triplet: string, beginDate: string, endDate: string): Promise<SnotelStationData[]> {
	const params = new URLSearchParams({
		stationTriplets: triplet,
		elements: SNOTEL_ELEMENTS,
		duration: "DAILY",
		beginDate,
		endDate,
	});
	const url = `${SNOTEL_BASE}/data?${params.toString()}`;
	const res = await fetch(url, { method: "GET" });
	if (!res.ok) throw new Error(`SNOTEL fetch failed: ${res.status} ${res.statusText}`);
	return (await res.json()) as SnotelStationData[];
}

// ---------------------------------------------------------------------------
// Persist
// ---------------------------------------------------------------------------

async function persistSnowpackReadings(stations: SnotelStationData[]): Promise<void> {
	const db = getDb();
	for (const station of stations) {
		if (!station.stationTriplet || !station.data) continue;
		for (const element of station.data) {
			const code = element.stationElement?.elementCode;
			const unit = element.stationElement?.storedUnitCode;
			if (!code) continue;
			for (const reading of element.values ?? []) {
				if (!reading.date) continue;
				await db
					.insert(snowpackReadings)
					.values({
						stationTriplet: station.stationTriplet,
						date: reading.date,
						elementCode: code,
						value: reading.value ?? null,
						unitCode: unit ?? null,
					})
					.onConflictDoUpdate({
						target: [snowpackReadings.stationTriplet, snowpackReadings.date, snowpackReadings.elementCode],
						set: { value: reading.value ?? null },
					});
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Ingest all stations
// ---------------------------------------------------------------------------

export async function ingestAllSnotelStations(): Promise<void> {
	const db = getDb();
	const stations = await db.select({ triplet: snotelStations.triplet }).from(snotelStations);

	const endDate = formatDate(new Date());
	const begin = new Date();
	begin.setDate(begin.getDate() - LOOKBACK_DAYS);
	const beginDate = formatDate(begin);

	for (const station of stations) {
		try {
			const data = await fetchSnotelData(station.triplet, beginDate, endDate);
			await persistSnowpackReadings(data);
			console.log(`[snotel] Ingested station ${station.triplet}`);
		} catch (err) {
			console.error(`[snotel] Failed station ${station.triplet}:`, err);
		}
	}
}
