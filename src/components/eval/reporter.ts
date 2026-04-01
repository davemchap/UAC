import type { EvalResult, EvalSummary } from "./types";

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const pass = (s: string) => `${GREEN}${s}${RESET}`;
const fail = (s: string) => `${RED}${s}${RESET}`;
const bold = (s: string) => `${BOLD}${s}${RESET}`;

// ---------------------------------------------------------------------------
// Row / failure helpers
// ---------------------------------------------------------------------------

function cell(label: "pass" | "fail", width: number): string {
	const text = label === "pass" ? pass("pass") : fail("FAIL");
	return text + " ".repeat(Math.max(0, width - 4));
}

function formatRow(r: EvalResult, col: Record<string, number>): string {
	return [
		r.zoneName.padEnd(col.zone, " "),
		cell(r.scores.assessment.label, col.assessment),
		cell(r.scores.alert.label, col.alert),
		cell(r.scores.notification.label, col.notification),
		r.overall === "pass" ? pass("pass") : fail("FAIL"),
	].join("  ");
}

function failureLines(r: EvalResult): string[] {
	return (
		[
			r.scores.assessment.label === "fail" ? `  assessment: ${r.scores.assessment.explanation}` : null,
			r.scores.alert.label === "fail" ? `  alert: ${r.scores.alert.explanation}` : null,
			r.scores.notification.label === "fail" ? `  notification: ${r.scores.notification.explanation}` : null,
		] as (string | null)[]
	).filter((e): e is string => e !== null);
}

function printEvaluatorSummary(summary: EvalSummary): void {
	const evals = [
		{ name: "Assessment", stats: summary.byEvaluator.assessment },
		{ name: "Alert", stats: summary.byEvaluator.alert },
		{ name: "Notification", stats: summary.byEvaluator.notification },
	];
	for (const e of evals) {
		const p = e.stats.pass;
		const f = e.stats.fail;
		const color = f === 0 ? GREEN : RED;
		console.log(`  ${bold(e.name.padEnd(14, " "))} ${color}${p}/${p + f}${RESET}`);
	}
}

function printFailures(failures: { zone: string; lines: string[] }[]): void {
	console.log(`\n${BOLD}${YELLOW}Failures:${RESET}`);
	for (const f of failures) {
		console.log(`\n  ${bold(f.zone)}`);
		for (const line of f.lines) {
			console.log(`  ${RED}✗${RESET} ${line}`);
		}
	}
}

// ---------------------------------------------------------------------------
// Report printer
// ---------------------------------------------------------------------------

export function printReport(summary: EvalSummary): void {
	const { totalCases, passCount, failCount, accuracyPct, results } = summary;
	const headerColor = failCount === 0 ? GREEN : RED;

	console.log(
		`\n${BOLD}Alerting Eval Results${RESET}  ${headerColor}${passCount}/${totalCases} passed (${accuracyPct}%)${RESET}\n`,
	);
	printEvaluatorSummary(summary);
	console.log();

	const COL = { zone: 36, assessment: 12, alert: 8, notification: 14 };
	console.log(
		[
			bold("Zone".padEnd(COL.zone, " ")),
			bold("Assessment".padEnd(COL.assessment, " ")),
			bold("Alert".padEnd(COL.alert, " ")),
			bold("Notification".padEnd(COL.notification, " ")),
			bold("Overall"),
		].join("  "),
	);
	console.log("─".repeat(90));

	const failures: { zone: string; lines: string[] }[] = [];

	for (const r of results) {
		console.log(formatRow(r, COL));
		if (r.overall === "fail") {
			failures.push({ zone: r.zoneName, lines: failureLines(r) });
		}
	}

	if (failures.length > 0) {
		printFailures(failures);
	}

	console.log();
}
