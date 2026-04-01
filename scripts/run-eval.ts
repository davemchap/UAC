import { resolve } from "node:path";
import { printReport } from "../src/components/eval/reporter";
import { runAlertingEval, writeResults } from "../src/components/eval/runner";

const datasetPath = resolve(process.cwd(), "eval/datasets/alerting-golden.jsonl");
const outputDir = resolve(process.cwd(), "eval/results");

console.log(`Loading dataset: ${datasetPath}`);
const summary = runAlertingEval(datasetPath);

writeResults(summary, outputDir);
console.log(`Results written to: ${outputDir}`);

printReport(summary);

if (summary.failCount > 0) {
	process.exit(1);
}
