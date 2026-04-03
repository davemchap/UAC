/**
 * Persona-based forecast scoring engine.
 * Pure functions — no DB access, no side effects.
 */

import { PERSONAS, PERSONA_IDS, type PersonaId, type Persona } from "./personas";

export interface FlaggedPhrase {
	text: string;
	startIndex: number;
	endIndex: number;
	personaId: PersonaId;
	reason: string;
	suggestion: string;
}

export interface PersonaScore {
	personaId: PersonaId;
	personaName: string;
	personaRole: string;
	color: string;
	overall: number; // 0–100
	clarity: number;
	actionability: number;
	jargonLoad: number;
	decisionOutcome: "correct" | "uncertain" | "wrong" | "abandoned";
	flags: FlaggedPhrase[];
}

export interface ScorecardResult {
	forecastId: number;
	zoneId: number;
	zoneName: string;
	dateIssued: string;
	overallDangerRating: string;
	forecastText: string;
	personas: PersonaScore[];
	scoredAt: string;
}

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

function getSentences(text: string): string[] {
	return text
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 5);
}

/**
 * Flesch-Kincaid grade level approximation.
 * Uses syllable count estimate (vowel groups) since we have no NLP library.
 */
function estimateGradeLevel(text: string): number {
	const sentences = getSentences(text);
	if (sentences.length === 0) return 0;

	const words = text.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return 0;

	const syllables = words.reduce((sum, word) => {
		// Count vowel groups as syllable estimate
		const matches = word.toLowerCase().match(/[aeiouy]+/g);
		return sum + Math.max(1, matches?.length ?? 1);
	}, 0);

	const avgSentenceLength = words.length / sentences.length;
	const avgSyllablesPerWord = syllables / words.length;

	// Flesch-Kincaid Grade Level formula
	return 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;
}

// ---------------------------------------------------------------------------
// Jargon detection
// ---------------------------------------------------------------------------

function findJargonFlags(text: string, persona: Persona): FlaggedPhrase[] {
	const flags: FlaggedPhrase[] = [];
	const lowerText = text.toLowerCase();

	for (const term of persona.unknownTerms) {
		const lowerTerm = term.toLowerCase();
		let searchFrom = 0;
		while (searchFrom < lowerText.length) {
			const idx = lowerText.indexOf(lowerTerm, searchFrom);
			if (idx === -1) break;

			// Word boundary check — avoid matching inside other words
			const before = idx === 0 || /\W/.test(lowerText[idx - 1]);
			const after = idx + lowerTerm.length >= lowerText.length || /\W/.test(lowerText[idx + lowerTerm.length]);

			if (before && after) {
				const phrase = text.slice(idx, idx + term.length);
				flags.push({
					text: phrase,
					startIndex: idx,
					endIndex: idx + term.length,
					personaId: persona.id,
					reason: `"${phrase}" is not in ${persona.name}'s vocabulary`,
					suggestion: getJargonSuggestion(term),
				});
			}
			searchFrom = idx + 1;
		}
	}

	return flags;
}

function getJargonSuggestion(term: string): string {
	const suggestions: Record<string, string> = {
		"persistent weak layer": "a buried weak snow layer that has been in the snowpack for weeks",
		pwl: "buried weak layer (PWL)",
		"storm slab": "fresh snow that can slide as a slab",
		"wind slab": "wind-packed snow that can break away suddenly",
		"persistent slab": "a slab sitting on a buried weak layer from weeks ago",
		facets: "weak, sugary snow crystals",
		graupel: "soft hail-like snow pellets",
		"terrain trap": "terrain feature like a cliff, gully, or trees that makes a small avalanche deadly",
		cornice: "overhanging snow shelf at a ridge that can break off",
		"natural cycle": "avalanches releasing on their own without a person triggering them",
		"natural avalanche": "an avalanche that releases without a person triggering it",
		"human triggered": "an avalanche set off by a skier, snowshoer, or other person",
		"trigger point": "the spot where pressure causes an avalanche to start",
		propagation: "how far a fracture spreads through the snowpack",
		likelihood: "how probable an avalanche is",
		"spatial distribution": "how widespread the hazard is across the mountain",
		isolated: "hazard exists only in a few specific spots",
		specific: "hazard is in certain identifiable terrain features",
		widespread: "hazard exists nearly everywhere in this elevation and aspect band",
		"cross-loaded": "slope where wind loaded snow from the side, creating hidden slabs",
		aspect: "the direction a slope faces (north, south, east, west)",
		leeward: "the downwind side of a ridge — where wind deposits extra snow",
		windward: "the upwind side of a ridge — where wind scours snow away",
	};
	return suggestions[term.toLowerCase()] ?? `plain-language explanation of "${term}"`;
}

