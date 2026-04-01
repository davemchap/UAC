import type { ZoneSnapshot } from "../avalanche-data";
import type { SyntheticKey } from "./types";

// ---------------------------------------------------------------------------
// Synthetic ZoneSnapshot fixtures for edge-case eval cases
// ---------------------------------------------------------------------------

const NO_ADVISORY: ZoneSnapshot = {
	zone_id: 9999,
	forecast: { advisories: [] },
	weather: {
		periods: [
			{
				number: 1,
				name: "Tonight",
				startTime: "2024-01-01T18:00:00",
				temperature: 28,
				temperatureUnit: "F",
				shortForecast: "Clear",
				windSpeed: "5 mph",
				windDirection: "NW",
			},
		],
	},
	snowpack: null,
};

const NO_WEATHER: ZoneSnapshot = {
	zone_id: 9998,
	forecast: {
		advisories: [
			{
				advisory: {
					date_issued: "2024-01-01",
					overall_danger_rating: "Considerable",
					avalanche_problem_1: "Wind Slab",
					region: "synthetic",
				},
			},
		],
	},
	weather: null,
	snowpack: null,
};

const EXTREME_MULTI: ZoneSnapshot = {
	zone_id: 9997,
	forecast: {
		advisories: [
			{
				advisory: {
					date_issued: "2024-01-01",
					overall_danger_rating: "Extreme",
					avalanche_problem_1: "Slab",
					avalanche_problem_2: "Wind Slab",
					avalanche_problem_3: "Wet Avalanche",
					region: "synthetic",
				},
			},
		],
	},
	weather: {
		periods: [
			{
				number: 1,
				name: "Tonight",
				startTime: "2024-01-01T18:00:00",
				temperature: 15,
				temperatureUnit: "F",
				shortForecast: "Blizzard",
				windSpeed: "40 mph",
				windDirection: "N",
			},
		],
	},
	snowpack: null,
};

const LOW_MULTI: ZoneSnapshot = {
	zone_id: 9996,
	forecast: {
		advisories: [
			{
				advisory: {
					date_issued: "2024-01-01",
					overall_danger_rating: "Low",
					avalanche_problem_1: "Wind Slab",
					avalanche_problem_2: "Cornice",
					region: "synthetic",
				},
			},
		],
	},
	weather: {
		periods: [
			{
				number: 1,
				name: "Tonight",
				startTime: "2024-01-01T18:00:00",
				temperature: 32,
				temperatureUnit: "F",
				shortForecast: "Partly Cloudy",
				windSpeed: "10 mph",
				windDirection: "E",
			},
		],
	},
	snowpack: null,
};

const FIXTURES: Record<SyntheticKey, ZoneSnapshot> = {
	no_advisory: NO_ADVISORY,
	no_weather: NO_WEATHER,
	extreme_multi: EXTREME_MULTI,
	low_multi: LOW_MULTI,
};

export function getSyntheticFixture(key: SyntheticKey): ZoneSnapshot {
	return FIXTURES[key];
}
