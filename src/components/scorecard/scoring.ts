/**
 * Persona-based forecast scoring engine.
 * Pure functions — no DB access, no side effects.
 */

import { PERSONAS, PERSONA_IDS, type PersonaId, type Persona } from "./personas";

export const TRAINING_LABELS = ["None", "Awareness", "AIARE 1", "AIARE 2", "Pro 1", "Pro 2+"] as const;

export type FlagCategory =
	| "jargon"
	| "training-gap"
	| "terrain-language"
	| "weather-science"
	| "action-clarity"
	| "mode-gap";

export interface FlaggedPhrase {
	text: string;
	startIndex: number;
	endIndex: number;
	personaId: PersonaId;
	reason: string;
	suggestion: string;
	flagCategory: FlagCategory;
	severity: "blocker" | "warning";
}

export interface PersonaDimensions {
	yearsOfMountainExperience: number;
	avalancheTrainingLevel: number;
	avalancheTrainingLabel: string;
	backcountryDaysPerSeason: number;
	weatherPatternRecognition: number;
	terrainAssessmentSkill: number;
	riskTolerance: number;
	groupDecisionTendency: number;
	localTerrainFamiliarity: number;
}

export interface TravelModeWeightResult {
	mode: string;
	signalsFound: string[];
	signalsMissing: string[];
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
	dimensions?: PersonaDimensions;
	tags?: string[];
	travelModeWeights?: TravelModeWeightResult;
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

/**
 * Strip HTML entities and control characters from UAC forecast text.
 * Must be applied before scoring AND before returning text to the frontend
 * so that flag character positions are consistent with what is displayed.
 */
export function normalizeText(text: string | null | undefined): string {
	if (!text) return "";
	return (
		text
			.replace(/&nbsp;/g, " ")
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&[a-z]+;/gi, " ")
			// Strip HTML tags — the UAC API returns HTML-formatted text for newer forecasts.
			// Bounded quantifier {0,2000} avoids catastrophic backtracking on unterminated tags.
			.replace(/<[^>]{0,2000}>/g, " ")
			.replace(/\r/g, "")
			.replace(/[ \t]{2,}/g, " ")
			.trim()
	);
}

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
// Dimension-aware scoring helpers
// ---------------------------------------------------------------------------

/**
 * Terms unlocked by avalanche training level — persona no longer flags these.
 * Each level builds on the previous.
 */
const TRAINING_UNLOCKED_TERMS: Record<number, string[]> = {
	1: ["avalanche", "danger"],
	2: [
		"storm slab",
		"wind slab",
		"persistent slab",
		"aspect",
		"terrain trap",
		"shooting cracks",
		"whumpfing",
		"crown",
		"propagation",
		"likelihood",
		"natural avalanche",
		"natural cycle",
		"human triggered",
	],
	3: [
		"facets",
		"depth hoar",
		"spatial distribution",
		"isolated",
		"specific",
		"widespread",
		"pwl",
		"persistent weak layer",
		"buried weak layer",
		"cross-loaded",
		"leeward",
		"windward",
		"convexity",
	],
	4: [
		"swe",
		"hs",
		"hn24",
		"hn72",
		"utc",
		"d1",
		"d2",
		"d3",
		"d4",
		"d5",
		"loading rate",
		"temperature gradient",
		"settlement",
	],
};

/** Terms unlocked by terrain assessment skill level */
const TERRAIN_UNLOCKED_TERMS: Record<number, string[]> = {
	3: ["cornice", "runout zone", "overhead hazard"],
	4: ["convex roll", "trigger point", "debris"],
	5: ["cross-loaded", "convexity"],
};

/**
 * Returns the effective unknown-terms list for a persona after accounting for
 * their avalanche training level and terrain assessment skill.
 * Higher-trained personas know more jargon and are not penalized for it.
 */
function getEffectiveUnknownTerms(persona: Persona): readonly string[] {
	const trainingLevel = persona.avalancheTrainingLevel ?? 0;
	const terrainSkill = persona.terrainAssessmentSkill ?? 1;

	const knownTerms = new Set<string>();
	for (let level = 1; level <= trainingLevel; level++) {
		for (const t of TRAINING_UNLOCKED_TERMS[level] ?? []) knownTerms.add(t.toLowerCase());
	}
	for (let level = 3; level <= terrainSkill; level++) {
		for (const t of TERRAIN_UNLOCKED_TERMS[level] ?? []) knownTerms.add(t.toLowerCase());
	}

	return persona.unknownTerms.filter((t) => !knownTerms.has(t.toLowerCase()));
}

/**
 * Adjusts max grade level for conditions sections based on weather pattern recognition.
 * Skill 1 = -3 grade levels; skill 3 = no change; skill 5 = +2 grade levels.
 */
function getAdjustedMaxGradeLevel(persona: Persona, isConditionsSection: boolean): number {
	if (!isConditionsSection) return persona.maxGradeLevel;
	const weatherSkill = persona.weatherPatternRecognition ?? 3;
	const adjustment = weatherSkill <= 3 ? (weatherSkill - 3) * 1.5 : (weatherSkill - 3) * 1.0;
	return persona.maxGradeLevel + adjustment;
}

/**
 * Returns overall score weights adjusted for risk tolerance.
 * Aggressive personas (high riskTolerance) need strong actionability signals most.
 * Conservative personas need clarity and low jargon load most.
 */
function getOverallWeights(persona: Persona): { clarityW: number; jargonW: number; actionabilityW: number } {
	const rt = persona.riskTolerance ?? 3;
	if (rt <= 2) return { clarityW: 0.45, jargonW: 0.4, actionabilityW: 0.15 };
	if (rt >= 4) return { clarityW: 0.35, jargonW: 0.25, actionabilityW: 0.4 };
	return { clarityW: 0.4, jargonW: 0.35, actionabilityW: 0.25 };
}

