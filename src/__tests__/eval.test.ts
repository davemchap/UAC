import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { scoreAlert, scoreAssessment, scoreNotification } from "../components/eval/evaluators";
import { runAlertingEval } from "../components/eval/runner";

const DATASET = resolve(process.cwd(), "eval/datasets/alerting-golden.jsonl");

// ---------------------------------------------------------------------------
// Unit tests: evaluators
// ---------------------------------------------------------------------------

describe("scoreAssessment", () => {
	test("returns pass when all fields match", () => {
		const actual = {
			dangerLevel: 3,
			dangerName: "Considerable",
			problemCount: 2,
			hasDataGap: false,
			problems: [],
			bottomLine: "",
			currentTemp: null,
			tempUnit: "F",
			snowDepthIn: null,
		};
		const expected = { dangerLevel: 3, dangerName: "Considerable", problemCount: 2, hasDataGap: false };
		const result = scoreAssessment(actual, expected);
		expect(result.label).toBe("pass");
		expect(result.score).toBe(1.0);
	});

	test("returns fail with explanation when dangerLevel mismatches", () => {
		const actual = {
			dangerLevel: 2,
			dangerName: "Considerable",
			problemCount: 2,
			hasDataGap: false,
			problems: [],
			bottomLine: "",
			currentTemp: null,
			tempUnit: "F",
			snowDepthIn: null,
		};
		const expected = { dangerLevel: 3, dangerName: "Considerable", problemCount: 2, hasDataGap: false };
		const result = scoreAssessment(actual, expected);
		expect(result.label).toBe("fail");
		expect(result.explanation).toContain("dangerLevel");
	});

	test("partial score when one of four fields fails", () => {
		const actual = {
			dangerLevel: 3,
			dangerName: "Considerable",
			problemCount: 1,
			hasDataGap: false,
			problems: [],
			bottomLine: "",
			currentTemp: null,
			tempUnit: "F",
			snowDepthIn: null,
		};
		const expected = { dangerLevel: 3, dangerName: "Considerable", problemCount: 2, hasDataGap: false };
		const result = scoreAssessment(actual, expected);
		expect(result.score).toBe(0.75);
	});
});

describe("scoreAlert", () => {
	test("returns pass when all alert fields match", () => {
		const actual = {
			action: "auto_send" as const,
			escalated: true,
			escalationReason: "Multiple avalanche problems",
			dangerLevel: 3,
			dangerName: "Considerable",
			label: "Auto-Send",
		};
		const expected = { action: "auto_send" as const, escalated: true, escalationReason: "Multiple avalanche problems" };
		expect(scoreAlert(actual, expected).label).toBe("pass");
	});

	test("returns fail when action mismatches", () => {
		const actual = {
			action: "human_review" as const,
			escalated: false,
			escalationReason: null,
			dangerLevel: 3,
			dangerName: "Considerable",
			label: "Review",
		};
		const expected = { action: "auto_send" as const, escalated: false, escalationReason: null };
		const result = scoreAlert(actual, expected);
		expect(result.label).toBe("fail");
		expect(result.explanation).toContain("action");
	});
});

describe("scoreNotification", () => {
	test("pass when both true", () => {
		expect(scoreNotification(true, true).label).toBe("pass");
	});

	test("pass when both false", () => {
		expect(scoreNotification(false, false).label).toBe("pass");
	});

	test("fail when mismatch", () => {
		expect(scoreNotification(false, true).label).toBe("fail");
	});
});

// ---------------------------------------------------------------------------
// Integration test: full eval pipeline
// ---------------------------------------------------------------------------

describe("runAlertingEval — golden dataset", () => {
	const summary = runAlertingEval(DATASET);

	test("loads all 13 cases (9 real + 4 synthetic)", () => {
		expect(summary.totalCases).toBe(13);
	});

	test("100% overall accuracy", () => {
		expect(summary.accuracyPct).toBe(100);
		expect(summary.failCount).toBe(0);
	});

	test("all assessment evals pass", () => {
		expect(summary.byEvaluator.assessment.fail).toBe(0);
	});

	test("all alert evals pass", () => {
		expect(summary.byEvaluator.alert.fail).toBe(0);
	});

	test("all notification evals pass", () => {
		expect(summary.byEvaluator.notification.fail).toBe(0);
	});

	// Per-zone spot checks
	for (const r of summary.results) {
		test(`${r.zoneName} passes all evaluators`, () => {
			expect(r.overall).toBe("pass");
		});
	}
});
