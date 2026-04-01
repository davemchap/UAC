import type { AlertAction } from "../alerts";

// ---------------------------------------------------------------------------
// Dataset schema
// ---------------------------------------------------------------------------

export type SyntheticKey = "no_advisory" | "no_weather" | "extreme_multi" | "low_multi";

export interface EvalInput {
	/** Load from multi-zone-snapshot.json by slug */
	slug?: string;
	/** Use a synthetic ZoneSnapshot fixture */
	synthetic?: SyntheticKey;
}

export interface ExpectedAssessment {
	dangerLevel: number;
	dangerName: string;
	problemCount: number;
	hasDataGap: boolean;
}

export interface ExpectedAlert {
	action: AlertAction;
	escalated: boolean;
	escalationReason: string | null;
}

export interface EvalCase {
	id: string;
	zoneName: string;
	input: EvalInput;
	expected_assessment: ExpectedAssessment;
	expected_alert: ExpectedAlert;
	expected_should_notify: boolean;
	metadata: { notes: string };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface EvalScore {
	score: number; // 0.0 = total fail, 1.0 = full pass
	label: "pass" | "fail";
	explanation: string;
}

export interface EvalResult {
	caseId: string;
	zoneName: string;
	scores: {
		assessment: EvalScore;
		alert: EvalScore;
		notification: EvalScore;
	};
	overall: "pass" | "fail";
}

export interface EvalSummary {
	totalCases: number;
	passCount: number;
	failCount: number;
	accuracyPct: number;
	byEvaluator: {
		assessment: { pass: number; fail: number };
		alert: { pass: number; fail: number };
		notification: { pass: number; fail: number };
	};
	results: EvalResult[];
}