const GROUP_PHRASES = [
	"consult with partners",
	"team decision",
	"group assessment",
	"discuss with your group",
	"communicate with your party",
	"partners",
];

/**
 * Group-communication phrases bonus/penalty based on groupDecisionTendency.
 * Consensus-oriented personas benefit from group language; solo-decision personas don't.
 */
function getGroupPhraseBonus(text: string, persona: Persona): number {
	const tendency = persona.groupDecisionTendency ?? 3;
	const lowerText = text.toLowerCase();
	const found = GROUP_PHRASES.filter((p) => lowerText.includes(p)).length;
	if (found === 0) return 0;
	if (tendency >= 4) return found * 3;
	if (tendency <= 2) return found * -1;
	return found * 1;
}

// ---------------------------------------------------------------------------
// Jargon detection
// ---------------------------------------------------------------------------

function buildJargonReason(phrase: string, persona: Persona): string {
	const level = persona.avalancheTrainingLevel ?? 0;
	if (level === 0) {
		return `"${phrase}" requires avalanche training ${persona.name} doesn't have (${TRAINING_LABELS[0]})`;
	}
	if (level <= 2) {
		return `"${phrase}" is technical jargon beyond ${persona.name}'s ${TRAINING_LABELS[level]} training (Level ${level})`;
	}
	return `"${phrase}" is not in ${persona.name}'s vocabulary`;
}

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
					reason: buildJargonReason(phrase, persona),
					suggestion: getJargonSuggestion(term),
					flagCategory: "jargon",
					severity: persona.literacyLevel === "low" ? "blocker" : "warning",
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
// Dimension-driven flag helpers
// ---------------------------------------------------------------------------

const CONSEQUENCE_ANCHOR_TERMS = [
	"buried",
	"burial",
	"bury",
	"could kill",
	"can kill",
	"fatal",
	"fatality",
	"serious injury",
	"carried",
	"swept",
	"knocked off",
	"deadly",
	"dangerous",
	"life-threatening",
	"caught in",
	"lethal",
	"will not survive",
];

function hasConsequenceAnchor(sentence: string): boolean {
	const lower = sentence.toLowerCase();
	return CONSEQUENCE_ANCHOR_TERMS.some((t) => lower.includes(t));
}

function parseDangerLevel(dangerRating: string): number {
	const map: Record<string, number> = {
		none: 0,
		low: 1,
		moderate: 2,
		considerable: 3,
		high: 4,
		extreme: 5,
	};
	return map[dangerRating.toLowerCase()] ?? 0;
}

function sentenceContaining(text: string, idx: number): string {
	const before = text.lastIndexOf(".", idx - 1);
	const after = text.indexOf(".", idx);
	return text.slice(before === -1 ? 0 : before + 1, after === -1 ? text.length : after + 1).trim();
}

function makeFlag(
	flagText: string,
	startIndex: number,
	endIndex: number,
	personaId: PersonaId,
	reason: string,
	suggestion: string,
	flagCategory: FlagCategory,
	severity: "blocker" | "warning",
): FlaggedPhrase {
	return { text: flagText, startIndex, endIndex, personaId, reason, suggestion, flagCategory, severity };
}

function findKeywordFlags(
	text: string,
	terms: string[],
	personaId: PersonaId,
	flagCategory: FlagCategory,
	severity: "blocker" | "warning",
	reason: (term: string) => string,
	suggestion: (term: string) => string,
): FlaggedPhrase[] {
	const flags: FlaggedPhrase[] = [];
	const lower = text.toLowerCase();
	for (const term of terms) {
		const lowerTerm = term.toLowerCase();
		let searchFrom = 0;
		while (searchFrom < lower.length) {
			const idx = lower.indexOf(lowerTerm, searchFrom);
			if (idx === -1) break;
			const before = idx === 0 || /\W/.test(lower[idx - 1]);
			const after = idx + lowerTerm.length >= lower.length || /\W/.test(lower[idx + lowerTerm.length]);
			if (before && after) {
				flags.push(
					makeFlag(
						text.slice(idx, idx + term.length),
						idx,
						idx + term.length,
						personaId,
						reason(term),
						suggestion(term),
						flagCategory,
						severity,
					),
				);
			}
			searchFrom = idx + 1;
		}
	}
	return flags;
}

function findRegexFlags(
	text: string,
	pattern: RegExp,
	personaId: PersonaId,
	flagCategory: FlagCategory,
	severity: "blocker" | "warning",
	reason: (match: string) => string,
	suggestion: (match: string) => string,
): FlaggedPhrase[] {
	const flags: FlaggedPhrase[] = [];
	pattern.lastIndex = 0;
	for (let m = pattern.exec(text); m !== null; m = pattern.exec(text)) {
		flags.push(
			makeFlag(m[0], m.index, m.index + m[0].length, personaId, reason(m[0]), suggestion(m[0]), flagCategory, severity),
		);
	}
	return flags;
}

// ---------------------------------------------------------------------------
// Training-gap flags (fv0.3)
// ---------------------------------------------------------------------------

const AVALANCHE_PROBLEM_TYPES = [
	"wind slab",
	"storm slab",
	"persistent slab",
	"wet avalanche",
	"glide avalanche",
	"loose wet",
	"loose dry",
	"deep slab",
];

const SPATIAL_DISTRIBUTION_TERMS = ["isolated", "specific", "widespread"];
const LIKELIHOOD_TERMS = ["unlikely", "possible", "likely", "very likely", "almost certain"];
const CAT_TRAINING: FlagCategory = "training-gap";
const CAT_ACTION: FlagCategory = "action-clarity";

