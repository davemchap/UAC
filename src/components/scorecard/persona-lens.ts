/**
 * Persona Lens — answers "what does each persona HEAR when they read this forecast?"
 * Pure functions — no DB access, no side effects.
 */

import { PERSONAS, PERSONA_IDS, type PersonaId, type Persona } from "./personas";

export type ComprehensionLevel = "HIGH" | "MEDIUM" | "LOW" | "MISREAD";

export interface SectionHearing {
	section: "bottom_line" | "conditions" | "danger_rating" | "problems" | "travel_advice";
	sectionLabel: string;
	textSnippet: string;
	comprehensionLevel: ComprehensionLevel;
	jargonHitCount: number;
	spatialQualifierParsed: boolean;
	heardAs: string;
	missed: string[];
}

export interface PersonaLensResult {
	personaId: PersonaId;
	personaName: string;
	color: string;
	sectionHearings: SectionHearing[];
	divergenceScore: number;
	whatTheyWillDo: string;
	overallComprehension: ComprehensionLevel;
}

// ---------------------------------------------------------------------------
// Section label map
// ---------------------------------------------------------------------------

const SECTION_LABELS: Record<SectionHearing["section"], string> = {
	bottom_line: "Bottom Line",
	conditions: "Current Conditions",
	danger_rating: "Danger Rating",
	problems: "Avalanche Problems",
	travel_advice: "Travel Advice",
};

// ---------------------------------------------------------------------------
// Spatial qualifier detection
// ---------------------------------------------------------------------------

const ASPECT_WORDS = [
	"north",
	"south",
	"east",
	"west",
	"northeast",
	"northwest",
	"southeast",
	"southwest",
	"ne",
	"nw",
	"se",
	"sw",
	"n-facing",
	"s-facing",
];

const SLOPE_INDICATORS = ["°", "degrees", "steep", "above-treeline", "treeline", "upper elevation"];

function hasSpatialQualifiers(text: string): boolean {
	const lower = text.toLowerCase();
	const hasAspect = ASPECT_WORDS.some((w) => lower.includes(w));
	const hasElevation = ["ft", "feet", "elevation"].some((unit) => {
		const idx = lower.indexOf(unit);
		return idx > 0 && /\d/.test(lower[idx - 1]);
	});
	const hasSlope = SLOPE_INDICATORS.some((s) => lower.includes(s));
	return hasAspect || hasElevation || hasSlope;
}

function canParseSpatialQualifiers(persona: Persona): boolean {
	const localFamiliarity = persona.localTerrainFamiliarity ?? 1;
	const training = persona.avalancheTrainingLevel ?? 0;
	const terrainSkill = persona.terrainAssessmentSkill ?? 1;
	return localFamiliarity >= 3 || training >= 2 || terrainSkill >= 3;
}

// ---------------------------------------------------------------------------
// Jargon hit count for a section
// ---------------------------------------------------------------------------

function countJargonHits(text: string, unknownTerms: readonly string[]): { count: number; missed: string[] } {
	const lower = text.toLowerCase();
	const missed: string[] = [];
	for (const term of unknownTerms) {
		const lowerTerm = term.toLowerCase();
		const idx = lower.indexOf(lowerTerm);
		if (idx === -1) continue;
		const before = idx === 0 || /\W/.test(lower[idx - 1]);
		const after = idx + lowerTerm.length >= lower.length || /\W/.test(lower[idx + lowerTerm.length]);
		if (before && after) {
			missed.push(term);
		}
	}
	return { count: missed.length, missed };
}

// ---------------------------------------------------------------------------
// Comprehension level
// ---------------------------------------------------------------------------

function computeComprehension(
	jargonHitCount: number,
	spatialQualifierParsed: boolean,
	sectionHasSpatial: boolean,
	dangerRating: string,
	training: number,
): ComprehensionLevel {
	const isHighDanger = dangerRating.toLowerCase().includes("high") || dangerRating.toLowerCase().includes("extreme");

	if (isHighDanger && training === 0 && jargonHitCount > 2) return "MISREAD";
	if (jargonHitCount > 5) return "MISREAD";
	if (jargonHitCount >= 3 && jargonHitCount <= 5) return "LOW";
	if (jargonHitCount <= 2 || (!spatialQualifierParsed && sectionHasSpatial)) return "MEDIUM";
	// jargonHitCount === 0 AND (spatialQualifierParsed OR no spatial qualifiers)
	return "HIGH";
}

// ---------------------------------------------------------------------------
// heardAs template
// ---------------------------------------------------------------------------

function buildHeardAs(
	comprehension: ComprehensionLevel,
	personaName: string,
	dangerRating: string,
	problems: string[],
): string {
	const problemSuffix = problems.length > 0 ? `, with ${problems[0]} as the main concern` : "";
	const dangerSummary = `${dangerRating} danger${problemSuffix}`;
	switch (comprehension) {
		case "HIGH":
			return `${personaName} understood the key message: ${dangerSummary}`;
		case "MEDIUM":
			return `${personaName} got the general warning but may have missed the specific terrain details`;
		case "LOW":
			return `${personaName} likely absorbed only the danger level number, missing the hazard specifics`;
		case "MISREAD":
			return `${personaName} may have underestimated the danger — too much technical language blocked the key warning`;
	}
}

// ---------------------------------------------------------------------------
// Worst comprehension across sections
// ---------------------------------------------------------------------------

const COMPREHENSION_RANK: Record<ComprehensionLevel, number> = {
	HIGH: 0,
	MEDIUM: 1,
	LOW: 2,
	MISREAD: 3,
};

