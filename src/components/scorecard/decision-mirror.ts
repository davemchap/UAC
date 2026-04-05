/**
 * Decision Mirror — answers "what decision confidence does each persona have,
 * and is their conclusion correct?"
 * Pure functions — no DB access, no side effects.
 */

import { PERSONAS, PERSONA_IDS, type PersonaId, type Persona } from "./personas";

export type DecisionConfidence = "HIGH" | "UNCERTAIN" | "INVERTED";

export interface DecisionSignal {
	signalType: "danger_level" | "hazard_type" | "terrain_exclusion";
	signalLabel: string;
	forecasterIntent: string;
	personaConclusion: string;
	parsed: boolean;
}

export interface DecisionMirrorResult {
	personaId: PersonaId;
	personaName: string;
	color: string;
	confidence: DecisionConfidence;
	accuracyScore: number;
	behavioralConclusion: string;
	signals: DecisionSignal[];
}

// ---------------------------------------------------------------------------
// Danger rating numeric mapping
// ---------------------------------------------------------------------------

function dangerToNumeric(dangerRating: string): number {
	const lower = dangerRating.toLowerCase();
	if (lower.includes("extreme")) return 5;
	if (lower.includes("high")) return 4;
	if (lower.includes("considerable")) return 3;
	if (lower.includes("moderate")) return 2;
	if (lower.includes("low")) return 1;
	return 0;
}

function isConsiderableOrAbove(dangerRating: string): boolean {
	return dangerToNumeric(dangerRating) >= 3;
}

// ---------------------------------------------------------------------------
// Terrain exclusion extraction
// ---------------------------------------------------------------------------

const TERRAIN_PATTERNS = [
	/north[- ]?facing\s+above\s+[\d,]+\s*(?:feet|ft)/i,
	/south[- ]?facing\s+above\s+[\d,]+\s*(?:feet|ft)/i,
	/east[- ]?facing\s+above\s+[\d,]+\s*(?:feet|ft)/i,
	/west[- ]?facing\s+above\s+[\d,]+\s*(?:feet|ft)/i,
	/(?:n[ew]?|s[ew]?|e|w)[- ]?facing\s+above\s+[\d,]+\s*(?:feet|ft)/i,
	/steep\s+terrain\s+above\s+treeline/i,
	/above[\s-]treeline/i,
	/upper\s+elevation/i,
];

function extractTerrainDescription(forecastText: string): string | null {
	for (const pattern of TERRAIN_PATTERNS) {
		const match = pattern.exec(forecastText);
		if (match) return match[0];
	}
	return null;
}

// ---------------------------------------------------------------------------
// Signal builders
// ---------------------------------------------------------------------------

function buildDangerLevelSignal(dangerRating: string, persona: Persona): DecisionSignal {
	const dangerNum = dangerToNumeric(dangerRating);
	const training = persona.avalancheTrainingLevel ?? 0;
	const isLow = persona.literacyLevel === "low";

	const forecasterIntent = `${dangerRating} danger — avoid avalanche terrain or travel with rescue gear and trained partners`;

	// Parsed if training >= 1 OR not low literacy
	// Not parsed if: training === 0 AND low literacy AND considerable or above
	const notParsed = training === 0 && isLow && dangerNum >= 3;
	const parsed = !notParsed;

	const personaConclusion = parsed
		? `${persona.name} correctly reads ${dangerRating} and calibrates their exposure accordingly`
		: `${persona.name} may underestimate ${dangerRating} — without training, the scale lacks concrete meaning`;

	return {
		signalType: "danger_level",
		signalLabel: "Danger Level",
		forecasterIntent,
		personaConclusion,
		parsed,
	};
}

function buildHazardTypeSignal(problems: string[], persona: Persona): DecisionSignal {
	const primaryProblem = problems[0] ?? "unknown hazard";
	const training = persona.avalancheTrainingLevel ?? 0;
	const unknownLower = persona.unknownTerms.map((t) => t.toLowerCase());

	const forecasterIntent = `${primaryProblem} is the primary avalanche concern`;

	const problemLower = primaryProblem.toLowerCase();
	const problemIsUnknown = unknownLower.some((t) => problemLower.includes(t) || t.includes(problemLower));
	const parsed = !problemIsUnknown || training >= 2;

	const personaConclusion = parsed
		? `${persona.name} recognizes ${primaryProblem} as the main hazard and factors it into the plan`
		: `${persona.name} does not recognize "${primaryProblem}" as a meaningful term — hazard type goes unregistered`;

	return {
		signalType: "hazard_type",
		signalLabel: "Hazard Type",
		forecasterIntent,
		personaConclusion,
		parsed,
	};
}

