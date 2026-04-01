import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Raw snapshot types
// ---------------------------------------------------------------------------

export interface SnowpackReading {
	date: string;
	value: number;
}

export interface SnowpackDataElement {
	elementCd: string;
	values: SnowpackReading[];
}

export interface SnowpackStation {
	stationTriplet: string;
	data: SnowpackDataElement[];
}

export interface Advisory {
	date_issued: string;
	overall_danger_rating: string;
	avalanche_problem_1?: string;
	avalanche_problem_2?: string;
	avalanche_problem_3?: string;
	bottom_line?: string;
	current_conditions?: string;
	region: string;
}

export interface WeatherPeriod {
	number: number;
	name: string;
	startTime: string;
	temperature: number;
	temperatureUnit: string;
	shortForecast: string;
	windSpeed: string;
	windDirection: string;
}

export interface ZoneSnapshot {
	zone_id: number;
	forecast: {
		advisories: { advisory: Advisory }[];
	};
	weather: { periods: WeatherPeriod[] } | null;
	snowpack: SnowpackStation[] | null;
}

export interface Snapshot {
	snapshot_date: string;
	zones: Record<string, ZoneSnapshot>;
}

export interface ZoneConfig {
	zone_id: number;
	name: string;
	slug: string;
	lat: number;
	lon: number;
	snotel: string[];
	forecast_url: string;
	api_url: string;
}

// ---------------------------------------------------------------------------
// Lazy singletons
// ---------------------------------------------------------------------------

let _snapshot: Snapshot | null = null;
let _zoneConfig: ZoneConfig[] | null = null;

export function loadSnapshot(): Snapshot {
	if (_snapshot) return _snapshot;
	const filePath = resolve(process.cwd(), "data/black-diamond/multi-zone-snapshot.json");
	_snapshot = JSON.parse(readFileSync(filePath, "utf8")) as Snapshot;
	return _snapshot;
}

export function loadZoneConfig(): ZoneConfig[] {
	if (_zoneConfig) return _zoneConfig;
	const filePath = resolve(process.cwd(), "data/black-diamond/zone-config.json");
	_zoneConfig = JSON.parse(readFileSync(filePath, "utf8")) as ZoneConfig[];
	return _zoneConfig;
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

export function getAllZoneSlugs(): string[] {
	return Object.keys(loadSnapshot().zones);
}

export function getZoneData(slug: string): ZoneSnapshot | null {
	return loadSnapshot().zones[slug] ?? null;
}

export function getSnapshotDate(): string {
	return loadSnapshot().snapshot_date;
}
