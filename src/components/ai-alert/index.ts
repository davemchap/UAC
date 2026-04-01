import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiAlertInput {
	zoneName: string;
	forecastNid: string;
	bottomLine: string;
	currentConditions: string;
	problems: { problemType: string; description: string | null }[];
	weather: {
		temperature: number | null;
		temperatureUnit: string | null;
		windSpeed: string | null;
		windDirection: string | null;
		shortForecast: string | null;
	}[];
	snowpack: { stationTriplet: string; date: string; elementCode: string; value: number | null }[];
}

export interface AiAlertOutput {
	dangerRating: string;
	dangerLevel: number;
	dangerAboveTreelineRating: string;
	dangerAboveTreelineLevel: number;
	dangerNearTreelineRating: string;
	dangerNearTreelineLevel: number;
	dangerBelowTreelineRating: string;
	dangerBelowTreelineLevel: number;
	avalancheProblems: string[];
	alertAction: string;
	alertReasoning: string;
	backcountrySummary: string;
	model: string;
	forecastNid: string;
}

interface AiStructuredResponse {
	danger_level: number;
	danger_rating: string;
	danger_above_treeline_level: number;
	danger_above_treeline_rating: string;
	danger_near_treeline_level: number;
	danger_near_treeline_rating: string;
	danger_below_treeline_level: number;
	danger_below_treeline_rating: string;
	avalanche_problems: string[];
	alert_reasoning: string;
	backcountry_summary: string;
}

interface ThresholdEntry {
	danger_level: number;
	name: string;
	action: string;
}

