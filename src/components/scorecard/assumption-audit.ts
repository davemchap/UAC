/**
 * Assumption Audit component.
 * Analyzes implicit knowledge requirements in avalanche forecast text and
 * maps each detected concept to persona knowledge gaps.
 * Pure functions — no DB access, no side effects.
 */

import { PERSONAS, PERSONA_IDS, type PersonaId, type Persona } from "./personas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KnowledgeDomain =
	| "avalanche_problem"
	| "terrain"
	| "snowpack"
	| "danger_scale"
	| "decision_framework"
	| "local_knowledge";

export interface ConceptRequirement {
	concept: string;
	domain: KnowledgeDomain;
	requiredTrainingLevel: number; // 0–4: minimum avy training to understand this
	triggerPhrases: string[]; // phrases in forecast text that triggered this concept
	criticalityWeight: number; // 1.0 = normal, 2.0 = safety-critical
}

export interface PersonaConceptGap {
	personaId: PersonaId;
	personaName: string;
	color: string;
	conceptsKnown: string[]; // concept names persona knows
	conceptsPartial: string[]; // concept names persona partially knows (yellow)
	conceptsUnknown: string[]; // concept names persona doesn't know (red)
	misreadRisk: number; // 0–100: weighted gap score
}

export interface AssumptionAuditResult {
	conceptInventory: ConceptRequirement[];
	personaGaps: PersonaConceptGap[];
	assumptionDensityScore: number; // 0–100: concepts per paragraph, normalized
	mostCriticalGap: string; // concept name with highest criticality × gap count
}

// ---------------------------------------------------------------------------
// Concept taxonomy
// ---------------------------------------------------------------------------

interface TaxonomyEntry {
	concept: string;
	domain: KnowledgeDomain;
	requiredTrainingLevel: number;
	triggerPhrases: string[];
	criticalityWeight: number;
	/** If set, only applies to personas with this travelMode */
	travelModeOnly?: string;
}

const CONCEPT_TAXONOMY: TaxonomyEntry[] = [
	{
		concept: "Persistent weak layer dynamics",
		domain: "snowpack",
		requiredTrainingLevel: 2,
		triggerPhrases: ["persistent weak layer", "pwl", "buried weak layer"],
		criticalityWeight: 2.0,
	},
	{
		concept: "Wind slab formation and location",
		domain: "snowpack",
		requiredTrainingLevel: 1,
		triggerPhrases: ["wind slab", "wind-loaded", "cross-loaded", "leeward"],
		criticalityWeight: 1.5,
	},
	{
		concept: "Storm slab behavior",
		domain: "avalanche_problem",
		requiredTrainingLevel: 1,
		triggerPhrases: ["storm slab", "new snow"],
		criticalityWeight: 1.0,
	},
	{
		concept: "Aspect and slope angle interpretation",
		domain: "terrain",
		requiredTrainingLevel: 1,
		triggerPhrases: ["north-facing", "south-facing", "northeast", "northwest", "aspect", "N/NE/E"],
		criticalityWeight: 2.0,
	},
	{
		concept: "Elevation band hazard zoning",
		domain: "terrain",
		requiredTrainingLevel: 1,
		triggerPhrases: ["above treeline", "near treeline", "below treeline", "upper elevation", "lower elevation"],
		criticalityWeight: 1.5,
	},
	{
		concept: "Avalanche danger scale calibration",
		domain: "danger_scale",
		requiredTrainingLevel: 0,
		triggerPhrases: ["considerable", "high danger", "extreme", "low danger", "moderate danger"],
		criticalityWeight: 2.0,
	},
	{
		concept: "Likelihood descriptor meaning",
		domain: "decision_framework",
		requiredTrainingLevel: 1,
		triggerPhrases: ["unlikely", "likely", "very likely", "possible"],
		criticalityWeight: 1.5,
	},
	{
		concept: "Terrain trap identification",
		domain: "terrain",
		requiredTrainingLevel: 1,
		triggerPhrases: ["terrain trap", "gully", "creek bed", "cliff band below"],
		criticalityWeight: 1.5,
	},
	{
		concept: "Cornice hazard",
		domain: "terrain",
		requiredTrainingLevel: 1,
		triggerPhrases: ["cornice", "cornices", "cornice fall"],
		criticalityWeight: 1.0,
	},
	{
		concept: "Remote triggering risk",
		domain: "decision_framework",
		requiredTrainingLevel: 2,
		triggerPhrases: ["remote trigger", "remotely triggered", "trigger from below"],
		criticalityWeight: 2.0,
	},
	{
		concept: "Facets and depth hoar formation",
		domain: "snowpack",
		requiredTrainingLevel: 2,
		triggerPhrases: ["facets", "depth hoar", "faceted", "temperature gradient"],
		criticalityWeight: 1.0,
	},
	{
		concept: "Snowpack settlement and stabilization",
		domain: "snowpack",
		requiredTrainingLevel: 2,
		triggerPhrases: ["settlement", "settling", "stabilizing", "settling out"],
		criticalityWeight: 1.0,
	},
	{
		concept: "Natural vs human-triggered distinction",
		domain: "decision_framework",
		requiredTrainingLevel: 1,
		triggerPhrases: ["natural avalanche", "human-triggered", "human triggered", "natural cycle"],
		criticalityWeight: 2.0,
	},
	{
		concept: "Spatial distribution of hazard",
		domain: "decision_framework",
		requiredTrainingLevel: 1,
		triggerPhrases: ["isolated", "specific", "widespread", "spatial"],
		criticalityWeight: 1.5,
	},
	{
		concept: "Runout zone and consequence size",
		domain: "terrain",
		requiredTrainingLevel: 1,
		triggerPhrases: ["runout", "runout zone", "D3", "D4", "destructive"],
		criticalityWeight: 1.5,
	},
	{
		concept: "Travel advice interpretation",
		domain: "decision_framework",
		requiredTrainingLevel: 0,
		triggerPhrases: ["avoid avalanche terrain", "conservative travel", "one at a time", "safe zone"],
		criticalityWeight: 2.0,
	},
	{
		concept: "Snowmobile-specific terrain hazards",
		domain: "terrain",
		requiredTrainingLevel: 1,
		triggerPhrases: ["convexity", "rollover", "meadow shot", "highmark", "throttle"],
		criticalityWeight: 2.0,
		travelModeOnly: "motorized",
	},
	{
		concept: "Trend and timing of conditions",
		domain: "decision_framework",
		requiredTrainingLevel: 1,
		triggerPhrases: ["increasing", "decreasing", "afternoon", "warming", "cooling", "overnight"],
		criticalityWeight: 1.0,
	},
	{
		concept: "Snowpack test results",
		domain: "snowpack",
		requiredTrainingLevel: 2,
		triggerPhrases: ["ECTP", "ECT", "ECTX", "ECTN", "propagation"],
		criticalityWeight: 1.0,
	},
	{
		concept: "Surface hoar burial risk",
		domain: "snowpack",
		requiredTrainingLevel: 2,
		triggerPhrases: ["surface hoar", "SH", "buried surface hoar"],
		criticalityWeight: 1.5,
	},
];

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

