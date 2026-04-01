import { chromium } from "playwright";
import { join } from "node:path";

const BASE = "https://impact-lab-trail-guides.rise8.us/black-diamond";

const pages = [
	{ url: `${BASE}/`, name: "00-black-diamond-overview" },
	{ url: `${BASE}/design-your-avatar/`, name: "01-design-your-avatar" },
	{ url: `${BASE}/coder-setup/`, name: "02-coder-setup" },
	{ url: `${BASE}/lift-1/00-index/`, name: "03-session1-overview" },
	{ url: `${BASE}/lift-1/01-deployment-in-coder/`, name: "04-session1-deployment-in-coder" },
	{ url: `${BASE}/lift-1/02-context-engineering/`, name: "05-session1-context-engineering" },
	{ url: `${BASE}/lift-1/03-skills-as-outcome-agents/`, name: "06-session1-skills-as-outcome-agents" },
	{ url: `${BASE}/lift-1/04-delegation-and-parallelization/`, name: "07-session1-delegation-and-parallelization" },
	{ url: `${BASE}/run-1/01-setting-the-scene/`, name: "08-run1-setting-the-scene" },
	{ url: `${BASE}/run-1/02-the-run/`, name: "09-run1-the-run" },
	{ url: `${BASE}/reflection-1/01-reflection/`, name: "10-reflection1" },
	{ url: `${BASE}/lift-2/00-index/`, name: "11-session2-overview" },
	{ url: `${BASE}/lift-2/01-from-tests-to-evals/`, name: "12-session2-from-tests-to-evals" },
	{ url: `${BASE}/lift-2/02-observability-across-agents/`, name: "13-session2-observability-across-agents" },
	{ url: `${BASE}/lift-2/03-closing-the-loop/`, name: "14-session2-closing-the-loop" },
	{ url: `${BASE}/run-2/01-the-run/`, name: "15-run2-the-run" },
	{ url: `${BASE}/reflection-2/01-reflection/`, name: "16-reflection2" },
	{ url: `${BASE}/lift-3/00-index/`, name: "17-session3-overview" },
	{ url: `${BASE}/lift-3/01-from-eval-failures-to-work-items/`, name: "18-session3-from-eval-failures-to-work-items" },
	{ url: `${BASE}/lift-3/02-parallel-development/`, name: "19-session3-parallel-development" },
	{ url: `${BASE}/lift-3/03-owning-the-quality-bar/`, name: "20-session3-owning-the-quality-bar" },
	{ url: `${BASE}/run-3/01-the-run/`, name: "21-run3-the-run" },
	{ url: `${BASE}/reflection-3/01-reflection/`, name: "22-reflection3" },
	{ url: `${BASE}/lift-4/00-index/`, name: "23-session4-overview" },
	{ url: `${BASE}/lift-4/01-the-obedience-problem/`, name: "24-session4-the-obedience-problem" },
	{ url: `${BASE}/lift-4/02-the-autonomy-slider/`, name: "25-session4-the-autonomy-slider" },
	{ url: `${BASE}/lift-4/03-the-deliberate-line/`, name: "26-session4-the-deliberate-line" },
	{ url: `${BASE}/run-4/01-the-run/`, name: "27-run4-the-run" },
	{ url: `${BASE}/reflection-4/00-final-checkin/`, name: "28-reflection4-final-checkin" },
	{ url: `${BASE}/reflection-4/01-reflection/`, name: "29-reflection4-reflection" },
];

const outDir = join(import.meta.dir, "pdfs");

const browser = await chromium.launch();
const context = await browser.newContext();

for (const { url, name } of pages) {
	const page = await context.newPage();
	await page.goto(url, { waitUntil: "networkidle" });
	const outPath = join(outDir, `${name}.pdf`);
	await page.pdf({ path: outPath, format: "A4", printBackground: true });
	await page.close();
	console.log(`✓ ${name}.pdf`);
}

await browser.close();
console.log(`\nDone — ${pages.length} PDFs in ./pdfs/`);