// ---------------------------------------------------------------------------
// Sentence length flags
// ---------------------------------------------------------------------------

function findLongSentenceFlags(text: string, persona: Persona): FlaggedPhrase[] {
	const flags: FlaggedPhrase[] = [];
	const sentences = getSentences(text);

	for (const sentence of sentences) {
		const wordCount = countWords(sentence);
		if (wordCount > persona.maxSentenceLength) {
			const idx = text.indexOf(sentence);
			if (idx === -1) continue;
			flags.push({
				text: sentence.slice(0, 80) + (sentence.length > 80 ? "…" : ""),
				startIndex: idx,
				endIndex: idx + sentence.length,
				personaId: persona.id,
				reason: `Sentence is ${wordCount} words — over the ${persona.maxSentenceLength}-word limit for ${persona.name}`,
				suggestion: "Break into two shorter sentences. Lead with the key hazard or action.",
			});
		}
	}

	return flags;
}

// ---------------------------------------------------------------------------
// Actionability check
// ---------------------------------------------------------------------------

const ACTION_PHRASES = [
	"avoid",
	"stay",
	"do not",
	"don't",
	"recommend",
	"consider",
	"be cautious",
	"use caution",
	"turn around",
	"wait",
	"check",
	"watch for",
	"carry",
	"travel",
];

function scoreActionability(text: string): number {
	const lowerText = text.toLowerCase();
	const found = ACTION_PHRASES.filter((p) => lowerText.includes(p)).length;
	// 0 action phrases = 20, 1 = 50, 2 = 70, 3+ = 90+
	if (found === 0) return 20;
	if (found === 1) return 50;
	if (found === 2) return 70;
	return Math.min(95, 70 + (found - 2) * 8);
}

// ---------------------------------------------------------------------------
// Journey simulation (for Persona Journey tab)
// ---------------------------------------------------------------------------

type SectionKey = "danger_rating" | "avalanche_problems" | "bottom_line" | "conditions" | "travel_advice";

export interface JourneyStep {
	section: SectionKey;
	sectionLabel: string;
	state: "correct" | "misunderstood" | "skipped" | "wrong_call";
	interpretation: string;
	reasoning: string;
}

export interface PersonaJourney {
	personaId: PersonaId;
	personaName: string;
	color: string;
	finalDecision: "correct" | "wrong" | "abandoned";
	confidence: number; // 0–100
	attentionDepth: number; // sections read out of 5
	steps: JourneyStep[];
}

const SECTION_LABELS: Record<SectionKey, string> = {
	danger_rating: "Danger Rating",
	avalanche_problems: "Avalanche Problems",
	bottom_line: "Bottom Line",
	conditions: "Current Conditions",
	travel_advice: "Travel Advice",
};

function dangerRatingStep(persona: Persona, dangerRating: string, dangerNum: number): JourneyStep {
	if (persona.literacyLevel !== "low") {
		return {
			section: "danger_rating",
			sectionLabel: SECTION_LABELS.danger_rating,
			state: "correct",
			interpretation: `${persona.name} accurately interprets danger rating ${dangerRating} and associated elevation bands`,
			reasoning: "Sufficient literacy to read the full danger rose",
		};
	}
	const state: JourneyStep["state"] = dangerNum === 3 ? "misunderstood" : "correct";
	const interpretation =
		dangerNum >= 4
			? `${persona.name} sees a high number and color — recognizes serious danger`
			: `${persona.name} sees "Considerable (3)" but treats it as moderate risk, not high`;
	const reasoning =
		dangerNum === 3
			? "No frame of reference for what Considerable means in practice"
			: "Danger number and color are clear enough at extremes";
	return { section: "danger_rating", sectionLabel: SECTION_LABELS.danger_rating, state, interpretation, reasoning };
}

