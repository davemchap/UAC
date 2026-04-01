import Anthropic from "@anthropic-ai/sdk";
import type { RiskAssessment } from "../risk-assessment";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertType = "traveler" | "ops";

export interface AlertResult {
	content: string;
	model: string;
	generatedAt: string;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildPrompt(zone: { name: string }, assessment: RiskAssessment, type: AlertType): string {
	const problemList = assessment.problems.length > 0 ? assessment.problems.join(", ") : "none identified";
	const weatherLine =
		assessment.currentTemp !== null
			? `Current temperature: ${assessment.currentTemp}°${assessment.tempUnit}`
			: "Weather data unavailable";
	const snowLine =
		assessment.snowDepthIn !== null ? `Snow depth: ${assessment.snowDepthIn} inches` : "Snow depth data unavailable";

	const shared = `Zone: ${zone.name}
Danger rating: ${assessment.dangerName} (level ${assessment.dangerLevel}/5)
Avalanche problems: ${problemList}
Forecaster bottom line: ${assessment.bottomLine || "Not provided"}
${weatherLine}
${snowLine}`;

	if (type === "traveler") {
		return `You are translating an official avalanche forecast for a backcountry skier.
Translate — do not re-analyze. The forecaster's judgment is ground truth.
Write 2-3 plain-language sentences a non-expert can act on.
Do not add caveats or re-derive the danger rating.

${shared}`;
	}

	return `You are writing an operational alert summary for avalanche center staff.
Explain what data triggered this alert and why it warrants action.
Be concise and specific. Reference the danger level, problems, and any escalation factors.
2-3 sentences maximum.

${shared}
Multiple avalanche problems: ${assessment.problemCount >= 2 ? "Yes — escalation factor" : "No"}`;
}

// ---------------------------------------------------------------------------
// Claude call
// ---------------------------------------------------------------------------

const client = new Anthropic();

async function callClaude(prompt: string): Promise<string> {
	const message = await client.messages.create({
		model: "claude-sonnet-4-6",
		max_tokens: 256,
		messages: [{ role: "user", content: prompt }],
	});
	const block = message.content.at(0);
	if (block?.type !== "text") throw new Error("Unexpected response type from Claude");
	return block.text;
}

function parseResponse(text: string, model: string): AlertResult {
	return {
		content: text.trim(),
		model,
		generatedAt: new Date().toISOString(),
	};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateAIAlert(
	zone: { name: string },
	assessment: RiskAssessment,
	type: AlertType,
): Promise<AlertResult> {
	const prompt = buildPrompt(zone, assessment, type);
	const text = await callClaude(prompt);
	return parseResponse(text, "claude-sonnet-4-6");
}
