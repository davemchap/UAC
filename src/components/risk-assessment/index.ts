import type { ZoneSnapshot } from "../avalanche-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RiskAssessment {
	dangerLevel: number;
	dangerName: string;
	problems: string[];
	problemCount: number;
	bottomLine: string;
	currentTemp: number | null;
	tempUnit: string;
	snowDepthIn: number | null;
	hasDataGap: boolean;
}

// ---------------------------------------------------------------------------
// Danger level mapping
// ---------------------------------------------------------------------------

const DANGER_LEVELS: Record<string, number> = {
	None: 0,
	Low: 1,
	Moderate: 2,
	Considerable: 3,
	High: 4,
	Extreme: 5,
};

export function dangerNameToLevel(name: string): number {
	return DANGER_LEVELS[name] ?? 0;
}

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

export function assessZone(zone: ZoneSnapshot): RiskAssessment {
	// Use .at(0) so TypeScript infers Advisory | undefined correctly
	const advisory = zone.forecast.advisories.at(0)?.advisory;

	const dangerName = advisory?.overall_danger_rating ?? "Unknown";
	const dangerLevel = dangerNameToLevel(dangerName);

	const problems = [advisory?.avalanche_problem_1, advisory?.avalanche_problem_2, advisory?.avalanche_problem_3].filter(
		(p): p is string => typeof p === "string" && p.length > 0,
	);

	const currentPeriod = zone.weather !== null ? zone.weather.periods.at(0) : null;
	const currentTemp = currentPeriod?.temperature ?? null;
	const tempUnit = currentPeriod?.temperatureUnit ?? "F";

	// Snow depth: last reading from first station's first data element
	let snowDepthIn: number | null = null;
	const firstStation = zone.snowpack?.at(0);
	if (firstStation) {
		const vals = firstStation.data.at(0)?.values;
		if (vals && vals.length > 0) {
			snowDepthIn = vals.at(-1)?.value ?? null;
		}
	}

	const hasDataGap = advisory === undefined || zone.weather === null;

	return {
		dangerLevel,
		dangerName,
		problems,
		problemCount: problems.length,
		bottomLine: advisory?.bottom_line ?? "",
		currentTemp,
		tempUnit,
		snowDepthIn,
		hasDataGap,
	};
}
