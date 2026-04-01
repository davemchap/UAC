import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateAlert } from "../alerts";
import { getZoneData } from "../avalanche-data";
import { shouldNotify } from "../notifications";
import { assessZone } from "../risk-assessment";
import { scoreAlert, scoreAssessment, scoreNotification } from "./evaluators";
import { getSyntheticFixture } from "./fixtures";
import type { EvalCase, EvalResult, EvalSummary } from "./types";

// ---------------------------------------------------------------------------
// Dataset loader
// ---------------------------------------------------------------------------

function loadDataset(datasetPath: string): EvalCase[] {
	const raw = readFileSync(resolve(datasetPath), "utf8");
	return raw
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line, i) => {
			try {
				return JSON.parse(line) as EvalCase;
			} catch {
				throw new Error(`Failed to parse dataset line ${i + 1}: ${line}`);
			}
		});
}

// ---------------------------------------------------------------------------
// Single-case runner
// ---------------------------------------------------------------------------

function runCase(evalCase: EvalCase): EvalResult {
	let snapshot: ReturnType<typeof getZoneData> | ReturnType<typeof getSyntheticFixture>;

	if (evalCase.input.slug) {
		snapshot = getZoneData(evalCase.input.slug);
		if (!snapshot) {
			const err: EvalResult = {
				caseId: evalCase.id,
				zoneName: evalCase.zoneName,
				scores: {
					assessment: { score: 0, label: "fail", explanation: `zone slug not found: ${evalCase.input.slug}` },
					alert: { score: 0, label: "fail", explanation: "skipped — zone not found" },
					notification: { score: 0, label: "fail", explanation: "skipped — zone not found" },
				},
				overall: "fail",
			};
			return err;
		}
	} else if (evalCase.input.synthetic) {
		snapshot = getSyntheticFixture(evalCase.input.synthetic);
	} else {
		const err: EvalResult = {
			caseId: evalCase.id,
			zoneName: evalCase.zoneName,
			scores: {
				assessment: { score: 0, label: "fail", explanation: "no input source (slug or synthetic)" },
				alert: { score: 0, label: "fail", explanation: "skipped" },
				notification: { score: 0, label: "fail", explanation: "skipped" },
			},
			overall: "fail",
		};
		return err;
	}

	const assessment = assessZone(snapshot);
	const alert = generateAlert(assessment);
	const notify = shouldNotify(alert.action);

	const assessmentScore = scoreAssessment(assessment, evalCase.expected_assessment);
	const alertScore = scoreAlert(alert, evalCase.expected_alert);
	const notificationScore = scoreNotification(notify, evalCase.expected_should_notify);

	const overall =
		assessmentScore.label === "pass" && alertScore.label === "pass" && notificationScore.label === "pass"
			? "pass"
			: "fail";

	return {
		caseId: evalCase.id,
		zoneName: evalCase.zoneName,
		scores: {
			assessment: assessmentScore,
			alert: alertScore,
			notification: notificationScore,
		},
		overall,
	};
}

// ---------------------------------------------------------------------------
// Aggregate runner
// ---------------------------------------------------------------------------

export function runAlertingEval(datasetPath: string): EvalSummary {
	const cases = loadDataset(datasetPath);
	const results = cases.map(runCase);

	const passCount = results.filter((r) => r.overall === "pass").length;
	const failCount = results.length - passCount;

	const byEvaluator = {
		assessment: { pass: 0, fail: 0 },
		alert: { pass: 0, fail: 0 },
		notification: { pass: 0, fail: 0 },
	};

	for (const r of results) {
		byEvaluator.assessment[r.scores.assessment.label]++;
		byEvaluator.alert[r.scores.alert.label]++;
		byEvaluator.notification[r.scores.notification.label]++;
	}

	return {
		totalCases: results.length,
		passCount,
		failCount,
		accuracyPct: results.length > 0 ? Math.round((passCount / results.length) * 100) : 0,
		byEvaluator,
		results,
	};
}

// ---------------------------------------------------------------------------
// Results writer
// ---------------------------------------------------------------------------

export function writeResults(summary: EvalSummary, outputDir: string): void {
	mkdirSync(resolve(outputDir), { recursive: true });

	writeFileSync(
		resolve(outputDir, "summary.json"),
		JSON.stringify(
			{
				timestamp: new Date().toISOString(),
				totalCases: summary.totalCases,
				passCount: summary.passCount,
				failCount: summary.failCount,
				accuracyPct: summary.accuracyPct,
				byEvaluator: summary.byEvaluator,
			},
			null,
			2,
		),
	);

	const runsPath = resolve(outputDir, "runs.jsonl");
	const lines = summary.results.map((r) => JSON.stringify(r)).join("\n");
	writeFileSync(runsPath, `${lines}\n`);
}