function buildTerrainExclusionSignal(
	forecastText: string,
	persona: Persona,
	dangerLevelParsed: boolean,
): DecisionSignal {
	const terrainDescription = extractTerrainDescription(forecastText);
	const forecasterIntent = terrainDescription
		? `Avoid ${terrainDescription} today`
		: "Avoid steep avalanche terrain on the primary hazard aspects";

	const localFamiliarity = persona.localTerrainFamiliarity ?? 1;
	const terrainSkill = persona.terrainAssessmentSkill ?? 1;
	const training = persona.avalancheTrainingLevel ?? 0;

	const hasTerrainAbility = (localFamiliarity >= 3 && terrainSkill >= 2) || training >= 2;
	// Must also have parsed the danger level signal — if you don't understand the danger,
	// you won't act on terrain exclusion
	const parsed = hasTerrainAbility && dangerLevelParsed;

	const personaConclusion = parsed
		? `${persona.name} identifies the exclusion zone and adjusts terrain selection accordingly`
		: `${persona.name} does not correctly read the terrain exclusion zone — may enter the hazardous terrain`;

	return {
		signalType: "terrain_exclusion",
		signalLabel: "Terrain Exclusion",
		forecasterIntent,
		personaConclusion,
		parsed,
	};
}

// ---------------------------------------------------------------------------
// Confidence derivation
// ---------------------------------------------------------------------------

function computeConfidence(signals: DecisionSignal[], dangerRating: string): DecisionConfidence {
	const parsedCount = signals.filter((s) => s.parsed).length;
	const terrainSignal = signals.find((s) => s.signalType === "terrain_exclusion");

	// Terrain exclusion not parsed + considerable or above => always INVERTED
	if (terrainSignal && !terrainSignal.parsed && isConsiderableOrAbove(dangerRating)) {
		return "INVERTED";
	}

	if (parsedCount === 3) return "HIGH";
	if (parsedCount === 2) return "UNCERTAIN";
	return "INVERTED";
}

// ---------------------------------------------------------------------------
// Behavioral conclusion
// ---------------------------------------------------------------------------

function buildBehavioralConclusion(
	confidence: DecisionConfidence,
	riskTolerance: number,
	personaName: string,
	signals: DecisionSignal[],
): string {
	if (confidence === "INVERTED") {
		const firstUnparsed = signals.find((s) => !s.parsed);
		const gap = firstUnparsed
			? `they did not correctly read the ${firstUnparsed.signalLabel.toLowerCase()}`
			: "key safety signals were missed";
		return `${personaName} is likely to make a terrain decision that contradicts the forecaster's intent — ${gap}.`;
	}

	if (confidence === "HIGH") {
		if (riskTolerance <= 2)
			return `${personaName} correctly reads the hazard and will make a conservative terrain choice.`;
		if (riskTolerance >= 4) return `${personaName} understands the risk but may push into marginal terrain anyway.`;
		return `${personaName} has a clear picture and will adjust the plan appropriately.`;
	}

	// UNCERTAIN
	if (riskTolerance <= 2) return `${personaName} is missing pieces of the hazard picture but errs toward caution.`;
	if (riskTolerance >= 4)
		return `${personaName} has partial information and fills the gap with optimism — the dangerous case.`;
	return `${personaName} proceeds with an incomplete read on the conditions.`;
}

// ---------------------------------------------------------------------------
// Accuracy score
// ---------------------------------------------------------------------------

function computeAccuracyScore(signals: DecisionSignal[]): number {
	const danger = signals.find((s) => s.signalType === "danger_level");
	const hazard = signals.find((s) => s.signalType === "hazard_type");
	const terrain = signals.find((s) => s.signalType === "terrain_exclusion");

	return (danger?.parsed ? 25 : 0) + (hazard?.parsed ? 25 : 0) + (terrain?.parsed ? 50 : 0);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeDecisionMirror(
	forecastText: string,
	dangerRating: string,
	problems: string[],
	bottomLine: string | null,
	personas?: Persona[],
): DecisionMirrorResult[] {
	const activePersonas = personas ?? PERSONA_IDS.map((id) => PERSONAS[id]);
	const fullText = [forecastText, bottomLine].filter(Boolean).join("\n\n");

	return activePersonas.map((persona): DecisionMirrorResult => {
		const riskTolerance = persona.riskTolerance ?? 3;

		const dangerSignal = buildDangerLevelSignal(dangerRating, persona);
		const hazardSignal = buildHazardTypeSignal(problems, persona);
		const terrainSignal = buildTerrainExclusionSignal(fullText, persona, dangerSignal.parsed);

		const signals: DecisionSignal[] = [dangerSignal, hazardSignal, terrainSignal];

		const confidence = computeConfidence(signals, dangerRating);
		const accuracyScore = computeAccuracyScore(signals);
		const behavioralConclusion = buildBehavioralConclusion(confidence, riskTolerance, persona.name, signals);

		return {
			personaId: persona.id,
			personaName: persona.name,
			color: persona.color,
			confidence,
			accuracyScore,
			behavioralConclusion,
			signals,
		};
	});
}