function problemsStep(persona: Persona, problems: string[]): JourneyStep {
	const problemsText = problems.filter(Boolean).join(" ").toLowerCase();
	const jargonCount = persona.unknownTerms.filter((t) => problemsText.includes(t.toLowerCase())).length;

	let state: JourneyStep["state"] = "correct";
	if (persona.literacyLevel === "low" && jargonCount > 2) state = "skipped";
	else if (persona.literacyLevel === "low" && jargonCount > 0) state = "misunderstood";

	const interpretations: Record<JourneyStep["state"], string> = {
		skipped: `${persona.name} skips this section — too technical, too many unknown terms`,
		misunderstood: `${persona.name} reads the section but misses key hazard details due to jargon`,
		correct: `${persona.name} correctly identifies the primary hazard from this section`,
		wrong_call: `${persona.name} misreads hazard and makes an incorrect terrain decision`,
	};
	const reasoning =
		jargonCount > 0
			? `${jargonCount} unfamiliar term(s) in problems section`
			: "Language is accessible for this persona";

	return {
		section: "avalanche_problems",
		sectionLabel: SECTION_LABELS.avalanche_problems,
		state,
		interpretation: interpretations[state],
		reasoning,
	};
}

function bottomLineStep(persona: Persona, personaScore: PersonaScore, bottomLine: string): JourneyStep {
	const isLessExperienced = personaScore.personaId === "jordan" || personaScore.personaId === "priya";
	if (!isLessExperienced) {
		return {
			section: "bottom_line",
			sectionLabel: SECTION_LABELS.bottom_line,
			state: "correct",
			interpretation: `${persona.name} reads and evaluates the bottom line for technical accuracy`,
			reasoning: "Sufficient literacy to parse longer bottom line text",
		};
	}
	const blWords = countWords(bottomLine || "");
	const tooLong = blWords > 60;
	const state: JourneyStep["state"] = tooLong || personaScore.clarity <= 60 ? "misunderstood" : "correct";
	return {
		section: "bottom_line",
		sectionLabel: SECTION_LABELS.bottom_line,
		state,
		interpretation:
			state === "correct"
				? `${persona.name} reads the bottom line and gets a clear takeaway`
				: `${persona.name} reads the bottom line but key action is buried`,
		reasoning: tooLong ? "Bottom line is too long — action guidance not prominent" : "Bottom line is clear",
	};
}

function travelAdviceStep(persona: Persona, personaScore: PersonaScore): JourneyStep {
	if (personaScore.personaId === "jordan") {
		return {
			section: "travel_advice",
			sectionLabel: SECTION_LABELS.travel_advice,
			state: "skipped",
			interpretation: `${persona.name} does not read the Travel Advice section`,
			reasoning: "Jordan rarely reads past the danger rating and first paragraph",
		};
	}
	const actionable = personaScore.actionability > 65;
	return {
		section: "travel_advice",
		sectionLabel: SECTION_LABELS.travel_advice,
		state: actionable ? "correct" : "misunderstood",
		interpretation: actionable
			? `${persona.name} reads travel advice and translates it into a route plan`
			: `${persona.name} reads travel advice but finds it too generic to apply`,
		reasoning: actionable
			? "Advice is specific and actionable"
			: "Travel advice lacks specific terrain or aspect guidance",
	};
}

function deriveFinalDecision(
	steps: JourneyStep[],
	personaId: PersonaId,
	dangerNum: number,
): PersonaJourney["finalDecision"] {
	const hasWrongCall = steps.some((s) => s.state === "wrong_call");
	const lowLiteracyMisread = personaId === "jordan" && dangerNum === 3;
	if (hasWrongCall || lowLiteracyMisread) return "wrong";
	if (steps.filter((s) => s.state === "skipped").length >= 2) return "abandoned";
	return "correct";
}