/**
 * Detects which concepts from the taxonomy are triggered by the forecast text.
 * Returns only concepts whose trigger phrases appear in the text (case-insensitive).
 */
function detectConcepts(forecastText: string): ConceptRequirement[] {
	const lowerText = forecastText.toLowerCase();
	const detected: ConceptRequirement[] = [];

	for (const entry of CONCEPT_TAXONOMY) {
		const triggeredPhrases = entry.triggerPhrases.filter((phrase) => lowerText.includes(phrase.toLowerCase()));
		if (triggeredPhrases.length > 0) {
			detected.push({
				concept: entry.concept,
				domain: entry.domain,
				requiredTrainingLevel: entry.requiredTrainingLevel,
				triggerPhrases: triggeredPhrases,
				criticalityWeight: entry.criticalityWeight,
			});
		}
	}

	return detected;
}

// ---------------------------------------------------------------------------
// Persona gap classification
// ---------------------------------------------------------------------------

type GapLevel = "known" | "partial" | "unknown";

/**
 * Classify how well a persona understands a single concept.
 *
 * Rules:
 * - danger_scale domain: everyone gets at least Partial (everyone knows the 1-5 scale)
 *   training=0 + any danger_scale concept → Partial (not Known)
 * - snowmobile concept (#17): only contributes gap for motorized personas
 * - Known: training >= requiredTrainingLevel AND no trigger phrase in unknownTerms
 * - Partial: training >= requiredTrainingLevel - 1 AND at least one trigger phrase
 *   is recognized but at least one is in unknownTerms
 * - Unknown: training < requiredTrainingLevel OR primary trigger phrase is in unknownTerms
 */
function classifyConceptGap(concept: ConceptRequirement, persona: Persona, taxonomyEntry: TaxonomyEntry): GapLevel {
	const training = persona.avalancheTrainingLevel ?? 0;
	const lowerUnknown = persona.unknownTerms.map((t) => t.toLowerCase());

	// Snowmobile-specific: non-motorized personas are not affected (treat as known/N/A)
	if (taxonomyEntry.travelModeOnly === "motorized" && persona.travelMode !== "motorized") {
		return "known";
	}

	// Check how many trigger phrases are in the persona's unknown terms
	const unknownTriggers = concept.triggerPhrases.filter((phrase) => lowerUnknown.includes(phrase.toLowerCase()));
	const knownTriggers = concept.triggerPhrases.filter((phrase) => !lowerUnknown.includes(phrase.toLowerCase()));

	// danger_scale domain special rule
	if (concept.domain === "danger_scale") {
		// Everyone knows there's a 1-5 scale — minimum Partial
		if (training >= concept.requiredTrainingLevel && unknownTriggers.length === 0) {
			// training=0 still only gets Partial for danger_scale
			if (training === 0) return "partial";
			return "known";
		}
		return "partial";
	}

	// Standard classification
	if (training >= concept.requiredTrainingLevel && unknownTriggers.length === 0) {
		return "known";
	}

	if (training >= concept.requiredTrainingLevel - 1 && knownTriggers.length > 0 && unknownTriggers.length > 0) {
		return "partial";
	}

	return "unknown";
}

