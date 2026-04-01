#!/usr/bin/env bun
/**
 * generate-briefings.ts
 *
 * One-shot eval script:
 *   1. Fetches live UAC forecast data for all 9 zones
 *   2. Normalizes output to match golden dataset structure
 *   3. Calls AI to generate ops briefing for zones that need it
 *   4. Writes results to data/eval-output/briefings-<date>.json
 *
 * Run: bun scripts/generate-briefings.ts
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import zoneConfig from "../data/black-diamond/zone-config.json";
import alertThresholdsFile from "../data/black-diamond/alert-thresholds.json";

// ---------------------------------------------------------------------------
// Types matching golden dataset expected_outputs structure
// ---------------------------------------------------------------------------

interface ElevationBand {
	rating: string;
	level: number;
}

interface BriefingOutput {
	zone_slug: string;
	zone_name: string;
	fetched_at: string;
	danger_rating: string;
	danger_level: number;
	danger_by_elevation: {
		above_treeline: ElevationBand;
		near_treeline: ElevationBand;
		below_treeline: ElevationBand;
	};
	avalanche_problems: string[];
	alert_action: string;
	alert_reasoning: string;
	bottom_line: string;
	ai_briefing: string | null;
	ai_model: string | null;
	prompt_version: string;
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

// UAC raw problem names → canonical golden dataset names
const PROBLEM_NORMALIZATION: Record<string, string> = {
	"Wind Drifted Snow": "Wind Slab",
	"Wet Snow": "Wet Slab",
	"Persistent Weak Layer": "Persistent Slab",
	"New Snow": "Storm Slab",
	"Wet Loose": "Wet Slab",
	"Dry Loose": "Loose Dry",
	"Wind Slab": "Wind Slab",
	"Storm Slab": "Storm Slab",
	"Persistent Slab": "Persistent Slab",
	"Deep Persistent Slab": "Deep Persistent Slab",
	"Wet Slab": "Wet Slab",
	Cornice: "Cornice",
	Glide: "Glide Avalanche",
	Normal: "Normal Caution",
	"Normal Caution": "Normal Caution",
};

const ACTION_LABELS: Record<string, string> = {
	no_alert: "No Alert",
	human_review: "Review Required",
	auto_send: "Auto-Send",
	auto_send_urgent: "URGENT Auto-Send",
	flag_for_review: "Flagged – Missing Data",
};

// ---------------------------------------------------------------------------
// Danger rose parser
//
// UAC overall_danger_rose: 24 comma-separated values
// Encoding: value = danger_level * 2  (so 4 = Moderate, 6 = Considerable)
// Layout: 8 values per elevation band → [above(0-7), near(8-15), below(16-23)]
// Each group of 8 covers the 8 compass directions (N, NE, E, SE, S, SW, W, NW)
// ---------------------------------------------------------------------------

function parseElevationBand(values: number[]): ElevationBand {
	const counts = new Map<number, number>();
	for (const v of values) {
		counts.set(v, (counts.get(v) ?? 0) + 1);
	}
	const dominantRaw = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
	const level = Math.round(dominantRaw / 2);
	return { rating: DANGER_NAMES[level] ?? "Unknown", level };
}

function parseDangerRose(
	rose: string | null | undefined,
	overallRating: string,
): { above_treeline: ElevationBand; near_treeline: ElevationBand; below_treeline: ElevationBand } {
	const fallback = {
		above_treeline: { rating: overallRating, level: DANGER_LEVELS[overallRating] ?? 0 },
		near_treeline: { rating: overallRating, level: DANGER_LEVELS[overallRating] ?? 0 },
		below_treeline: { rating: overallRating, level: DANGER_LEVELS[overallRating] ?? 0 },
	};

	if (!rose) return fallback;
	const vals = rose
		.split(",")
		.map(Number)
		.filter((n) => !Number.isNaN(n));
	if (vals.length < 24) return fallback;

	return {
		above_treeline: parseElevationBand(vals.slice(0, 8)),
		near_treeline: parseElevationBand(vals.slice(8, 16)),
		below_treeline: parseElevationBand(vals.slice(16, 24)),
	};
}

// ---------------------------------------------------------------------------
// Alert action from thresholds (mirrors src/components/alerts/index.ts)
// ---------------------------------------------------------------------------

type AlertAction = "no_alert" | "human_review" | "auto_send" | "auto_send_urgent" | "flag_for_review";
const ACTION_LADDER: AlertAction[] = ["no_alert", "human_review", "auto_send", "auto_send_urgent"];

function resolveAlertAction(dangerLevel: number, problemCount: number): { action: AlertAction; reasoning: string } {
	const thresholdEntry = alertThresholdsFile.alert_thresholds.find((t) => t.danger_level === dangerLevel);
	let action = (thresholdEntry?.action ?? "no_alert") as AlertAction;
	let reasoning = thresholdEntry?.description ?? "No alert generated";
	if (problemCount >= 2) {
		const idx = ACTION_LADDER.indexOf(action);
		if (idx >= 0 && idx < ACTION_LADDER.length - 1) {
			action = ACTION_LADDER[idx + 1];
			reasoning += ` — escalated due to ${problemCount} concurrent avalanche problems`;
		}
	}
	return { action, reasoning };
}

// ---------------------------------------------------------------------------
// AI briefing prompt (ops persona)
// ---------------------------------------------------------------------------

const client = new Anthropic();

async function generateOpsBriefing(
	zoneName: string,
	dangerRating: string,
	dangerLevel: number,
	dangerByElevation: ReturnType<typeof parseDangerRose>,
	problems: string[],
	alertAction: string,
	alertReasoning: string,
	bottomLine: string,
): Promise<{ content: string; model: string }> {
	const problemList = problems.length > 0 ? problems.join(", ") : "none identified";
	const elevLines = [
		`  Above treeline: ${dangerByElevation.above_treeline.rating} (${dangerByElevation.above_treeline.level}/5)`,
		`  Near treeline:  ${dangerByElevation.near_treeline.rating} (${dangerByElevation.near_treeline.level}/5)`,
		`  Below treeline: ${dangerByElevation.below_treeline.rating} (${dangerByElevation.below_treeline.level}/5)`,
	].join("\n");

	const prompt = `You are writing a pre-shift ops briefing for UAC Operations Staff arriving at 5am.
Translate the forecaster's assessment — do not re-analyze or add independent conclusions.
Be specific: name the danger level, elevation bands, and each problem by type.
State what alert action the system has taken and why.
2–4 sentences. Plain language, no jargon.

Zone: ${zoneName}
Overall danger: ${dangerRating} (Level ${dangerLevel}/5)
By elevation:
${elevLines}
Avalanche problems: ${problemList}
Alert action: ${ACTION_LABELS[alertAction] ?? alertAction}
Alert reasoning: ${alertReasoning}
Forecaster bottom line: ${bottomLine || "Not provided"}`;

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
// Fetch UAC forecast for one zone
// ---------------------------------------------------------------------------

interface UacAdvisory {
	overall_danger_rating?: string;
	overall_danger_rose?: string;
	avalanche_problem_1?: string;
	avalanche_problem_2?: string;
	avalanche_problem_3?: string;
	bottom_line?: string;
	date_issued?: string;
}

async function fetchZoneForecast(apiUrl: string): Promise<UacAdvisory | null> {
	const res = await fetch(apiUrl, {
		method: "GET",
		headers: { "User-Agent": "UAC-Eval-Script/1.0 (internal evaluation)" },
	});
	if (!res.ok) {
		console.warn(`  [warn] HTTP ${res.status} from ${apiUrl}`);
		return null;
	}
	const data = (await res.json()) as { advisories?: { advisory: UacAdvisory }[] };
	return data.advisories?.at(0)?.advisory ?? null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const zones = zoneConfig as Array<{
		zone_id: number;
		name: string;
		slug: string;
		api_url: string;
	}>;

	const results: BriefingOutput[] = [];
	const runDate = new Date().toISOString().slice(0, 10);

	console.log(`\n[briefings] Running for ${zones.length} zones — ${new Date().toISOString()}\n`);

	for (const zone of zones) {
		console.log(`  → ${zone.name} (${zone.slug})`);

		const output: BriefingOutput = {
			zone_slug: zone.slug,
			zone_name: zone.name,
			fetched_at: new Date().toISOString(),
			danger_rating: "Unknown",
			danger_level: 0,
			danger_by_elevation: {
				above_treeline: { rating: "Unknown", level: 0 },
				near_treeline: { rating: "Unknown", level: 0 },
				below_treeline: { rating: "Unknown", level: 0 },
			},
			avalanche_problems: [],
			alert_action: "flag_for_review",
			alert_reasoning: "No forecast data",
			bottom_line: "",
			ai_briefing: null,
			ai_model: null,
			prompt_version: PROMPT_VERSION,
			error: null,
		};

		try {
			const advisory = await fetchZoneForecast(zone.api_url);

			if (!advisory) {
				output.error = "No advisory returned from API";
				results.push(output);
				console.log("     ✗ No advisory");
				continue;
			}

			const dangerRating = advisory.overall_danger_rating ?? "None";
			const dangerLevel = DANGER_LEVELS[dangerRating] ?? 0;

			const rawProblems = [
				advisory.avalanche_problem_1,
				advisory.avalanche_problem_2,
				advisory.avalanche_problem_3,
			].filter((p): p is string => typeof p === "string" && p.trim().length > 0);

			const problems = rawProblems
				.map((p) => PROBLEM_NORMALIZATION[p] ?? p)
				.filter((p) => p !== "Normal Caution" && p !== "Normal");

			const dangerByElevation = parseDangerRose(advisory.overall_danger_rose, dangerRating);
			const { action, reasoning } = resolveAlertAction(dangerLevel, problems.length);

			output.danger_rating = dangerRating;
			output.danger_level = dangerLevel;
			output.danger_by_elevation = dangerByElevation;
			output.avalanche_problems = problems;
			output.alert_action = action;
			output.alert_reasoning = reasoning;
			output.bottom_line = advisory.bottom_line ?? "";

			console.log(
				`     danger=${dangerRating} (${dangerLevel}) | problems=[${problems.join(", ")}] | action=${action}`,
			);

			// Generate AI briefing for zones that need ops attention
			if (action !== "no_alert") {
				const { content, model } = await generateOpsBriefing(
					zone.name,
					dangerRating,
					dangerLevel,
					dangerByElevation,
					problems,
					action,
					reasoning,
					output.bottom_line,
				);
				output.ai_briefing = content;
				output.ai_model = model;
				console.log("     ✓ AI briefing generated");
			} else {
				console.log("     — no_alert, skipping AI call");
			}
		} catch (err) {
			output.error = String(err);
			console.error(`     ✗ Error: ${err}`);
		}

		results.push(output);
	}

	// Write output
	const outPath = resolve(process.cwd(), `data/eval-output/briefings-${runDate}.json`);
	writeFileSync(
		outPath,
		JSON.stringify({ run_date: runDate, prompt_version: PROMPT_VERSION, zones: results }, null, 2),
	);

	console.log(`\n[briefings] Done. Output written to ${outPath}\n`);

	// Print summary table
	console.log("Zone              | Danger       | Action          | AI Generated");
	console.log("------------------|--------------|-----------------|-------------");
	for (const r of results) {
		const name = r.zone_name.padEnd(17).slice(0, 17);
		const danger = `${r.danger_rating} (${r.danger_level})`.padEnd(13).slice(0, 13);
		const action = r.alert_action.padEnd(16).slice(0, 16);
		const ai = r.ai_briefing ? "✓" : r.error ? "✗ error" : "—";
		console.log(`${name} | ${danger} | ${action} | ${ai}`);
	}
}

void main();