export function simulateJourney(
	dangerRating: string,
	problems: string[],
	bottomLine: string,
	conditions: string,
	personaScore: PersonaScore,
): PersonaJourney {
	const persona = PERSONAS[personaScore.personaId];
	const dangerNum = Number.parseInt(dangerRating) || 0;

	const steps: JourneyStep[] = [
		dangerRatingStep(persona, dangerRating, dangerNum),
		problemsStep(persona, problems),
		bottomLineStep(persona, personaScore, bottomLine),
		travelAdviceStep(persona, personaScore),
	];

	const finalDecision = deriveFinalDecision(steps, personaScore.personaId, dangerNum);
	const sectionsRead = steps.filter((s) => s.state !== "skipped").length;

	return {
		personaId: personaScore.personaId,
		personaName: persona.name,
		color: persona.color,
		finalDecision,
		confidence: personaScore.overall,
		attentionDepth: sectionsRead,
		steps,
	};
}

// ---------------------------------------------------------------------------
// Coaching suggestions
// ---------------------------------------------------------------------------

export interface CoachingSuggestion {
	section: string;
	personaId: PersonaId;
	personaName: string;
	originalText: string;
	problem: string;
	suggestion: string;
	scoreImpact: number; // estimated points gained
}

function buildCoachingSuggestions(text: string, personaScore: PersonaScore): CoachingSuggestion[] {
	const suggestions: CoachingSuggestion[] = [];

	// Suggest breaking long sentences
	const sentences = getSentences(text);
	const persona = PERSONAS[personaScore.personaId];
	for (const sentence of sentences.slice(0, 3)) {
		if (countWords(sentence) > persona.maxSentenceLength) {
			suggestions.push({
				section: "Forecast text",
				personaId: personaScore.personaId,
				personaName: persona.name,
				originalText: sentence.slice(0, 120),
				problem: `This sentence is too long for ${persona.name} (${countWords(sentence)} words)`,
				suggestion: "Consider: break into two sentences. Lead with the hazard or action, then add context.",
				scoreImpact: 8,
			});
			break; // one sentence suggestion max
		}
	}

	// Suggest replacing jargon (top 2)
	const jargonFlags = personaScore.flags.filter((f) => f.reason.includes("vocabulary")).slice(0, 2);
	for (const flag of jargonFlags) {
		suggestions.push({
			section: "Avalanche Problems",
			personaId: personaScore.personaId,
			personaName: persona.name,
			originalText: flag.text,
			problem: flag.reason,
			suggestion: `Consider: "${getJargonSuggestion(flag.text)}"`,
			scoreImpact: 12,
		});
	}

	// Actionability suggestion
	if (personaScore.actionability < 60) {
		suggestions.push({
			section: "Travel Advice",
			personaId: personaScore.personaId,
			personaName: persona.name,
			originalText: "",
			problem: `The forecast lacks clear action language for ${persona.name}`,
			suggestion:
				"Consider: start Travel Advice with a direct action sentence: 'Avoid slopes steeper than 35° on [specific aspects] today.'",
			scoreImpact: 15,
		});
	}

	return suggestions;
}

// ---------------------------------------------------------------------------
// Section-level scoring
// ---------------------------------------------------------------------------

/**
 * Score a single forecast section for a persona.
 * Returns sub-scores (clarity, jargonLoad, actionability) for that section.
 */
function scoreSectionForPersona(
	sectionText: string,
	persona: Persona,
): { clarity: number; jargonLoad: number; actionability: number } {
	const gradeLevel = estimateGradeLevel(sectionText);
	const sentenceFlags = findLongSentenceFlags(sectionText, persona);
	const jargonFlags = findJargonFlags(sectionText, persona);
	const actionability = scoreActionability(sectionText);

	const gradePenalty = Math.max(0, (gradeLevel - persona.maxGradeLevel) * 4);
	const sentencePenalty = sentenceFlags.length * 5;
	const clarity = Math.max(10, Math.min(100, 90 - gradePenalty - sentencePenalty));
	const jargonLoad = Math.max(10, Math.min(100, 100 - jargonFlags.length * 15));

	return { clarity, jargonLoad, actionability };
}

