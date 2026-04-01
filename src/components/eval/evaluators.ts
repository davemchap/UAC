import type { AlertDecision } from "../alerts";
import type { RiskAssessment } from "../risk-assessment";
import type { EvalScore, ExpectedAlert, ExpectedAssessment } from "./types";

// ---------------------------------------------------------------------------
// Assessment evaluator
// ---------------------------------------------------------------------------

export function scoreAssessment(actual: RiskAssessment, expected: ExpectedAssessment): EvalScore {
	const checks: { field: string; pass: boolean; actual: unknown; expected: unknown }[] = [
		{
			field: "dangerLevel",
			pass: actual.dangerLevel === expected.dangerLevel,
			actual: actual.dangerLevel,
			expected: expected.dangerLevel,
		},
		{
			field: "dangerName",
			pass: actual.dangerName === expected.dangerName,
			actual: actual.dangerName,
			expected: expected.dangerName,
		},
		{
			field: "problemCount",
			pass: actual.problemCount === expected.problemCount,
			actual: actual.problemCount,
			expected: expected.problemCount,
		},
		{
			field: "hasDataGap",
			pass: actual.hasDataGap === expected.hasDataGap,
			actual: actual.hasDataGap,
			expected: expected.hasDataGap,
		},
	];

	const failures = checks.filter((c) => !c.pass);
	const score = (checks.length - failures.length) / checks.length;
	const label = failures.length === 0 ? "pass" : "fail";
	const explanation =
		failures.length === 0
			? "all assessment fields match"
			: failures
					.map((f) => `${f.field}: got ${JSON.stringify(f.actual)}, expected ${JSON.stringify(f.expected)}`)
					.join("; ");

	return { score, label, explanation };
}

// ---------------------------------------------------------------------------
// Alert evaluator
// ---------------------------------------------------------------------------

export function scoreAlert(actual: AlertDecision, expected: ExpectedAlert): EvalScore {
	const actionMatch = actual.action === expected.action;
	const escalatedMatch = actual.escalated === expected.escalated;
	const reasonMatch = actual.escalationReason === expected.escalationReason;

	const checks = [
		{ field: "action", pass: actionMatch, actual: actual.action, expected: expected.action },
		{ field: "escalated", pass: escalatedMatch, actual: actual.escalated, expected: expected.escalated },
		{
			field: "escalationReason",
			pass: reasonMatch,
			actual: actual.escalationReason,
			expected: expected.escalationReason,
		},
	];

	const failures = checks.filter((c) => !c.pass);
	const score = (checks.length - failures.length) / checks.length;
	const label = failures.length === 0 ? "pass" : "fail";
	const explanation =
		failures.length === 0
			? "all alert fields match"
			: failures
					.map((f) => `${f.field}: got ${JSON.stringify(f.actual)}, expected ${JSON.stringify(f.expected)}`)
					.join("; ");

	return { score, label, explanation };
}

// ---------------------------------------------------------------------------
// Notification gate evaluator
// ---------------------------------------------------------------------------

export function scoreNotification(actual: boolean, expected: boolean): EvalScore {
	const pass = actual === expected;
	return {
		score: pass ? 1.0 : 0.0,
		label: pass ? "pass" : "fail",
		explanation: pass ? `shouldNotify=${actual} matches expected` : `shouldNotify=${actual}, expected ${expected}`,
	};
}