function findLikelihoodDescriptorFlags(text: string, id: PersonaId, sev: "blocker" | "warning"): FlaggedPhrase[] {
	const flags: FlaggedPhrase[] = [];
	const lower = text.toLowerCase();
	for (const term of LIKELIHOOD_TERMS) {
		let searchFrom = 0;
		while (searchFrom < lower.length) {
			const idx = lower.indexOf(term, searchFrom);
			if (idx === -1) break;
			const before = idx === 0 || /\W/.test(lower[idx - 1]);
			const after = idx + term.length >= lower.length || /\W/.test(lower[idx + term.length]);
			if (before && after && !hasConsequenceAnchor(sentenceContaining(text, idx))) {
				flags.push(
					makeFlag(
						text.slice(idx, idx + term.length),
						idx,
						idx + term.length,
						id,
						`"${term}" has no consequence anchor for this untrained reader`,
						`PROBLEM: "${term}" reads as low-probability to non-technical readers.\nCONSIDER: Pair with a concrete consequence, e.g., "'likely' means a skier will probably trigger a slab on steep north-facing slopes today."`,
						CAT_TRAINING,
						sev,
					),
				);
			}
			searchFrom = idx + 1;
		}
	}
	return flags;
}

function findTrainingGapFlags(text: string, persona: Persona): FlaggedPhrase[] {
	const trainingLevel = persona.avalancheTrainingLevel ?? 0;
	if (trainingLevel > 2) return [];

	const id = persona.id;
	const sev: "blocker" | "warning" = trainingLevel === 0 ? "blocker" : "warning";

	if (trainingLevel > 1) return [];

	return [
		...findKeywordFlags(
			text,
			AVALANCHE_PROBLEM_TYPES,
			id,
			CAT_TRAINING,
			sev,
			(t) => `"${t}" requires formal avalanche training to interpret`,
			(t) =>
				`PROBLEM: "${t}" is not in this persona's vocabulary — no formal training.\nCONSIDER: Add a plain-language gloss, e.g., "${t} (wind-packed snow that can break away suddenly as a slab)."`,
		),
		...findRegexFlags(
			text,
			/\bD[1-5]\b/g,
			id,
			CAT_TRAINING,
			"blocker",
			(m) => `D-scale notation "${m}" is opaque without training`,
			() =>
				'PROBLEM: D-scale ratings are invisible to readers without formal training.\nCONSIDER: Replace with a consequence anchor, e.g., "large enough to bury and kill a person."',
		),
		...findLikelihoodDescriptorFlags(text, id, sev),
		...findRegexFlags(
			text,
			/(may|might|could)\s+be\s+(triggered|released|set off|initiated|unstable)/gi,
			id,
			CAT_TRAINING,
			"warning",
			(m) => `Passive construction "${m}" reads as lower-probability`,
			() =>
				'PROBLEM: Passive voice underplays the risk for non-technical readers.\nCONSIDER: Active voice with an agent: "A skier or rider can trigger an avalanche here today."',
		),
		...findRegexFlags(
			text,
			/\b(N|NE|E|SE|S|SW|W|NW)[\-\s]?(facing|aspect|aspects)\b/gi,
			id,
			CAT_TRAINING,
			"warning",
			(m) => `Aspect "${m}" has no compass frame for an untrained reader`,
			() =>
				'PROBLEM: Compass abbreviations (N-facing, NE-facing) are meaningless without a visual reference.\nCONSIDER: "north and northwest-facing slopes — the shaded sides of ridges that rarely see sun."',
		),
		...findKeywordFlags(
			text,
			SPATIAL_DISTRIBUTION_TERMS,
			id,
			CAT_TRAINING,
			"warning",
			(t) => `Spatial distribution term "${t}" requires training to interpret`,
			(t) =>
				`PROBLEM: "${t}" is a technical likelihood-matrix term unfamiliar to untrained readers.\nCONSIDER: Replace with a plain-language location descriptor.`,
		),
	];
}

// ---------------------------------------------------------------------------
// Terrain-language flags (fv0.4)
// ---------------------------------------------------------------------------

const OVERHEAD_HAZARD_TERMS = ["overhead hazard", "cornice fall", "ice cliff"];
const COMPLEX_TERRAIN_TERMS = ["convex roll", "convexity", "rollover", "cross-loaded", "cross loaded"];
const RUNOUT_TERMS = ["runout zone", "run-out zone", "run out zone", "runout", "run-out"];

function findTerrainTrapFlags(text: string, lower: string, id: PersonaId, sev: "blocker" | "warning"): FlaggedPhrase[] {
	const flags: FlaggedPhrase[] = [];
	for (const term of ["terrain trap", "terrain traps"]) {
		let searchFrom = 0;
		while (searchFrom < lower.length) {
			const idx = lower.indexOf(term, searchFrom);
			if (idx === -1) break;
			if (!hasConsequenceAnchor(sentenceContaining(text, idx))) {
				flags.push(
					makeFlag(
						text.slice(idx, idx + term.length),
						idx,
						idx + term.length,
						id,
						`"terrain trap" has no consequence anchor for a low terrain-skill reader`,
						'PROBLEM: "Terrain trap" is meaningless to readers who cannot picture it.\nCONSIDER: "gully bottoms, cliff bases, and creek beds — places where a small avalanche can bury you deeply."',
						"terrain-language",
						sev,
					),
				);
			}
			searchFrom = idx + 1;
		}
	}
	return flags;
}

function findOverheadHazardFlags(
	text: string,
	lower: string,
	id: PersonaId,
	sev: "blocker" | "warning",
): FlaggedPhrase[] {
	return OVERHEAD_HAZARD_TERMS.flatMap((term) => {
		const idx = lower.indexOf(term);
		if (idx === -1 || hasConsequenceAnchor(sentenceContaining(text, idx))) return [];
		return [
			makeFlag(
				text.slice(idx, idx + term.length),
				idx,
				idx + term.length,
				id,
				`"${text.slice(idx, idx + term.length)}" has no description of what falls`,
				'PROBLEM: Overhead hazard language without a description leaves low-skill readers unable to identify the risk.\nCONSIDER: "Large cornices hang above this route — they can break off without warning and trigger a slide below."',
				"terrain-language",
				sev,
			),
		];
	});
}

