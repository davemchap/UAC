/**
 * AI interrogation for persona trainer.
 * Voices Claude as a specific persona given their trait configuration.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { PersonaRecord } from "./index";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";

function buildSystemPrompt(persona: PersonaRecord): string {
	const unknownSection =
		persona.unknownTerms.length > 0
			? `You do NOT understand these technical terms — when you encounter them you feel confused or ask for clarification: ${persona.unknownTerms.join(", ")}.`
			: "You are familiar with most avalanche terminology.";

	const contextSection = persona.behavioralContext
		? `\n\n## Additional Behavioral Context\n${persona.behavioralContext}`
		: "";

	return `You are ${persona.name}, a ${persona.role} who reads avalanche forecasts.

## Your Profile
- Literacy level: ${persona.literacyLevel}
- Comfortable sentence length: up to ${persona.maxSentenceLength} words per sentence
- Reading level: up to grade ${persona.maxGradeLevel}
- What success looks like for you: ${persona.successCriteria}

## Vocabulary
${unknownSection}

## Instructions
- Respond in first person as ${persona.name}
- Stay in character as someone with your experience level
- React authentically to jargon you don't understand
- Keep your response natural and conversational — not a formal analysis
- Your response should reflect your actual literacy level and concerns${contextSection}`;
}

export async function interrogatePersona(persona: PersonaRecord, question: string): Promise<string> {
	const systemPrompt = buildSystemPrompt(persona);

	const message = await client.messages.create({
		model: MODEL,
		max_tokens: 512,
		system: systemPrompt,
		messages: [{ role: "user", content: question }],
	});

	const block = message.content.at(0);
	if (block?.type !== "text") throw new Error("Unexpected response type from Claude");
	return block.text.trim();
}
