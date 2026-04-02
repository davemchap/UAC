import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TriageInput {
	contentText: string | null;
	contentImageUrl: string | null;
	lat: number | null;
	lng: number | null;
}

export interface TriageOutput {
	zoneSlug: string | null;
	hazardType: string | null;
	severity: string | null;
	locationDescription: string | null;
	aiSummary: string;
}

interface TriageStructuredResponse {
	zone_slug: string | null;
	hazard_type: string | null;
	severity: string | null;
	location_description: string | null;
	ai_summary: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";

const VALID_HAZARD_TYPES = ["avalanche", "wind_slab", "cornice", "wet_snow", "access_hazard", "other"] as const;
const VALID_SEVERITIES = ["low", "moderate", "high", "critical"] as const;

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildTriagePrompt(input: TriageInput): string {
	const locationHint =
		input.lat != null && input.lng != null
			? `GPS coordinates: ${input.lat.toFixed(4)}, ${input.lng.toFixed(4)} (Wasatch Range, Utah)`
			: "No GPS coordinates provided.";

	const textSection = input.contentText ? `Observer text: ${input.contentText}` : "No text provided.";

	return `You are an avalanche safety triage system. A backcountry observer has submitted a field report. Analyze it and extract structured information.

${locationHint}
${textSection}

Extract and return a JSON object with:
- zone_slug: best matching UAC zone slug or null. Valid slugs: salt-lake, ogden, provo, uintas, logan, moab, skyline, southeast-utah, southwest-utah
- hazard_type: one of: avalanche, wind_slab, cornice, wet_snow, access_hazard, other (or null if unclear)
- severity: one of: low, moderate, high, critical (or null if unclear)
- location_description: brief human-readable location description (1 sentence, or null)
- ai_summary: 1-2 sentence plain-language summary of the observation for ops staff review

Respond with ONLY the JSON object, no markdown fences.`;
}

// ---------------------------------------------------------------------------
// Claude call
// ---------------------------------------------------------------------------

const client = new Anthropic();

async function callClaude(input: TriageInput): Promise<TriageStructuredResponse> {
	const messages: Anthropic.MessageParam[] = [];

	if (input.contentImageUrl) {
		// Image triage: send image + prompt as multimodal
		const base64Match = /^data:([^;]+);base64,(.+)$/.exec(input.contentImageUrl);
		if (base64Match) {
			const mediaType = base64Match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
			const imageData = base64Match[2];
			messages.push({
				role: "user",
				content: [
					{
						type: "image",
						source: { type: "base64", media_type: mediaType, data: imageData },
					},
					{
						type: "text",
						text: buildTriagePrompt(input),
					},
				],
			});
		} else {
			messages.push({ role: "user", content: buildTriagePrompt(input) });
		}
	} else {
		messages.push({ role: "user", content: buildTriagePrompt(input) });
	}

	const message = await client.messages.create({ model: MODEL, max_tokens: 512, messages });
	const block = message.content.at(0);
	if (block?.type !== "text") throw new Error("Unexpected response type from Claude triage");

	const cleaned = block.text
		.trim()
		.replace(/^```(?:json)?\s*\n?/i, "")
		.replace(/\n?```\s*$/i, "");
	return JSON.parse(cleaned) as TriageStructuredResponse;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeResponse(raw: TriageStructuredResponse): TriageOutput {
	const rawHazard = raw.hazard_type;
	const hazardType =
		rawHazard !== null && VALID_HAZARD_TYPES.includes(rawHazard as (typeof VALID_HAZARD_TYPES)[number])
			? rawHazard
			: null;
	const rawSeverity = raw.severity;
	const severity =
		rawSeverity !== null && VALID_SEVERITIES.includes(rawSeverity as (typeof VALID_SEVERITIES)[number])
			? rawSeverity
			: null;

	return {
		zoneSlug: raw.zone_slug ?? null,
		hazardType,
		severity,
		locationDescription: raw.location_description ?? null,
		aiSummary: raw.ai_summary ?? "No summary available.",
	};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function triageObservation(input: TriageInput): Promise<TriageOutput> {
	const raw = await callClaude(input);
	return normalizeResponse(raw);
}