function findRunoutFlags(text: string, lower: string, id: PersonaId): FlaggedPhrase[] {
	return RUNOUT_TERMS.flatMap((term) => {
		const idx = lower.indexOf(term);
		if (idx === -1 || hasConsequenceAnchor(sentenceContaining(text, idx))) return [];
		return [
			makeFlag(
				text.slice(idx, idx + term.length),
				idx,
				idx + term.length,
				id,
				`"${text.slice(idx, idx + term.length)}" has no size or consequence anchor`,
				'PROBLEM: Runout zone language without a consequence leaves low-skill readers without actionable information.\nCONSIDER: "The debris path can reach the valley floor."',
				"terrain-language",
				"warning",
			),
		];
	});
}

function findTerrainLanguageFlags(text: string, persona: Persona): FlaggedPhrase[] {
	const terrainSkill = persona.terrainAssessmentSkill ?? 3;
	if (terrainSkill > 3) return [];

	const id = persona.id;
	const baseSev: "blocker" | "warning" = (persona.backcountryDaysPerSeason ?? 0) < 15 ? "blocker" : "warning";
	const lower = text.toLowerCase();

	const complexFlags =
		terrainSkill <= 2
			? findKeywordFlags(
					text,
					COMPLEX_TERRAIN_TERMS,
					id,
					"terrain-language",
					baseSev,
					(t) => `"${t}" requires terrain-reading skill this persona doesn't have`,
					(t) =>
						t.includes("convex")
							? 'PROBLEM: Convex roll requires field terrain reading.\nCONSIDER: "The top of a convex roll is a common trigger point — snow is thinner there and a skier\'s weight can start a slide that runs the full slope below."'
							: `PROBLEM: "${t}" requires advanced terrain interpretation.\nCONSIDER: Describe the feature in plain terms with a consequence anchor.`,
				)
			: [];

	return [
		...findTerrainTrapFlags(text, lower, id, baseSev),
		...findOverheadHazardFlags(text, lower, id, baseSev),
		...complexFlags,
		...findRunoutFlags(text, lower, id),
	];
}

// ---------------------------------------------------------------------------
// Weather-science flags (fv0.5)
// ---------------------------------------------------------------------------

const WEATHER_SCIENCE_PATTERNS: { terms: string[]; suggestion: string }[] = [
	{
		terms: ["temperature gradient", "facet growth", "faceting"],
		suggestion:
			'PROBLEM: Temperature gradient / facet growth is forecaster language.\nCONSIDER: "Cold, clear nights are creating weak sugary snow crystals deep in the pack — this is what makes buried weak layers dangerous weeks after a storm."',
	},
	{
		terms: ["inversion", "temperature inversion"],
		suggestion:
			'PROBLEM: Inversion language is not plain English.\nCONSIDER: "Warmer air above colder air near the ground is slowing snow settlement and keeping the snowpack weak."',
	},
	{
		terms: ["solar radiation loading", "solar loading", "insolation"],
		suggestion:
			'PROBLEM: Solar radiation loading is forecaster shorthand.\nCONSIDER: "South-facing slopes will soften and become prone to wet slides as the sun heats the snow surface this afternoon."',
	},
	{
		terms: ["loading rate", "rapid loading"],
		suggestion:
			'PROBLEM: Loading rate is a forecaster metric.\nCONSIDER: "Snow is falling fast enough that new slabs can form before the storm ends."',
	},
	{
		terms: ["surface hoar", "hoarfrost"],
		suggestion:
			'PROBLEM: Surface hoar requires forecasting knowledge to translate to hazard.\nCONSIDER: "A fragile, glittery layer of ice crystals formed on the snow surface — when buried by new snow, this creates a slippery weak layer that can fail weeks later."',
	},
	{
		terms: ["GFS", "ECMWF", "500mb", "jet stream", "synoptic"],
		suggestion:
			'PROBLEM: Model and synoptic references belong in internal briefings, not public forecasts.\nCONSIDER: "A strong storm is expected Thursday — expect rapid loading and increasing danger."',
	},
];

function findWeatherScienceFlags(text: string, persona: Persona): FlaggedPhrase[] {
	const weatherSkill = persona.weatherPatternRecognition ?? 3;
	if (weatherSkill > 3) return [];

	const flags: FlaggedPhrase[] = [];
	const id = persona.id;
	const severity: "blocker" | "warning" = weatherSkill <= 1 ? "blocker" : "warning";
	const lower = text.toLowerCase();
	const snowpackTerms = ["slab", "weak layer", "instability", "avalanche", "hazard", "be cautious"];

	for (const { terms, suggestion } of WEATHER_SCIENCE_PATTERNS) {
		for (const term of terms) {
			const idx = lower.indexOf(term.toLowerCase());
			if (idx === -1) continue;
			const sentence = sentenceContaining(text, idx);
			const sentenceLower = sentence.toLowerCase();
			const hasContext = hasConsequenceAnchor(sentence) || snowpackTerms.some((c) => sentenceLower.includes(c));
			if (!hasContext) {
				flags.push(
					makeFlag(
						text.slice(idx, idx + term.length),
						idx,
						idx + term.length,
						id,
						`"${term}" is weather-science language with no plain-language consequence`,
						suggestion,
						"weather-science",
						severity,
					),
				);
				break; // one flag per pattern group
			}
		}
	}

	// Multi-day pattern without snowpack consequence
	const multiDayPattern = /(extended|prolonged)\s+(cold|clear|warm|wet)/gi;
	for (let match = multiDayPattern.exec(text); match !== null; match = multiDayPattern.exec(text)) {
		const sentence = sentenceContaining(text, match.index);
		const sentenceLower = sentence.toLowerCase();
		if (!snowpackTerms.some((c) => sentenceLower.includes(c)) && !hasConsequenceAnchor(sentence)) {
			flags.push(
				makeFlag(
					match[0],
					match.index,
					match.index + match[0].length,
					id,
					`"${match[0]}" multi-day pattern with no snowpack consequence`,
					'PROBLEM: Multi-day weather patterns without a snowpack consequence leave non-technical readers unable to connect weather to hazard.\nCONSIDER: "This extended cold clear period is creating faceted snow — expect persistent weak layers to develop."',
					"weather-science",
					"warning",
				),
			);
		}
	}

	return flags;
}