/**
 * Build gap analysis for a single persona across all detected concepts.
 */
function buildPersonaGap(persona: Persona, conceptInventory: ConceptRequirement[]): PersonaConceptGap {
	const conceptsKnown: string[] = [];
	const conceptsPartial: string[] = [];
	const conceptsUnknown: string[] = [];

	for (const concept of conceptInventory) {
		// Find the original taxonomy entry to access travelModeOnly
		const taxonomyEntry = CONCEPT_TAXONOMY.find((e) => e.concept === concept.concept);
		if (!taxonomyEntry) continue;

		const gap = classifyConceptGap(concept, persona, taxonomyEntry);
		if (gap === "known") {
			conceptsKnown.push(concept.concept);
		} else if (gap === "partial") {
			conceptsPartial.push(concept.concept);
		} else {
			conceptsUnknown.push(concept.concept);
		}
	}

	// misreadRisk formula:
	// sum(unknown.criticality * 2 + partial.criticality * 1) / (total.criticality * 2) * 100
	const totalCriticalityWeight2 = conceptInventory.reduce((sum, c) => sum + c.criticalityWeight * 2, 0);

	let numerator = 0;
	for (const concept of conceptInventory) {
		const taxonomyEntry = CONCEPT_TAXONOMY.find((e) => e.concept === concept.concept);
		if (!taxonomyEntry) continue;
		const gap = classifyConceptGap(concept, persona, taxonomyEntry);
		if (gap === "unknown") {
			numerator += concept.criticalityWeight * 2;
		} else if (gap === "partial") {
			numerator += concept.criticalityWeight * 1;
		}
	}

	const misreadRisk =
		totalCriticalityWeight2 > 0 ? Math.min(100, Math.round((numerator / totalCriticalityWeight2) * 100)) : 0;

	return {
		personaId: persona.id,
		personaName: persona.name,
		color: persona.color,
		conceptsKnown,
		conceptsPartial,
		conceptsUnknown,
		misreadRisk,
	};
}

// ---------------------------------------------------------------------------
// Aggregate metrics
// ---------------------------------------------------------------------------

/**
 * assumptionDensityScore: how many concepts per paragraph, normalized to 0–100.
 * 10 concepts per paragraph = 100.
 */
function computeAssumptionDensityScore(forecastText: string, conceptCount: number): number {
	const paragraphs = forecastText.split(/\n\n+/).filter((p) => p.trim().length > 0);
	const paragraphCount = Math.max(1, paragraphs.length);
	return Math.min(100, (conceptCount / paragraphCount) * 10);
}

/**
 * Find the concept with the highest (criticalityWeight × count of personas with Unknown gap).
 */
function findMostCriticalGap(conceptInventory: ConceptRequirement[], personaGaps: PersonaConceptGap[]): string {
	if (conceptInventory.length === 0) return "";

	let bestConcept = conceptInventory[0].concept;
	let bestScore = -1;

	for (const concept of conceptInventory) {
		const unknownCount = personaGaps.filter((pg) => pg.conceptsUnknown.includes(concept.concept)).length;
		const score = concept.criticalityWeight * unknownCount;
		if (score > bestScore) {
			bestScore = score;
			bestConcept = concept.concept;
		}
	}

	return bestConcept;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Analyze the implicit knowledge assumptions in a forecast and map gaps per persona.
 *
 * @param forecastText - Full forecast text (all sections combined)
 * @param dangerRating - Danger rating string (e.g. "Considerable (3)")
 * @param problems - Array of avalanche problem descriptions
 * @param personas - Optional runtime personas with dimension values; defaults to static PERSONAS
 */
export function analyzeAssumptions(
	forecastText: string,
	dangerRating: string,
	problems: string[],
	personas?: Persona[],
): AssumptionAuditResult {
	const activePersonas = personas ?? PERSONA_IDS.map((id) => PERSONAS[id]);

	// Combine all text for detection
	const allText = [forecastText, dangerRating, ...problems.filter(Boolean)].join("\n\n");

	const conceptInventory = detectConcepts(allText);

	const personaGaps = activePersonas.map((persona) => buildPersonaGap(persona, conceptInventory));

	const assumptionDensityScore = computeAssumptionDensityScore(forecastText, conceptInventory.length);

	const mostCriticalGap = findMostCriticalGap(conceptInventory, personaGaps);

	return {
		conceptInventory,
		personaGaps,
		assumptionDensityScore,
		mostCriticalGap,
	};
}