interface ThresholdsFile {
	alert_thresholds: ThresholdEntry[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";

const VALID_RATINGS = ["None", "Low", "Moderate", "Considerable", "High", "Extreme"] as const;

const VALID_PROBLEMS = [
	"Wind Slab",
	"Storm Slab",
	"Persistent Slab",
	"Wet Slab",
	"Wet Loose",
	"Wet Snow",
	"Persistent Weak Layer",
	"Loose Dry",
	"Cornice",
	"Glide",
] as const;

// ---------------------------------------------------------------------------
// Thresholds (deterministic alert_action)
// ---------------------------------------------------------------------------

let _thresholds: ThresholdEntry[] | null = null;

function loadThresholds(): ThresholdEntry[] {
	if (_thresholds) return _thresholds;
	const filePath = resolve(process.cwd(), "data/black-diamond/alert-thresholds.json");
	_thresholds = (JSON.parse(readFileSync(filePath, "utf8")) as ThresholdsFile).alert_thresholds;
	return _thresholds;
}

function dangerLevelToAction(level: number): string {
	const entry = loadThresholds().find((t) => t.danger_level === level);
	return entry?.action ?? "no_alert";
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildPrompt(input: AiAlertInput): string {
	const problemLines =
		input.problems.length > 0
			? input.problems.map((p) => `- ${p.problemType}: ${p.description ?? "No description"}`).join("\n")
			: "No avalanche problems reported.";

	const weatherLines =
		input.weather.length > 0
			? input.weather
					.slice(0, 6)
					.map(
						(w) =>
							`- ${w.temperature ?? "?"}°${w.temperatureUnit ?? "F"}, wind ${w.windSpeed ?? "?"} ${w.windDirection ?? ""}, ${w.shortForecast ?? ""}`,
					)
					.join("\n")
			: "No weather data available.";

	const snowpackLines = input.snowpack.length > 0 ? formatSnowpackData(input.snowpack) : "No snowpack data available.";

	return `You are an avalanche danger assessment system. Analyze the following data for the ${input.zoneName} zone and produce a structured danger assessment.

## UAC Forecast Bottom Line
${input.bottomLine || "Not available."}

## UAC Current Conditions
${input.currentConditions || "Not available."}

## Avalanche Problems
${problemLines}

## NWS Weather (recent hourly periods)
${weatherLines}

## SNOTEL Snowpack Data
${snowpackLines}

## Instructions
IMPORTANT: The UAC Forecast Bottom Line is authoritative. If UAC indicates no avalanche danger, the season is over, forecasts are suspended, or conditions are safe (e.g. due to melt-off), you MUST set danger_level to 0 ("None") and avalanche_problems to an empty array. Do NOT invent danger from weather or snowpack data when UAC has determined there is no risk.

Based on ALL the data above, produce a JSON object with these fields:
- danger_level: integer 0-5 (0=None, 1=Low, 2=Moderate, 3=Considerable, 4=High, 5=Extreme)
- danger_rating: string matching the level ("None", "Low", "Moderate", "Considerable", "High", "Extreme")
- danger_above_treeline_level: integer 0-5
- danger_above_treeline_rating: string matching the level
- danger_near_treeline_level: integer 0-5
- danger_near_treeline_rating: string matching the level
- danger_below_treeline_level: integer 0-5
- danger_below_treeline_rating: string matching the level
- avalanche_problems: array of problem type names, normalized to these exact values: ${VALID_PROBLEMS.join(", ")}
- alert_reasoning: 2-3 sentences explaining why this danger level was assigned (ops-facing, reference specific data points)
- backcountry_summary: A concise SMS/push notification for backcountry travelers. MAX 280 characters. 1-2 sentences, plain language, no jargon, actionable. Must fit in a single tweet or SMS message.

Respond with ONLY the JSON object, no markdown fences, no extra text.`;
}

const ELEMENT_LABELS: Record<string, string> = {
	SNWD: "Snow Depth (in)",
	WTEQ: "Snow Water Equivalent (in)",
	TOBS: "Temperature (°F)",
};

function groupReadingsByStation(
	readings: AiAlertInput["snowpack"],
): Map<string, Map<string, { date: string; value: number | null }[]>> {
	const byStation = new Map<string, Map<string, { date: string; value: number | null }[]>>();
	for (const r of readings) {
		let station = byStation.get(r.stationTriplet);
		if (!station) {
			station = new Map();
			byStation.set(r.stationTriplet, station);
		}
		let values = station.get(r.elementCode);
		if (!values) {
			values = [];
			station.set(r.elementCode, values);
		}
		values.push({ date: r.date, value: r.value });
	}
	return byStation;
}

function formatSnowpackData(readings: AiAlertInput["snowpack"]): string {
	const byStation = groupReadingsByStation(readings);
	const lines: string[] = [];
	for (const [triplet, elements] of byStation) {
		lines.push(`Station ${triplet}:`);
		for (const [code, values] of elements) {
			const label = ELEMENT_LABELS[code] ?? code;
			const valStr = values.map((v) => `${v.date}: ${v.value ?? "?"}`).join(", ");
			lines.push(`  ${label}: ${valStr}`);
		}
	}
	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Claude call with structured output
// ---------------------------------------------------------------------------

const client = new Anthropic();

async function callClaude(prompt: string): Promise<AiStructuredResponse> {
	const message = await client.messages.create({
		model: MODEL,
		max_tokens: 1024,
		messages: [{ role: "user", content: prompt }],
	});
	const block = message.content.at(0);
	if (block?.type !== "text") throw new Error("Unexpected response type from Claude");

	const text = block.text.trim();
	// Strip markdown fences if AI includes them despite instructions
	const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
	return JSON.parse(cleaned) as AiStructuredResponse;
}

// ---------------------------------------------------------------------------
// Validation & normalization
// ---------------------------------------------------------------------------

function clampLevel(level: number): number {
	return Math.max(0, Math.min(5, Math.round(level)));
}

function levelToRating(level: number): string {
	return VALID_RATINGS[level] ?? "Moderate";
}

function normalizeResponse(raw: AiStructuredResponse): AiStructuredResponse {
	const dl = clampLevel(raw.danger_level);
	const atl = clampLevel(raw.danger_above_treeline_level);
	const ntl = clampLevel(raw.danger_near_treeline_level);
	const btl = clampLevel(raw.danger_below_treeline_level);

	return {
		danger_level: dl,
		danger_rating: levelToRating(dl),
		danger_above_treeline_level: atl,
		danger_above_treeline_rating: levelToRating(atl),
		danger_near_treeline_level: ntl,
		danger_near_treeline_rating: levelToRating(ntl),
		danger_below_treeline_level: btl,
		danger_below_treeline_rating: levelToRating(btl),
		avalanche_problems: normalizeProblems(raw.avalanche_problems),
		alert_reasoning: raw.alert_reasoning,
		backcountry_summary: raw.backcountry_summary,
	};
}

function normalizeProblems(problems: string[]): string[] {
	if (!Array.isArray(problems)) return [];

	const NORMALIZE_MAP: Record<string, string> = {
		"wind drifted snow": "Wind Slab",
		"wind slab": "Wind Slab",
		"storm slab": "Storm Slab",
		"persistent slab": "Persistent Slab",
		"persistent weak layer": "Persistent Weak Layer",
		"wet slab": "Wet Slab",
		"wet loose": "Wet Loose",
		"wet snow": "Wet Snow",
		"loose dry": "Loose Dry",
		"loose wet": "Wet Loose",
		cornice: "Cornice",
		glide: "Glide",
	};

	return problems
		.map((p) => NORMALIZE_MAP[p.toLowerCase().trim()] ?? p)
		.filter((p) => VALID_PROBLEMS.includes(p as (typeof VALID_PROBLEMS)[number]));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateStructuredAlert(input: AiAlertInput): Promise<AiAlertOutput> {
	const prompt = buildPrompt(input);
	const raw = await callClaude(prompt);
	const normalized = normalizeResponse(raw);

	return {
		dangerRating: normalized.danger_rating,
		dangerLevel: normalized.danger_level,
		dangerAboveTreelineRating: normalized.danger_above_treeline_rating,
		dangerAboveTreelineLevel: normalized.danger_above_treeline_level,
		dangerNearTreelineRating: normalized.danger_near_treeline_rating,
		dangerNearTreelineLevel: normalized.danger_near_treeline_level,
		dangerBelowTreelineRating: normalized.danger_below_treeline_rating,
		dangerBelowTreelineLevel: normalized.danger_below_treeline_level,
		avalancheProblems: normalized.avalanche_problems,
		alertAction: dangerLevelToAction(normalized.danger_level),
		alertReasoning: normalized.alert_reasoning,
		backcountrySummary: normalized.backcountry_summary,
		model: MODEL,
		forecastNid: input.forecastNid,
	};
}