// ---------------------------------------------------------------------------
// Action-clarity flags (fv0.6)
// ---------------------------------------------------------------------------

const HEDGE_PHRASES = [
	"may be acceptable",
	"could be okay",
	"some areas are safer",
	"lower risk terrain exists",
	"might be acceptable",
];

const SOFT_RECOMMENDATIONS = ["consider avoiding", "you may want to", "perhaps stay", "you might want to"];

function findHedgePhraseFlags(
	text: string,
	lower: string,
	id: PersonaId,
	riskTolerance: number,
	trainingLevel: number,
	dangerLevel: number,
): FlaggedPhrase[] {
	if (riskTolerance < 4 || trainingLevel > 1 || dangerLevel < 3) return [];
	return HEDGE_PHRASES.flatMap((phrase) => {
		const idx = lower.indexOf(phrase);
		if (idx === -1) return [];
		return [
			makeFlag(
				text.slice(idx, idx + phrase.length),
				idx,
				idx + phrase.length,
				id,
				`"${phrase}" provides an out that aggressive untrained readers will act on`,
				'PROBLEM: Aggressive readers anchor on the permission clause and will proceed.\nCONSIDER: Rewrite as a constraint: "Stay below treeline on south-facing aspects only. Avoid all northerly terrain above 8,500 ft."',
				CAT_ACTION,
				"blocker",
			),
		];
	});
}

function findSoftRecFlags(
	text: string,
	lower: string,
	id: PersonaId,
	dangerRating: string,
	dangerLevel: number,
): FlaggedPhrase[] {
	if (dangerLevel < 3) return [];
	return SOFT_RECOMMENDATIONS.flatMap((phrase) => {
		const idx = lower.indexOf(phrase);
		if (idx === -1) return [];
		return [
			makeFlag(
				text.slice(idx, idx + phrase.length),
				idx,
				idx + phrase.length,
				id,
				`"${phrase}" is too soft for ${dangerRating} danger`,
				'PROBLEM: At Considerable or higher, soft recommendations read as suggestions, not warnings.\nCONSIDER: Replace with a directive — "Avoid" or "Do not enter" rather than "consider avoiding."',
				CAT_ACTION,
				dangerLevel >= 4 ? "blocker" : "warning",
			),
		];
	});
}

function locateDangerRating(text: string, lower: string, dangerRating: string): [string, number, number] {
	const idx = lower.indexOf(dangerRating.toLowerCase());
	if (idx < 0) return [dangerRating, 0, 0];
	return [text.slice(idx, idx + dangerRating.length), idx, idx + dangerRating.length];
}

function findActionClarityFlags(text: string, persona: Persona, dangerRating: string): FlaggedPhrase[] {
	const flags: FlaggedPhrase[] = [];
	const id = persona.id;
	const lower = text.toLowerCase();
	const dangerLevel = parseDangerLevel(dangerRating);
	const riskTolerance = persona.riskTolerance ?? 3;
	const trainingLevel = persona.avalancheTrainingLevel ?? 0;

	flags.push(...findHedgePhraseFlags(text, lower, id, riskTolerance, trainingLevel, dangerLevel));
	flags.push(...findSoftRecFlags(text, lower, id, dangerRating, dangerLevel));

	// "Use caution" as sole action
	const useCautionIdx = lower.search(/use caution[\.\,\s]/);
	if (useCautionIdx !== -1) {
		flags.push(
			makeFlag(
				text.slice(useCautionIdx, useCautionIdx + 11),
				useCautionIdx,
				useCautionIdx + 11,
				id,
				'"Use caution" provides no actionable terrain guidance',
				'PROBLEM: "Use caution" has no behavioral meaning — what does caution look like?\nCONSIDER: "Stick to slopes below 30 degrees today. If you\'re not sure how steep a slope is, it\'s probably steep enough to avalanche."',
				CAT_ACTION,
				"warning",
			),
		);
	}

	// "Conditions exist" without consequence
	const conditionsExistMatch = /(conditions|hazard)\s+exist/i.exec(text);
	if (conditionsExistMatch && !hasConsequenceAnchor(sentenceContaining(text, conditionsExistMatch.index))) {
		flags.push(
			makeFlag(
				conditionsExistMatch[0],
				conditionsExistMatch.index,
				conditionsExistMatch.index + conditionsExistMatch[0].length,
				id,
				`"${conditionsExistMatch[0]}" has no consequence or terrain anchor`,
				'PROBLEM: "Conditions exist" says nothing actionable.\nCONSIDER: "Hazardous conditions exist on steep north-facing slopes above treeline — a slide here would bury you."',
				CAT_ACTION,
				"warning",
			),
		);
	}

	// "Considerable" without most-accidents anchor (low literacy)
	if (persona.literacyLevel === "low" && lower.includes("considerable")) {
		const hasAnchor = [
			"most accidents",
			"most fatalities",
			"underestimated",
			"do not underestimate",
			"more dangerous",
		].some((a) => lower.includes(a));
		if (!hasAnchor) {
			const idx = lower.indexOf("considerable");
			flags.push(
				makeFlag(
					text.slice(idx, idx + 12),
					idx,
					idx + 12,
					id,
					'"Considerable" is consistently underestimated by low-literacy readers',
					'PROBLEM: "Considerable" is where most avalanche fatalities occur — untrained readers treat it as moderate.\nCONSIDER: Add: "Considerable danger is where most avalanche accidents happen — do not treat this as a moderate day."',
					CAT_ACTION,
					"blocker",
				),
			);
		}
	}

	// Danger rating without behavior anchor for inexperienced readers
	if ((persona.yearsOfMountainExperience ?? 0) < 5 && dangerLevel >= 3) {
		const hasBehaviorAnchor = ["avoid", "do not", "stay below", "turn around", "stick to", "keep to"].some((a) =>
			lower.includes(a),
		);
		if (!hasBehaviorAnchor) {
			const [drText, drStart, drEnd] = locateDangerRating(text, lower, dangerRating);
			flags.push(
				makeFlag(
					drText,
					drStart,
					drEnd,
					id,
					"Danger rating stated without a behavioral consequence for an inexperienced reader",
					'PROBLEM: Inexperienced readers need a "what this means for you" sentence paired with the danger rating.\nCONSIDER: "Considerable danger means human-triggered avalanches are likely on steep slopes — most backcountry accidents happen on Considerable days."',
					CAT_ACTION,
					"warning",
				),
			);
		}
	}

	return flags;
}