function worstComprehension(levels: ComprehensionLevel[]): ComprehensionLevel {
	if (levels.length === 0) return "MEDIUM";
	return levels.reduce<ComprehensionLevel>(
		(worst, level) => (COMPREHENSION_RANK[level] > COMPREHENSION_RANK[worst] ? level : worst),
		"HIGH",
	);
}

// ---------------------------------------------------------------------------
// whatTheyWillDo
// ---------------------------------------------------------------------------

function buildWhatTheyWillDo(comprehension: ComprehensionLevel, riskTolerance: number, personaName: string): string {
	switch (comprehension) {
		case "HIGH":
			if (riskTolerance <= 2)
				return `${personaName} makes a cautious, well-informed decision. Likely modifies the route or postpones.`;
			if (riskTolerance >= 4)
				return `${personaName} understands the hazard but may proceed anyway — experience creates confidence.`;
			return `${personaName} makes a cautious, well-informed decision. Likely modifies the route or postpones.`;
		case "MEDIUM":
			if (riskTolerance <= 2) return `${personaName} proceeds cautiously but may miss a specific terrain trap.`;
			if (riskTolerance >= 4)
				return `${personaName} proceeds with underestimated risk — reads the headline but skips the hazard details.`;
			return `${personaName} proceeds cautiously but may miss a specific terrain trap.`;
		case "LOW":
			return `${personaName} goes out without a clear hazard picture. Route selection will be based on feel, not forecast.`;
		case "MISREAD":
			if (riskTolerance <= 2)
				return `${personaName} may proceed believing conditions are safer than the forecast indicates.`;
			return `${personaName} high risk of a poor decision — technical language blocked the safety signal.`;
	}
}

// ---------------------------------------------------------------------------
// divergenceScore
// ---------------------------------------------------------------------------

function computeDivergenceScore(
	comprehension: ComprehensionLevel,
	dangerRating: string,
	problems: string[],
	travelMode: string | undefined,
): number {
	const baseScores: Record<ComprehensionLevel, number> = {
		HIGH: 10,
		MEDIUM: 35,
		LOW: 62,
		MISREAD: 85,
	};
	let score = baseScores[comprehension];

	const isHighDanger = dangerRating.toLowerCase().includes("high") || dangerRating.toLowerCase().includes("extreme");
	if (isHighDanger && (comprehension === "LOW" || comprehension === "MISREAD")) {
		score += 10;
	}

	if (travelMode === "motorized") {
		const lowerProblems = problems.map((p) => p.toLowerCase());
		const hasWindOrCornice = lowerProblems.some((p) => p.includes("wind slab") || p.includes("cornice"));
		if (hasWindOrCornice) {
			score += 8;
		}
	}

	return Math.min(100, score);
}

// ---------------------------------------------------------------------------
// Section builder
// ---------------------------------------------------------------------------

function buildSectionHearing(
	section: SectionHearing["section"],
	text: string,
	persona: Persona,
	dangerRating: string,
	problems: string[],
): SectionHearing {
	const training = persona.avalancheTrainingLevel ?? 0;
	const unknownTerms = persona.unknownTerms;
	const { count: jargonHitCount, missed } = countJargonHits(text, unknownTerms);
	const sectionHasSpatial = hasSpatialQualifiers(text);
	const canParse = canParseSpatialQualifiers(persona);
	const spatialQualifierParsed = canParse && sectionHasSpatial;

	const comprehensionLevel = computeComprehension(
		jargonHitCount,
		spatialQualifierParsed,
		sectionHasSpatial,
		dangerRating,
		training,
	);

	const heardAs = buildHeardAs(comprehensionLevel, persona.name, dangerRating, problems);
	const textSnippet = text.slice(0, 120);

	return {
		section,
		sectionLabel: SECTION_LABELS[section],
		textSnippet,
		comprehensionLevel,
		jargonHitCount,
		spatialQualifierParsed,
		heardAs,
		missed,
	};
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computePersonaLens(
	forecastText: string,
	dangerRating: string,
	problems: string[],
	bottomLine: string | null,
	currentConditions: string | null,
	personas?: Persona[],
): PersonaLensResult[] {
	const activePersonas = personas ?? PERSONA_IDS.map((id) => PERSONAS[id]);

	// Build section texts
	const bottomLineText = bottomLine ?? forecastText;
	const conditionsText = currentConditions ?? "";
	const dangerRatingText = dangerRating;
	const problemsText = problems.filter(Boolean).join(". ");

	return activePersonas.map((persona): PersonaLensResult => {
		const riskTolerance = persona.riskTolerance ?? 3;
		const travelMode = persona.travelMode;

		const sections: SectionHearing[] = [
			buildSectionHearing("bottom_line", bottomLineText, persona, dangerRating, problems),
			buildSectionHearing("danger_rating", dangerRatingText, persona, dangerRating, problems),
		];

		if (problemsText.trim().length > 0) {
			sections.push(buildSectionHearing("problems", problemsText, persona, dangerRating, problems));
		}

		if (conditionsText.trim().length > 0) {
			sections.push(buildSectionHearing("conditions", conditionsText, persona, dangerRating, problems));
		}

		const overallComprehension = worstComprehension(sections.map((s) => s.comprehensionLevel));
		const whatTheyWillDo = buildWhatTheyWillDo(overallComprehension, riskTolerance, persona.name);
		const divergenceScore = computeDivergenceScore(overallComprehension, dangerRating, problems, travelMode);

		return {
			personaId: persona.id,
			personaName: persona.name,
			color: persona.color,
			sectionHearings: sections,
			divergenceScore,
			whatTheyWillDo,
			overallComprehension,
		};
	});
}
