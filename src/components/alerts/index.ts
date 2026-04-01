import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RiskAssessment } from "../risk-assessment";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertAction = "no_alert" | "human_review" | "auto_send" | "auto_send_urgent" | "flag_for_review";

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
	action: string;
}

interface ThresholdsFile {
	alert_thresholds: ThresholdEntry[];
}

// ---------------------------------------------------------------------------
// Load thresholds
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

const ACTION_LABEL: Record<AlertAction, string> = {
	no_alert: "No Alert",
	human_review: "Review Required",
	auto_send: "Auto-Send",
	auto_send_urgent: "URGENT Auto-Send",
	flag_for_review: "Flagged – Missing Data",
};

function baseAction(dangerLevel: number): AlertAction {
	const entry = loadThresholds().find((t) => t.danger_level === dangerLevel);
	return (entry?.action ?? "no_alert") as AlertAction;
}

function escalateAction(action: AlertAction): AlertAction {
	const idx = ACTION_LADDER.indexOf(action);
	return idx >= 0 && idx < ACTION_LADDER.length - 1 ? ACTION_LADDER[idx + 1] : action;
}

export function generateAlert(assessment: RiskAssessment): AlertDecision {
	let action = baseAction(assessment.dangerLevel);
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