// ---------------------------------------------------------------------------
// Mode-gap flags (fv0.7)
// ---------------------------------------------------------------------------

const MODE_GAP_SUGGESTIONS: Record<string, Record<string, string>> = {
	motorized: {
		remoteTriggering:
			'PROBLEM: No remote triggering language — critical for motorized users.\nCONSIDER: "Snowmobilers: a sled on the bench below can trigger the slope above. Keep riders spaced out and never park below loaded terrain."',
		runOutZone:
			'PROBLEM: No run-out zone language — motorized users park in avalanche paths.\nCONSIDER: "The debris paths from slides can reach the valley floor — do not park in or below avalanche paths."',
		terrainTrap:
			'PROBLEM: No terrain trap language — snowmobilers commonly ride gully and creek-bed terrain.\nCONSIDER: "Gully bottoms and creek beds are terrain traps — a small avalanche there can bury a rider."',
	},
	"human-powered": {
		safeAlternative:
			'PROBLEM: No safe terrain alternative described — human-powered travelers need a viable objective.\nCONSIDER: "Low-angle terrain below 30 degrees on southerly aspects is a lower-risk option today."',
		aspectElevation:
			'PROBLEM: No specific aspect and elevation callout — skinners cannot plan a route without this.\nCONSIDER: Specify the primary problem terrain: "N through NE-facing terrain above 9,000 ft" rather than generic steep terrain language.',
		travelAdviceSpecificity:
			"PROBLEM: Travel advice is too brief or lacks terrain specifics for route planning.\nCONSIDER: Add named aspects, elevations, and a safe terrain alternative. Three sentences minimum for human-powered travelers.",
	},
	"out-of-bounds": {
		outOfBoundsWarning:
			'PROBLEM: No out-of-bounds callout — sidecountry travelers exit into uncontrolled terrain.\nCONSIDER: "Terrain immediately outside resort boundaries is not patrolled — treat it as full backcountry terrain today."',
		plainLanguageConsequence:
			'PROBLEM: No plain-language burial consequence for out-of-bounds travelers without training.\nCONSIDER: "An avalanche in this terrain will likely bury you — rescue in uncontrolled terrain takes significantly longer than inside resort boundaries."',
		dangerRatingClarity:
			'PROBLEM: Danger rating not restated in plain terms in the travel advice for out-of-bounds travelers.\nCONSIDER: "Today\'s danger is Considerable — this is the level where most avalanche accidents happen."',
	},
};

function findModeGapFlags(signalsMissing: string[], persona: Persona, dangerRating: string): FlaggedPhrase[] {
	const travelMode = persona.travelMode ?? "human-powered";
	const trainingLevel = persona.avalancheTrainingLevel ?? 0;
	const dangerLevel = parseDangerLevel(dangerRating);

	if (trainingLevel > 2 || dangerLevel < 3) return [];

	const modeSuggestions = MODE_GAP_SUGGESTIONS[travelMode] ?? {};
	const sev: "blocker" | "warning" = travelMode === "motorized" ? "blocker" : "warning";

	return signalsMissing
		.filter((signal) => signal in modeSuggestions)
		.map(
			(signal): FlaggedPhrase => ({
				text: "",
				startIndex: 0,
				endIndex: 0,
				personaId: persona.id,
				reason: `Missing ${signal} guidance for ${travelMode} travelers at ${dangerRating} danger`,
				suggestion: modeSuggestions[signal],
				flagCategory: "mode-gap",
				severity: sev,
			}),
		);
}

// ---------------------------------------------------------------------------
// Travel mode weights
// ---------------------------------------------------------------------------

type SignalWeights = Record<string, number>;

