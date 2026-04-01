#!/usr/bin/env bun
/**
 * eval-golden.ts
 *
 * Evaluates the AI ops briefing agent against all 18 golden dataset scenarios.
 *
 * For each scenario:
 *   1. Parses the raw forecast inputs (UAC / CAIC / NWAC/BTAC formats)
 *   2. Extracts: danger level, elevation breakdown, avalanche problems, alert action
 *   3. Generates an AI ops briefing using those inputs
 *   4. Scores the briefing against expected_outputs (the "ops-generated" ground truth)
 *
 * Scoring rubric (each check pass/fail):
 *   - danger_level_match:   Parsed danger level == expected danger level
 *   - problems_match:       All expected problems identified (no false negatives)
 *   - alert_action_match:   Computed alert_action == expected alert_action
 *   - briefing_names_danger: AI briefing mentions the correct danger rating name
 *   - briefing_names_problems: AI briefing mentions each expected problem by name
 *   - briefing_urgency_ok:  AI briefing urgency is consistent with alert action
 *
 * Run: bun scripts/eval-golden.ts
 * Run one: bun scripts/eval-golden.ts gs-004
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import alertThresholdsFile from "../data/black-diamond/alert-thresholds.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlertAction = "no_alert" | "human_review" | "auto_send" | "auto_send_urgent" | "flag_for_review";

interface ElevationBand {
	rating: string;
	level: number;
}
interface ElevationBreakdown {
	above_treeline: ElevationBand;
	near_treeline: ElevationBand;
	below_treeline: ElevationBand;
}

interface NormalizedInputs {
	zone_name: string;
	center: string;
	danger_rating: string;
	danger_level: number;
	danger_by_elevation: ElevationBreakdown;
	avalanche_problems: string[];
	bottom_line: string;
	hazard_discussion: string;
}

interface ExpectedOutputs {
	danger_rating: string;
	danger_level: number;
	danger_by_elevation: ElevationBreakdown;
	avalanche_problems: string[];
	alert_action: string;
	alert_reasoning: string;
}

interface EvalResult {
	scenario_id: string;
	scenario_name: string;
	center: string;
	// Parsed inputs
	parsed: NormalizedInputs;
	expected: ExpectedOutputs;
	computed_alert_action: AlertAction;
	// AI output
	ai_briefing: string | null;
	ai_model: string | null;
	prompt_version: string;
	// Scores
	scores: {
		danger_level_match: boolean;
		problems_no_false_negatives: boolean;
		extra_problems: string[]; // problems AI found not in expected (not necessarily wrong)
		missing_problems: string[]; // expected problems AI missed
		alert_action_match: boolean;
		briefing_names_danger: boolean;
		briefing_names_all_problems: boolean;
		briefing_urgency_ok: boolean;
		pass_count: number;
		total_checks: number;
	};
	error: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROMPT_VERSION = "v1.0";

const DANGER_LEVELS: Record<string, number> = {
	None: 0,
	Low: 1,
	Moderate: 2,
	Considerable: 3,
	High: 4,
	Extreme: 5,
};
const DANGER_NAMES: Record<number, string> = Object.fromEntries(Object.entries(DANGER_LEVELS).map(([k, v]) => [v, k]));

// CAIC camelCase → canonical
const CAIC_PROBLEM_MAP: Record<string, string> = {
	windSlab: "Wind Slab",
	persistentSlab: "Persistent Slab",
	stormSlab: "Storm Slab",
	wetSlab: "Wet Slab",
	deepPersistentSlab: "Deep Persistent Slab",
	looseDry: "Loose Dry",
	looseWet: "Wet Loose",
	cornice: "Cornice",
	glide: "Glide Avalanche",
	wetLoose: "Wet Loose",
};

// UAC raw strings → canonical
const UAC_PROBLEM_MAP: Record<string, string> = {
	"Wind Drifted Snow": "Wind Slab",
	"Wet Snow": "Wet Slab",
	"Persistent Weak Layer": "Persistent Slab",
	"New Snow": "Storm Slab",
	"Wet Loose": "Wet Loose",
	"Dry Loose": "Loose Dry",
	"Wind Slab": "Wind Slab",
	"Storm Slab": "Storm Slab",
	"Persistent Slab": "Persistent Slab",
	"Wet Slab": "Wet Slab",
	Cornice: "Cornice",
	Glide: "Glide Avalanche",
	"Normal Caution": "",
	Normal: "",
};

const ACTION_LADDER: AlertAction[] = ["no_alert", "human_review", "auto_send", "auto_send_urgent"];

// Words that signal appropriate urgency in AI output, per action
const URGENCY_SIGNALS: Record<string, string[]> = {
	no_alert: ["awareness", "monitor", "inform", "no alert", "no formal"],
	human_review: ["review", "required", "escalat", "human", "approval", "staff attention"],
	auto_send: ["alert", "dispatch", "auto", "high danger", "sent"],
	auto_send_urgent: ["urgent", "extreme", "immediate", "critical", "life-safety"],
};

// ---------------------------------------------------------------------------
// Alert action resolver (mirrors src/components/alerts)
// ---------------------------------------------------------------------------

function resolveAlertAction(dangerLevel: number, problemCount: number): AlertAction {
	const entry = alertThresholdsFile.alert_thresholds.find((t) => t.danger_level === dangerLevel);
	let action = (entry?.action ?? "no_alert") as AlertAction;
	if (problemCount >= 2) {
		const idx = ACTION_LADDER.indexOf(action);
		if (idx >= 0 && idx < ACTION_LADDER.length - 1) action = ACTION_LADDER[idx + 1];
	}
	return action;
}

// ---------------------------------------------------------------------------
// Format parsers
// ---------------------------------------------------------------------------

function levelToName(level: number): string {
	return DANGER_NAMES[level] ?? "Unknown";
}

// UAC: advisories[0].advisory
function parseUac(raw: Record<string, unknown>, zoneName: string): NormalizedInputs {
	type Advisory = Record<string, string | undefined>;
	const advisory = (raw.advisories as { advisory: Advisory }[])?.[0]?.advisory ?? {};

	const dangerRating = advisory.overall_danger_rating ?? "None";
	const dangerLevel = DANGER_LEVELS[dangerRating] ?? 0;

	// Parse elevation from overall_danger_rose (24 CSV values, groups of 8)
	function parseBand(vals: number[]): ElevationBand {
		const counts = new Map<number, number>();
		for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
		const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
		const level = Math.round(dominant / 2);
		return { rating: levelToName(level), level };
	}

	let dangerByElevation: ElevationBreakdown;
	const rose = advisory.overall_danger_rose;
	if (rose) {
		const vals = rose
			.split(",")
			.map(Number)
			.filter((n) => !Number.isNaN(n));
		if (vals.length >= 24) {
			dangerByElevation = {
				above_treeline: parseBand(vals.slice(0, 8)),
				near_treeline: parseBand(vals.slice(8, 16)),
				below_treeline: parseBand(vals.slice(16, 24)),
			};
		} else {
			dangerByElevation = {
				above_treeline: { rating: dangerRating, level: dangerLevel },
				near_treeline: { rating: dangerRating, level: dangerLevel },
				below_treeline: { rating: dangerRating, level: dangerLevel },
			};
		}
	} else {
		dangerByElevation = {
			above_treeline: { rating: dangerRating, level: dangerLevel },
			near_treeline: { rating: dangerRating, level: dangerLevel },
			below_treeline: { rating: dangerRating, level: dangerLevel },
		};
	}

	const rawProblems = [advisory.avalanche_problem_1, advisory.avalanche_problem_2, advisory.avalanche_problem_3].filter(
		(p): p is string => typeof p === "string" && p.trim().length > 0,
	);
	const problems = rawProblems.map((p) => UAC_PROBLEM_MAP[p] ?? p).filter((p) => p.length > 0);

	return {
		zone_name: zoneName,
		center: "UAC",
		danger_rating: dangerRating,
		danger_level: dangerLevel,
		danger_by_elevation: dangerByElevation,
		avalanche_problems: problems,
		bottom_line: advisory.bottom_line ?? "",
		hazard_discussion: advisory.current_conditions ?? "",
	};
}

// CAIC: dangerRatings.days[0].alp/tln/btl, avalancheProblems.days[0][].type
function parseCaic(raw: Record<string, unknown>, zoneName: string): NormalizedInputs {
	type DangerDay = { alp: string; tln: string; btl: string };
	const dayDanger = (raw.dangerRatings as { days: DangerDay[] })?.days?.[0] ?? { alp: "low", tln: "low", btl: "low" };

	function caicRatingToLevel(r: string): number {
		return DANGER_LEVELS[r.charAt(0).toUpperCase() + r.slice(1)] ?? 1;
	}

	const alpLevel = caicRatingToLevel(dayDanger.alp);
	const tlnLevel = caicRatingToLevel(dayDanger.tln);
	const btlLevel = caicRatingToLevel(dayDanger.btl);
	const overallLevel = Math.max(alpLevel, tlnLevel, btlLevel);

	const dangerByElevation: ElevationBreakdown = {
		above_treeline: { rating: levelToName(alpLevel), level: alpLevel },
		near_treeline: { rating: levelToName(tlnLevel), level: tlnLevel },
		below_treeline: { rating: levelToName(btlLevel), level: btlLevel },
	};

	type ProblemEntry = { type: string };
	const dayProblems = (raw.avalancheProblems as { days: ProblemEntry[][] })?.days?.[0] ?? [];
	const problems = dayProblems.map((p) => CAIC_PROBLEM_MAP[p.type] ?? p.type).filter((p) => p.length > 0);

	return {
		zone_name: zoneName,
		center: "CAIC",
		danger_rating: levelToName(overallLevel),
		danger_level: overallLevel,
		danger_by_elevation: dangerByElevation,
		avalanche_problems: problems,
		bottom_line: (raw.terrainAndTravelAdvice as string) ?? (raw.avalancheSummary as string) ?? "",
		hazard_discussion: (raw.avalancheSummary as string) ?? "",
	};
}

// NWAC/BTAC (avalanche.org): danger[0].upper/middle/lower, forecast_avalanche_problems[].name
function parseNwac(raw: Record<string, unknown>, zoneName: string, center: string): NormalizedInputs {
	type DangerEntry = { upper: number; middle: number; lower: number; valid_day: string };
	const currentDanger = ((raw.danger as DangerEntry[]) ?? []).find((d) => d.valid_day === "current") ??
		(raw.danger as DangerEntry[])?.[0] ?? { upper: 0, middle: 0, lower: 0, valid_day: "current" };

	const aboveLevel = currentDanger.upper ?? 0;
	const nearLevel = currentDanger.middle ?? 0;
	const belowLevel = currentDanger.lower ?? 0;
	const overallLevel = Math.max(aboveLevel, nearLevel, belowLevel);

	const dangerByElevation: ElevationBreakdown = {
		above_treeline: { rating: levelToName(aboveLevel), level: aboveLevel },
		near_treeline: { rating: levelToName(nearLevel), level: nearLevel },
		below_treeline: { rating: levelToName(belowLevel), level: belowLevel },
	};

	type ProblemEntry = { name: string };
	const problems = ((raw.forecast_avalanche_problems as ProblemEntry[]) ?? [])
		.map((p) => p.name)
		.filter((p) => typeof p === "string" && p.length > 0);

	return {
		zone_name: zoneName,
		center,
		danger_rating: levelToName(overallLevel),
		danger_level: overallLevel,
		danger_by_elevation: dangerByElevation,
		avalanche_problems: problems,
		bottom_line: (raw.bottom_line as string) ?? "",
		hazard_discussion: (raw.hazard_discussion as string) ?? "",
	};
}

function detectFormat(raw: Record<string, unknown>): "uac" | "caic" | "nwac" {
	if ("advisories" in raw) return "uac";
	if ("dangerRatings" in raw) return "caic";
	return "nwac";
}

function parseInputs(raw: Record<string, unknown>, zone: { name: string; center: string }): NormalizedInputs {
	const fmt = detectFormat(raw);
	if (fmt === "uac") return parseUac(raw, zone.name);
	if (fmt === "caic") return parseCaic(raw, zone.name);
	return parseNwac(raw, zone.name, zone.center);
}

// ---------------------------------------------------------------------------
// AI briefing prompt (ops persona, same as generate-briefings.ts)
// ---------------------------------------------------------------------------

const client = new Anthropic();

async function generateOpsBriefing(
	inputs: NormalizedInputs,
	alertAction: AlertAction,
): Promise<{ content: string; model: string }> {
	const ACTION_LABELS: Record<string, string> = {
		no_alert: "No Alert",
		human_review: "Review Required",
		auto_send: "Auto-Send",
		auto_send_urgent: "URGENT Auto-Send",
		flag_for_review: "Flagged – Missing Data",
	};

	const problemList = inputs.avalanche_problems.length > 0 ? inputs.avalanche_problems.join(", ") : "none identified";

	const elevLines = [
		`  Above treeline: ${inputs.danger_by_elevation.above_treeline.rating} (${inputs.danger_by_elevation.above_treeline.level}/5)`,
		`  Near treeline:  ${inputs.danger_by_elevation.near_treeline.rating} (${inputs.danger_by_elevation.near_treeline.level}/5)`,
		`  Below treeline: ${inputs.danger_by_elevation.below_treeline.rating} (${inputs.danger_by_elevation.below_treeline.level}/5)`,
	].join("\n");

	const prompt = `You are writing a pre-shift ops briefing for UAC Operations Staff arriving at 5am.
Translate the forecaster's assessment — do not re-analyze or add independent conclusions.
Be specific: name the danger level, elevation bands, and each problem by canonical type name.
State what alert action the system has taken and why.
2–4 sentences. Plain language, no jargon.

Zone: ${inputs.zone_name} (${inputs.center})
Overall danger: ${inputs.danger_rating} (Level ${inputs.danger_level}/5)
By elevation:
${elevLines}
Avalanche problems: ${problemList}
Alert action: ${ACTION_LABELS[alertAction]}
Forecaster bottom line: ${inputs.bottom_line || "Not provided"}`;

	const message = await client.messages.create({
		model: "claude-sonnet-4-6",
		max_tokens: 300,
		messages: [{ role: "user", content: prompt }],
	});

	const block = message.content.at(0);
	if (block?.type !== "text") throw new Error("Unexpected response type");
	return { content: block.text.trim(), model: message.model };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreResult(
	parsed: NormalizedInputs,
	expected: ExpectedOutputs,
	computedAction: AlertAction,
	briefing: string | null,
): EvalResult["scores"] {
	const dangerLevelMatch = parsed.danger_level === expected.danger_level;

	const parsedSet = new Set(parsed.avalanche_problems.map((p) => p.toLowerCase()));
	const expectedSet = new Set(expected.avalanche_problems.map((p) => p.toLowerCase()));
	const missingProblems = expected.avalanche_problems.filter((p) => !parsedSet.has(p.toLowerCase()));
	const extraProblems = parsed.avalanche_problems.filter((p) => !expectedSet.has(p.toLowerCase()));
	const problemsNoFalseNegatives = missingProblems.length === 0;

	const alertActionMatch = computedAction === expected.alert_action;

	const briefingLower = briefing?.toLowerCase() ?? "";
	const noAlertExpected = expected.alert_action === "no_alert";

	// For no_alert scenarios no briefing is generated — these checks pass vacuously
	const briefingNamesDanger =
		noAlertExpected && briefing === null
			? true
			: briefingLower.includes(expected.danger_rating.toLowerCase()) ||
				briefingLower.includes(`level ${expected.danger_level}`) ||
				briefingLower.includes(`${expected.danger_level}/5`);

	const briefingNamesAllProblems =
		noAlertExpected && briefing === null
			? true
			: expected.avalanche_problems.every(
					(p) =>
						briefingLower.includes(p.toLowerCase().replace(" slab", "").trim()) ||
						briefingLower.includes(p.toLowerCase()),
				);

	const signals = URGENCY_SIGNALS[expected.alert_action] ?? [];
	const briefingUrgencyOk =
		noAlertExpected && briefing === null ? true : signals.some((s) => briefingLower.includes(s));

	const checks = [
		dangerLevelMatch,
		problemsNoFalseNegatives,
		alertActionMatch,
		briefingNamesDanger,
		briefingNamesAllProblems,
		briefingUrgencyOk,
	];

	return {
		danger_level_match: dangerLevelMatch,
		problems_no_false_negatives: problemsNoFalseNegatives,
		missing_problems: missingProblems,
		extra_problems: extraProblems,
		alert_action_match: alertActionMatch,
		briefing_names_danger: briefingNamesDanger,
		briefing_names_all_problems: briefingNamesAllProblems,
		briefing_urgency_ok: briefingUrgencyOk,
		pass_count: checks.filter(Boolean).length,
		total_checks: checks.length,
	};
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const filter = process.argv[2]; // optional: "gs-004"
	const datasetDir = resolve(process.cwd(), "data/shared/golden-datasets");
	const files = readdirSync(datasetDir)
		.filter((f) => f.endsWith(".json") && f.startsWith("gs-"))
		.filter((f) => !filter || f.includes(filter))
		.sort();

	console.log(`\n[eval] Running against ${files.length} golden dataset scenario(s)\n`);

	const results: EvalResult[] = [];

	for (const file of files) {
		const scenario = JSON.parse(readFileSync(join(datasetDir, file), "utf8")) as {
			scenario_id: string;
			scenario_name: string;
			zone: { name: string; center: string };
			inputs: { forecast_raw: Record<string, unknown> };
			expected_outputs: ExpectedOutputs;
		};

		process.stdout.write(`  ${scenario.scenario_id}  ${scenario.scenario_name} ... `);

		const result: EvalResult = {
			scenario_id: scenario.scenario_id,
			scenario_name: scenario.scenario_name,
			center: scenario.zone.center,
			parsed: {} as NormalizedInputs,
			expected: scenario.expected_outputs,
			computed_alert_action: "no_alert",
			ai_briefing: null,
			ai_model: null,
			prompt_version: PROMPT_VERSION,
			scores: {
				danger_level_match: false,
				problems_no_false_negatives: false,
				missing_problems: [],
				extra_problems: [],
				alert_action_match: false,
				briefing_names_danger: false,
				briefing_names_all_problems: false,
				briefing_urgency_ok: false,
				pass_count: 0,
				total_checks: 6,
			},
			error: null,
		};

		try {
			const parsed = parseInputs(scenario.inputs.forecast_raw, scenario.zone);
			const computedAction = resolveAlertAction(parsed.danger_level, parsed.avalanche_problems.length);
			result.parsed = parsed;
			result.computed_alert_action = computedAction;

			// Only call AI for scenarios where ops needs a briefing
			if (computedAction !== "no_alert" || scenario.expected_outputs.alert_action !== "no_alert") {
				const { content, model } = await generateOpsBriefing(parsed, computedAction);
				result.ai_briefing = content;
				result.ai_model = model;
			}

			result.scores = scoreResult(parsed, scenario.expected_outputs, computedAction, result.ai_briefing);
			const pct = Math.round((result.scores.pass_count / result.scores.total_checks) * 100);
			console.log(`${result.scores.pass_count}/${result.scores.total_checks} (${pct}%)`);
		} catch (err) {
			result.error = String(err);
			console.log(`ERROR: ${err}`);
		}

		results.push(result);
	}

	// Write full JSON output
	mkdirSync(resolve(process.cwd(), "data/eval-output"), { recursive: true });
	const runDate = new Date().toISOString().slice(0, 10);
	const outPath = resolve(process.cwd(), `data/eval-output/eval-golden-${runDate}.json`);
	writeFileSync(outPath, JSON.stringify({ run_date: runDate, prompt_version: PROMPT_VERSION, results }, null, 2));

	// Print summary table
	console.log("\n─────────────────────────────────────────────────────────────────────────────────");
	console.log("Scenario       | Center | Danger         | Action        | Score | Issues");
	console.log("─────────────────────────────────────────────────────────────────────────────────");

	let totalPass = 0;
	let totalChecks = 0;

	for (const r of results) {
		if (r.error) {
			console.log(`${r.scenario_id.padEnd(14)} | ${r.center.padEnd(6)} | ERROR: ${r.error.slice(0, 40)}`);
			continue;
		}
		const s = r.scores;
		const dangerStr = `${r.parsed.danger_rating} (${r.parsed.danger_level})`.padEnd(14);
		const actionStr = r.computed_alert_action.padEnd(13);
		const scoreStr = `${s.pass_count}/${s.total_checks}`;
		const issues: string[] = [];
		if (!s.danger_level_match) issues.push(`danger:got ${r.parsed.danger_level} want ${r.expected.danger_level}`);
		if (!s.alert_action_match) issues.push(`action:got ${r.computed_alert_action} want ${r.expected.alert_action}`);
		if (s.missing_problems.length > 0) issues.push(`missing:[${s.missing_problems.join(",")}]`);
		if (!s.briefing_names_danger) issues.push("briefing:no danger name");
		if (!s.briefing_names_all_problems) issues.push("briefing:missing problems");
		if (!s.briefing_urgency_ok) issues.push("briefing:wrong urgency");

		console.log(
			`${r.scenario_id.padEnd(14)} | ${r.center.padEnd(6)} | ${dangerStr} | ${actionStr} | ${scoreStr.padEnd(5)} | ${issues.join("; ") || "✓"}`,
		);
		totalPass += s.pass_count;
		totalChecks += s.total_checks;
	}

	const overallPct = totalChecks > 0 ? Math.round((totalPass / totalChecks) * 100) : 0;
	console.log("─────────────────────────────────────────────────────────────────────────────────");
	console.log(`Overall: ${totalPass}/${totalChecks} checks passed (${overallPct}%)`);
	console.log(`\nFull results: ${outPath}\n`);
}

void main();