/**
 * Weighted average of section scores.
 * Sections are weighted by their importance to each persona literacy level.
 * Jordan (low literacy) heavily weights the bottom line; technical personas weight problems more.
 */
function weightedSectionScore(
	sections: { clarity: number; jargonLoad: number; actionability: number }[],
	weights: number[],
): { clarity: number; jargonLoad: number; actionability: number } {
	const totalWeight = weights.reduce((s, w) => s + w, 0);
	if (totalWeight === 0 || sections.length === 0) return { clarity: 50, jargonLoad: 50, actionability: 50 };

	const weighted = (key: "clarity" | "jargonLoad" | "actionability") =>
		Math.round(sections.reduce((sum, s, i) => sum + s[key] * (weights[i] ?? 0), 0) / totalWeight);

	return {
		clarity: weighted("clarity"),
		jargonLoad: weighted("jargonLoad"),
		actionability: weighted("actionability"),
	};
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

export function scoreForecast(
	forecastText: string,
	dangerRating: string,
	problems: string[],
	bottomLine: string,
): PersonaScore[] {
	// Score each logical section independently so section-level problems don't
	// get diluted by unrelated well-written sections.
	const problemsText = problems.filter(Boolean).join("\n\n");
	// forecastText is already bottomLine + currentConditions joined upstream;
	// bottomLine is passed separately for the section-aware bottom-line weight.
	const sections = [
		{ label: "bottom_line", text: bottomLine },
		{ label: "problems", text: problemsText },
		{ label: "conditions", text: forecastText },
	].filter((s) => s.text.trim().length > 0);

	// Full concatenated text is still used for global flag positions (highlights)
	const fullText = [forecastText, problemsText, bottomLine].filter(Boolean).join("\n\n");

	return PERSONA_IDS.map((personaId): PersonaScore => {
		const persona = PERSONAS[personaId];

		// Section-level sub-scores
		const sectionScores = sections.map((s) => scoreSectionForPersona(s.text, persona));

		// Section weights by literacy level.
		// Low-literacy readers depend on bottom line; technical readers weight problems heavily.
		const weights: Record<typeof persona.literacyLevel, number[]> = {
			low: [0.5, 0.2, 0.3],
			high: [0.25, 0.45, 0.3],
			expert: [0.15, 0.5, 0.35],
			forecaster: [0.1, 0.5, 0.4],
		};
		const sectionWeights = weights[persona.literacyLevel].slice(0, sections.length);
		const { clarity, jargonLoad, actionability } = weightedSectionScore(sectionScores, sectionWeights);

		// Flags: collect across full text for highlight positions
		const jargonFlags = findJargonFlags(fullText, persona);
		const sentenceFlags = findLongSentenceFlags(fullText, persona);
		const allFlags = [...jargonFlags, ...sentenceFlags];

		// Overall weighted score — clarity and jargon load dominate for low-literacy personas
		const overall = Math.round(clarity * 0.4 + jargonLoad * 0.35 + actionability * 0.25);

		// Decision outcome heuristic
		const dangerNum = Number.parseInt(dangerRating) || 0;
		let decisionOutcome: PersonaScore["decisionOutcome"] = "correct";
		if (persona.literacyLevel === "low" && dangerNum === 3 && jargonFlags.length > 1) {
			decisionOutcome = "wrong";
		} else if (overall < 40) {
			decisionOutcome = "abandoned";
		} else if (overall < 60) {
			decisionOutcome = "uncertain";
		}

		return {
			personaId,
			personaName: persona.name,
			personaRole: persona.role,
			color: persona.color,
			overall,
			clarity,
			actionability,
			jargonLoad,
			decisionOutcome,
			flags: allFlags,
		};
	});
}

export { buildCoachingSuggestions };