const TRAVEL_MODE_WEIGHTS: Record<string, SignalWeights> = {
	motorized: {
		remoteTriggering: 1.4, // "remote trigger", "remotely triggered", "from a distance"
		runOutZone: 1.3, // "run-out", "runout", "path", "below the slope"
		terrainTrap: 1.3, // "terrain trap", "gully", "cliff band", "creek bed"
		aspectElevation: 0.85, // N-NW-facing, above 9000 ft (less differentiating for sleds)
		safeAlternative: 1.1, // "low angle", "below 30 degrees", specific safe zones
	},
	"human-powered": {
		remoteTriggering: 1.0,
		runOutZone: 1.0,
		terrainTrap: 1.1,
		aspectElevation: 1.25, // More relevant for skinning route planning
		safeAlternative: 1.2,
		travelAdviceSpecificity: 1.2, // Named routes, specific aspect/elevation callouts
	},
	"out-of-bounds": {
		dangerRatingClarity: 1.5, // Is the danger level clearly communicated?
		outOfBoundsWarning: 1.4, // Explicit out-of-bounds / sidecountry warnings
		plainLanguageConsequence: 1.3, // Plain-language consequence statements
		aspectElevation: 0.9,
		technicalSnowpack: 0.7, // Less weight on deep snowpack science
	},
};

/**
 * Signal keyword patterns per signal name.
 * Each entry is an array of substrings — if ANY match in the text the signal is "found".
 */
const SIGNAL_KEYWORDS: Record<string, string[]> = {
	remoteTriggering: ["remote trigger", "remotely triggered", "from a distance", "remote triggering"],
	runOutZone: ["run-out", "runout", "run out", "below the slope", "debris path", "avalanche path"],
	terrainTrap: ["terrain trap", "gully", "cliff band", "creek bed", "terrain traps"],
	aspectElevation: [
		"north-facing",
		"northwest",
		"n-nw",
		"above 9000",
		"above 9,000",
		"upper elevation",
		"high elevation",
	],
	safeAlternative: ["low angle", "below 30", "mellow terrain", "safe zone", "lower angle"],
	travelAdviceSpecificity: ["specifically", "named", "aspect and elevation", "below treeline", "above treeline"],
	dangerRatingClarity: ["considerable", "high", "extreme", "low", "moderate", "danger rating", "danger level"],
	outOfBoundsWarning: ["out-of-bounds", "sidecountry", "side country", "out of bounds", "resort boundary"],
	plainLanguageConsequence: ["could be deadly", "burial", "carried", "could kill", "serious injury", "fatality"],
	technicalSnowpack: ["swe", "temperature gradient", "facets", "depth hoar", "hn24", "hn72", "loading rate"],
};

/**
 * Detect which signals from a travel mode's weight map are present/absent in the forecast text.
 * Returns found and missing signal names.
 */
function detectTravelModeSignals(
	forecastText: string,
	mode: string,
): { signalsFound: string[]; signalsMissing: string[] } {
	const weights = TRAVEL_MODE_WEIGHTS[mode] ?? TRAVEL_MODE_WEIGHTS["human-powered"];
	const lowerText = forecastText.toLowerCase();

	const signalsFound: string[] = [];
	const signalsMissing: string[] = [];

	for (const signal of Object.keys(weights)) {
		const keywords = SIGNAL_KEYWORDS[signal] ?? [];
		const found = keywords.some((kw) => lowerText.includes(kw));
		if (found) {
			signalsFound.push(signal);
		} else {
			signalsMissing.push(signal);
		}
	}

	return { signalsFound, signalsMissing };
}

/**
 * Apply travel-mode signal weights to the raw actionability score.
 * For each signal the mode upweights (>1.0): boost if present, reduce if absent.
 * For each signal the mode downweights (<1.0): always apply the reduction.
 * Clamps result to 0–100.
 */
function applyTravelModeWeights(
	rawActionability: number,
	forecastText: string,
	mode: string,
): { adjustedActionability: number; signalsFound: string[]; signalsMissing: string[] } {
	const weights = TRAVEL_MODE_WEIGHTS[mode] ?? TRAVEL_MODE_WEIGHTS["human-powered"];
	const { signalsFound, signalsMissing } = detectTravelModeSignals(forecastText, mode);

	let adjustment = 0;

	for (const [signal, weight] of Object.entries(weights)) {
		const isFound = signalsFound.includes(signal);
		if (weight > 1.0) {
			// Upweighted signal: boost if present, penalize if absent
			if (isFound) {
				adjustment += (weight - 1.0) * 10;
			} else {
				adjustment -= (weight - 1.0) * 10;
			}
		} else if (weight < 1.0) {
			// Downweighted signal: always reduce contribution
			adjustment -= (1.0 - weight) * 5;
		}
		// weight === 1.0: no adjustment
	}

	const adjustedActionability = Math.round(Math.max(0, Math.min(100, rawActionability + adjustment)));
	return { adjustedActionability, signalsFound, signalsMissing };
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
	drivingDimension: string; // e.g. "avalancheTrainingLevel"
	drivingDimensionLabel: string; // e.g. "Training Gap"
}

function buildCoachingSuggestions(
	text: string,
	personaScore: PersonaScore,
	runtimePersona?: Persona,
): CoachingSuggestion[] {
	const suggestions: CoachingSuggestion[] = [];
	const persona = runtimePersona ?? PERSONAS[personaScore.personaId];
	const trainingLevel = persona.avalancheTrainingLevel ?? 0;

	// Suggest replacing jargon (top 2)
	const jargonFlags = personaScore.flags.filter((f) => !f.reason.includes("words")).slice(0, 2);
	for (const flag of jargonFlags) {
		const isTrainingGap = trainingLevel < 2;
		suggestions.push({
			section: "Avalanche Problems",
			personaId: personaScore.personaId,
			personaName: persona.name,
			originalText: flag.text,
			problem: flag.reason,
			suggestion: `Consider: "${getJargonSuggestion(flag.text)}"`,
			scoreImpact: 12,
			drivingDimension: isTrainingGap ? "avalancheTrainingLevel" : "generalVocabulary",
			drivingDimensionLabel: isTrainingGap ? "Training Gap" : "Experience Gap",
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
			drivingDimension: "riskTolerance",
			drivingDimensionLabel: "Actionability",
		});
	}

	return suggestions;
}

