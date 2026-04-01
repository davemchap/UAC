import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AlertAction, AlertConfig } from "../alert-config/types";
import type { RiskAssessment } from "../risk-assessment";

export type { AlertAction };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AlertDecision {
	action: AlertAction;
	escalated: boolean;
	escalationReason: string | null;
	dangerLevel: number;
	dangerName: string;
	label: string;
}

interface ThresholdEntry {
	danger_level: number;
	name: string;
	action: AlertAction;
}

interface ThresholdsFile {
	alert_thresholds: ThresholdEntry[];
}

// ---------------------------------------------------------------------------
// JSON fallback (used when no DB config is provided — keeps eval tests green)
// ---------------------------------------------------------------------------

let _thresholds: ThresholdEntry[] | null = null;

function loadThresholds(): ThresholdEntry[] {
	if (_thresholds) return _thresholds;
	const filePath = resolve(process.cwd(), "data/black-diamond/alert-thresholds.json");
	const file = JSON.parse(readFileSync(filePath, "utf8")) as ThresholdsFile;
	_thresholds = file.alert_thresholds;
	return _thresholds;
}

// ---------------------------------------------------------------------------
// Alert logic
// ---------------------------------------------------------------------------

const ACTION_LADDER: AlertAction[] = ["no_alert", "human_review", "auto_send", "auto_send_urgent"];

export const ACTION_LABEL: Record<AlertAction, string> = {
	no_alert: "No Alert",
	human_review: "Review Required",
	auto_send: "Auto-Send",
	auto_send_urgent: "URGENT Auto-Send",
	flag_for_review: "Flagged – Missing Data",
};

function escalateAction(action: AlertAction): AlertAction {
	const idx = ACTION_LADDER.indexOf(action);
	return idx >= 0 && idx < ACTION_LADDER.length - 1 ? ACTION_LADDER[idx + 1] : action;
}

function resolveBaseAction(
	dangerLevel: number,
	problemCount: number,
	zoneSlug: string | undefined,
	config: AlertConfig | undefined,
): AlertAction {
	if (config) {
		// 1. Check advanced rules (priority DESC, first match wins)
		for (const rule of config.rules) {
			if (!rule.enabled) continue;
			const levelOk = rule.minDangerLevel === null || dangerLevel >= rule.minDangerLevel;
			const problemOk = rule.minProblemCount === null || problemCount >= rule.minProblemCount;
			const zoneOk = rule.zoneSlug === null || rule.zoneSlug === zoneSlug;
			if (levelOk && problemOk && zoneOk) {
				return rule.action;
			}
		}
		// 2. Fall back to DB thresholds
		const entry = config.thresholds.find((t) => t.dangerLevel === dangerLevel);
		return entry?.action ?? "no_alert";
	}

	// 3. JSON fallback (no DB config — used by eval + tests)
	const entry = loadThresholds().find((t) => t.danger_level === dangerLevel);
	return entry?.action ?? "no_alert";
}

export function generateAlert(assessment: RiskAssessment, config?: AlertConfig, zoneSlug?: string): AlertDecision {
	let action = resolveBaseAction(assessment.dangerLevel, assessment.problemCount, zoneSlug, config);
	let escalated = false;
	let escalationReason: string | null = null;

	if (assessment.hasDataGap) {
		action = "flag_for_review";
		escalated = true;
		escalationReason = "Missing forecast or weather data";
	} else if (assessment.problemCount >= 2) {
		const escalatedAction = escalateAction(action);
		if (escalatedAction !== action) {
			action = escalatedAction;
			escalated = true;
			escalationReason = "Multiple avalanche problems";
		}
	}

	return {
		action,
		escalated,
		escalationReason,
		dangerLevel: assessment.dangerLevel,
		dangerName: assessment.dangerName,
		label: ACTION_LABEL[action],
	};
}
