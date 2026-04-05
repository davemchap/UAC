/**
 * Golden dataset loader for the scorecard.
 * Parses the 18 curated test scenarios from data/shared/golden-datasets/
 * and returns them in the same shape as ForecastForScoring so the scorecard
 * route can score them without any DB dependency.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ForecastForScoring } from "./queries";

export interface GoldenScenario extends ForecastForScoring {
	scenarioId: string;
	scenarioName: string;
	center: string;
	dangerLevel: number;
	alertAction: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asStr(v: unknown): string {
	return typeof v === "string" ? v : "";
}

function asNum(v: unknown): number {
	return typeof v === "number" ? v : 0;
}

function asArr(v: unknown): unknown[] {
	return Array.isArray(v) ? v : [];
}

function asObj(v: unknown): Record<string, unknown> {
	return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

// Strip HTML tags — replace open/close brackets individually to avoid regex backtracking
function stripHtml(html: string): string {
	return html
		.split("<")
		.map((chunk, i) => (i === 0 ? chunk : chunk.slice(chunk.indexOf(">") + 1)))
		.join(" ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/[ \t]{2,}/g, " ")
		.trim();
}

// ---------------------------------------------------------------------------
// Format-specific parsers
// ---------------------------------------------------------------------------

interface ParsedForecast {
	forecasterName: string;
	dateIssued: string;
	overallDangerRating: string;
	bottomLine: string;
	currentConditions: string;
	problems: string[];
}

// UAC native: advisories[].advisory
function parseUac(raw: Record<string, unknown>, expected: Record<string, unknown>): ParsedForecast {
	const advisories = asArr(raw.advisories);
	const advisory = asObj(asObj(advisories[0]).advisory);
	const rawDate = asStr(advisory.date_issued);
	// Parse "Monday, March 9, 2026 - 6:03am" → ISO date using indexOf approach
	const commaIdx = rawDate.indexOf(",");
	const dateStr = commaIdx !== -1 ? rawDate.slice(commaIdx + 2).split(" - ")[0] : rawDate;
	const parsed = new Date(dateStr);
	const dateIssued = Number.isNaN(parsed.getTime()) ? rawDate.slice(0, 10) : parsed.toISOString().slice(0, 10);
	return {
		forecasterName: asStr(advisory.forecaster) || "UAC",
		dateIssued,
		overallDangerRating: asStr(advisory.overall_danger_rating) || asStr(expected.danger_rating),
		bottomLine: stripHtml(asStr(advisory.bottom_line)),
		currentConditions: stripHtml(asStr(advisory.current_conditions)),
		problems: [advisory.avalanche_problem_1, advisory.avalanche_problem_2, advisory.avalanche_problem_3]
			.map(asStr)
			.filter(Boolean),
	};
}

// CAIC AVID: avalancheSummary.days[].content, dangerRatings.days[]
function parseCaic(raw: Record<string, unknown>, expected: Record<string, unknown>): ParsedForecast {
	const dateIssued = asStr(raw.issueDateTime).slice(0, 10);
	const avalancheDays = asArr(asObj(raw.avalancheSummary).days);
	const bottomLine = stripHtml(asStr(asObj(avalancheDays[0]).content));
	const snowpackDays = asArr(asObj(raw.snowpackSummary).days);
	const currentConditions = stripHtml(asStr(asObj(snowpackDays[0]).content));
	const dangerDays = asArr(asObj(raw.dangerRatings).days);
	const dayDanger = asObj(dangerDays[0]);
	const rawDanger = asStr(dayDanger.alp) || asStr(dayDanger.tln);
	const overallDangerRating = rawDanger
		? rawDanger.charAt(0).toUpperCase() + rawDanger.slice(1)
		: asStr(expected.danger_rating);
	return {
		forecasterName: asStr(raw.forecaster) || "CAIC",
		dateIssued,
		overallDangerRating,
		bottomLine,
		currentConditions,
		problems: asArr(expected.avalanche_problems).map(asStr).filter(Boolean),
	};
}

// avalanche.org product detail (NWAC/BTAC): bottom_line, hazard_discussion, danger[]
function parseAvalancheOrg(raw: Record<string, unknown>, expected: Record<string, unknown>): ParsedForecast {
	const dateIssued = asStr(raw.published_time).slice(0, 10);
	const bottomLine = stripHtml(asStr(raw.bottom_line));
	const currentConditions = stripHtml(asStr(raw.hazard_discussion));
	const dangerArr = asArr(raw.danger);
	const d = asObj(dangerArr[0]);
	const topDanger = Math.max(asNum(d.upper), asNum(d.middle));
	const dangerLabels: Record<number, string> = { 1: "Low", 2: "Moderate", 3: "Considerable", 4: "High", 5: "Extreme" };
	const overallDangerRating = dangerLabels[topDanger] ?? asStr(expected.danger_rating);
	const problemsRaw = asArr(raw.forecast_avalanche_problems);
	const problems =
		problemsRaw.length > 0
			? problemsRaw.map((p) => asStr(asObj(p).name)).filter(Boolean)
			: asArr(expected.avalanche_problems).map(asStr).filter(Boolean);
	return {
		forecasterName: asStr(raw.author) || "Forecaster",
		dateIssued,
		overallDangerRating,
		bottomLine,
		currentConditions,
		problems,
	};
}

// ---------------------------------------------------------------------------
// Main loader
// ---------------------------------------------------------------------------

const GOLDEN_DIR = join(import.meta.dir, "../../../data/shared/golden-datasets");

export function loadGoldenScenarios(): GoldenScenario[] {
	const files = readdirSync(GOLDEN_DIR)
		.filter((f) => f.endsWith(".json"))
		.sort((a, b) => a.localeCompare(b));

	const scenarios: GoldenScenario[] = [];
	let syntheticId = 9000;

	for (const file of files) {
		try {
			const raw = JSON.parse(readFileSync(join(GOLDEN_DIR, file), "utf8")) as Record<string, unknown>;
			const inputs = asObj(raw.inputs);
			const forecastRaw = asObj(inputs.forecast_raw);
			const expected = asObj(raw.expected_outputs);
			const zone = asObj(raw.zone);

			let parsed: ParsedForecast;
			if (forecastRaw.advisories) {
				parsed = parseUac(forecastRaw, expected);
			} else if (forecastRaw.issueDateTime) {
				parsed = parseCaic(forecastRaw, expected);
			} else {
				parsed = parseAvalancheOrg(forecastRaw, expected);
			}

			const zoneName = asStr(zone.name) || "Unknown Zone";
			const center = asStr(zone.center) || "?";
			const zoneSlug = asStr(raw.scenario_id).replace("gs-", "golden-");

			scenarios.push({
				scenarioId: asStr(raw.scenario_id),
				scenarioName: asStr(raw.scenario_name),
				center,
				dangerLevel: asNum(expected.danger_level),
				alertAction: asStr(expected.alert_action) || "unknown",
				id: syntheticId++,
				zoneId: syntheticId,
				zoneName: `${zoneName} (${center})`,
				zoneSlug,
				forecasterName: parsed.forecasterName || null,
				dateIssued: parsed.dateIssued,
				overallDangerRating: parsed.overallDangerRating,
				bottomLine: parsed.bottomLine || null,
				currentConditions: parsed.currentConditions || null,
				avalancheProblem1: parsed.problems[0] ?? null,
				avalancheProblem2: parsed.problems[1] ?? null,
				avalancheProblem3: parsed.problems[2] ?? null,
			});
		} catch {
			// Skip malformed files silently
		}
	}

	return scenarios;
}