// ---------------------------------------------------------------------------
// Section-level scoring
// ---------------------------------------------------------------------------

/**
 * Score a single forecast section for a persona.
 * Uses dimension-aware thresholds: training level narrows jargon set,
 * field experience softens sentence penalties, weather skill adjusts grade tolerance.
 */
function scoreSectionForPersona(
	sectionText: string,
	persona: Persona,
	isConditionsSection = false,
): { clarity: number; jargonLoad: number; actionability: number } {
	const gradeLevel = estimateGradeLevel(sectionText);
	const effectiveMaxGrade = getAdjustedMaxGradeLevel(persona, isConditionsSection);
	const effectiveTerms = getEffectiveUnknownTerms(persona);

	const adjustedPersona = { ...persona, unknownTerms: effectiveTerms };

	const jargonFlags = findJargonFlags(sectionText, adjustedPersona);
	const rawActionability = scoreActionability(sectionText);
	const groupBonus = getGroupPhraseBonus(sectionText, persona);
	const actionability = Math.max(10, Math.min(100, rawActionability + groupBonus));

	const gradePenalty = Math.max(0, (gradeLevel - effectiveMaxGrade) * 4);
	const clarity = Math.max(10, Math.min(100, 90 - gradePenalty));
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

/**
 * Score a forecast against all personas.
 * Pass `runtimePersonas` to use DB-loaded personas with full dimension values;
 * falls back to static PERSONAS defaults when omitted.
 */
export function scoreForecast(
	forecastText: string,
	dangerRating: string,
	problems: string[],
	bottomLine: string,
	runtimePersonas?: Persona[],
): PersonaScore[] {
	const activePersonas = runtimePersonas ?? PERSONA_IDS.map((id) => PERSONAS[id]);

	const problemsText = problems.filter(Boolean).join("\n\n");
	const sections = [
		{ label: "bottom_line", text: bottomLine, isConditions: false },
		{ label: "problems", text: problemsText, isConditions: false },
		{ label: "conditions", text: forecastText, isConditions: true },
	].filter((s) => s.text.trim().length > 0);

	// Full concatenated text for global flag positions (highlights)
	// Note: forecastText already contains bottomLine — do not add it again or flags duplicate
	const fullText = [forecastText, problemsText].filter(Boolean).join("\n\n");

	return activePersonas.map((persona): PersonaScore => {
		// Section-level sub-scores with dimension-aware thresholds
		const sectionScores = sections.map((s) => scoreSectionForPersona(s.text, persona, s.isConditions));

		// Section weights by literacy level.
		// Low-literacy readers depend on bottom line; technical readers weight problems heavily.
		const sectionWeightMap: Record<typeof persona.literacyLevel, number[]> = {
			low: [0.5, 0.2, 0.3],
			high: [0.25, 0.45, 0.3],
			expert: [0.15, 0.5, 0.35],
			forecaster: [0.1, 0.5, 0.4],
		};
		const sectionWeights = sectionWeightMap[persona.literacyLevel].slice(0, sections.length);
		const {
			clarity,
			jargonLoad,
			actionability: rawActionability,
		} = weightedSectionScore(sectionScores, sectionWeights);

		// Apply travel-mode signal weights to actionability (post-processing step).
		// Personas without travelMode default to "human-powered" weights.
		const travelMode = persona.travelMode ?? "human-powered";
		const {
			adjustedActionability: actionability,
			signalsFound,
			signalsMissing,
		} = applyTravelModeWeights(rawActionability, fullText, travelMode);

		// Flags: use dimension-adjusted thresholds for highlight positions
		const adjustedPersona = {
			...persona,
			unknownTerms: getEffectiveUnknownTerms(persona),
		};
		const jargonFlags = findJargonFlags(fullText, adjustedPersona);
		const allFlags = [
			...jargonFlags,
			...findTrainingGapFlags(fullText, adjustedPersona),
			...findTerrainLanguageFlags(fullText, adjustedPersona),
			...findWeatherScienceFlags(fullText, adjustedPersona),
			...findActionClarityFlags(fullText, adjustedPersona, dangerRating),
			...findModeGapFlags(signalsMissing, adjustedPersona, dangerRating),
		];

		// Overall score weighted by risk tolerance dimension
		const { clarityW, jargonW, actionabilityW } = getOverallWeights(persona);
		const overall = Math.round(clarity * clarityW + jargonLoad * jargonW + actionability * actionabilityW);

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

		const dimensions: PersonaDimensions = {
			yearsOfMountainExperience: persona.yearsOfMountainExperience ?? 0,
			avalancheTrainingLevel: persona.avalancheTrainingLevel ?? 0,
			avalancheTrainingLabel: TRAINING_LABELS[Math.min(persona.avalancheTrainingLevel ?? 0, 5)],
			backcountryDaysPerSeason: persona.backcountryDaysPerSeason ?? 0,
			weatherPatternRecognition: persona.weatherPatternRecognition ?? 3,
			terrainAssessmentSkill: persona.terrainAssessmentSkill ?? 1,
			riskTolerance: persona.riskTolerance ?? 3,
			groupDecisionTendency: persona.groupDecisionTendency ?? 3,
			localTerrainFamiliarity: persona.localTerrainFamiliarity ?? 1,
		};

		const travelModeWeights: TravelModeWeightResult = {
			mode: travelMode,
			signalsFound,
			signalsMissing,
		};

		return {
			personaId: persona.id,
			personaName: persona.name,
			personaRole: persona.role,
			color: persona.color,
			overall,
			clarity,
			actionability,
			jargonLoad,
			decisionOutcome,
			flags: allFlags,
			dimensions,
			tags: persona.tags ? [...persona.tags] : [],
			travelModeWeights,
		};
	});
}

export { buildCoachingSuggestions };
