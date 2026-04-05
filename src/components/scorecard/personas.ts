/**
 * Persona definitions for forecast usability scoring.
 * Personas are synthetic scoring subjects — not tool users.
 */

export type PersonaId =
	| "jordan"
	| "priya"
	| "marcus"
	| "sasha"
	| "ryan_kowalczyk"
	| "colby_reyes"
	| "stuart"
	| "beth"
	| "mike";

// Shared unknown-term constants (prevent sonarjs/no-duplicate-string)
const T_PWL = "persistent weak layer";
const T_BWL = "buried weak layer";
const T_STORM_SLAB = "storm slab";
const T_WIND_SLAB = "wind slab";
const T_FACETS = "facets";
const T_DEPTH_HOAR = "depth hoar";
const T_HUMAN_POWERED = "human-powered";

export interface Persona {
	id: PersonaId;
	name: string;
	role: string;
	color: string;
	literacyLevel: "low" | "high" | "expert" | "forecaster";
	/** Terms this persona does NOT understand */
	unknownTerms: readonly string[];
	/** Max comfortable sentence length (words) */
	maxSentenceLength: number;
	/** Min acceptable Flesch-Kincaid grade level (above = penalized) */
	maxGradeLevel: number;
	/** What a successful forecast interaction looks like */
	successCriteria: string;
	/** Audience classification tags — used to split recreational/professional grades */
	tags?: readonly string[];
	// Domain dimensions — populated from DB at runtime; scoring adjusts thresholds accordingly
	/** Years spent in mountain terrain (0–30) */
	yearsOfMountainExperience?: number;
	/** Formal avalanche training: 0=None 1=Awareness 2=AIARE1 3=AIARE2 4=Pro1 5=Pro2+ */
	avalancheTrainingLevel?: number;
	/** Backcountry field days per season (0–120) */
	backcountryDaysPerSeason?: number;
	/** Ability to interpret weather patterns (1–5) */
	weatherPatternRecognition?: number;
	/** Terrain hazard evaluation skill (1–5) */
	terrainAssessmentSkill?: number;
	/** Decision conservatism: 1=very conservative 5=aggressive (3=calibrated) */
	riskTolerance?: number;
	/** 1=solo decisions 5=highly consensus-driven */
	groupDecisionTendency?: number;
	/** Familiarity with local terrain features (1–5) */
	localTerrainFamiliarity?: number;
	/** Travel mode — affects actionability signal weighting: "motorized" | "human-powered" | "out-of-bounds" */
	travelMode?: string;
}

export const PERSONAS: Record<PersonaId, Persona> = {
	jordan: {
		id: "jordan",
		name: "Jordan Mercer",
		role: "Casual Recreationist",
		color: "#F59E0B",
		literacyLevel: "low",
		tags: ["recreational"],
		maxSentenceLength: 25,
		maxGradeLevel: 8,
		successCriteria: "Makes correct go/no-go decision for skill level",
		unknownTerms: [
			T_PWL,
			T_BWL,
			"pwl",
			T_STORM_SLAB,
			T_WIND_SLAB,
			"persistent slab",
			"wet avalanche",
			"glide avalanche",
			T_FACETS,
			T_DEPTH_HOAR,
			"graupel",
			"solar radiation loading",
			"solar aspect",
			"convexity",
			"swe",
			"hs",
			"hn72",
			"hn24",
			"utc",
			"d1",
			"d2",
			"d3",
			"d4",
			"d5",
			"trigger point",
			"propagation",
			"likelihood",
			"spatial distribution",
			"isolated",
			"specific",
			"widespread",
			"terrain trap",
			"aspect",
			"leeward",
			"windward",
			"cross-loaded",
			"convex roll",
			"overhead hazard",
			"cornice",
			"crown",
			"debris",
			"runout zone",
			"natural cycle",
			"natural avalanche",
			"human triggered",
			"reactive snowpack",
			"settlement",
			"temperature gradient",
			"crust",
			"melt-freeze crust",
			"rain crust",
			"solar warming",
			"inversion",
			"loading rate",
			"shooting cracks",
			"whumpfing",
		],
	},
	priya: {
		id: "priya",
		name: "Priya Sundaram",
		role: "Experienced Backcountry Traveler",
		color: "#0D9488",
		literacyLevel: "high",
		tags: ["recreational", "experienced"],
		maxSentenceLength: 40,
		maxGradeLevel: 12,
		successCriteria: "Accurate hazard-based route plan with correct terrain selection",
		unknownTerms: ["snotel", "awdb", "nwac", "caic style", "forecaster notation", "internal layer naming"],
	},
	marcus: {
		id: "marcus",
		name: "Marcus Ohlsson",
		role: "Guide / Avalanche Educator",
		color: "#6366F1",
		literacyLevel: "expert",
		tags: ["professional", "educator"],
		maxSentenceLength: 60,
		maxGradeLevel: 16,
		successCriteria: "Specific, defensible client briefing aligned with forecast",
		unknownTerms: [],
	},
	sasha: {
		id: "sasha",
		name: "Sasha Kowalski",
		role: "Snow Safety Professional",
		color: "#64748B",
		literacyLevel: "forecaster",
		tags: ["professional", "forecaster"],
		maxSentenceLength: 80,
		maxGradeLevel: 18,
		successCriteria: "Forecast passes peer review without substantive revision",
		unknownTerms: [],
	},
	ryan_kowalczyk: {
		id: "ryan_kowalczyk",
		name: "Ryan Kowalczyk",
		role: "Recreational snowmobiler, co-owns a construction company",
		color: "#ea580c",
		literacyLevel: "low",
		travelMode: "motorized",
		tags: ["recreational", "motorized"],
		maxSentenceLength: 20,
		maxGradeLevel: 8.0,
		successCriteria:
			"Ryan reads the forecast, correctly identifies that today is a high-consequence day for the terrain he rides, and either postpones his trip or explicitly changes his planned zones. He can tell his riding group in plain terms why they should avoid a specific area. He does not interpret 'Considerable' as moderate or acceptable.",
		unknownTerms: [
			T_PWL,
			"PWL",
			T_FACETS,
			T_DEPTH_HOAR,
			"ECTP",
			"ECT",
			"spatial variability",
			T_STORM_SLAB,
			"likelihood",
			"D3",
			"D4",
			"propagation",
			"aspect",
			"terrain trap",
			"convexity",
			"isothermal",
		],
	},
	colby_reyes: {
		id: "colby_reyes",
		name: "Colby Reyes",
		role: "Software developer, splitboarder",
		color: "#7c3aed",
		literacyLevel: "low",
		travelMode: T_HUMAN_POWERED,
		tags: ["recreational", T_HUMAN_POWERED],
		maxSentenceLength: 18,
		maxGradeLevel: 7.5,
		successCriteria:
			"Colby reads the forecast on his phone before leaving home, correctly understands that today is not a low-risk day, and either cancels the tour or adjusts the objective to something significantly lower-angle. He can explain the key reason to his group without needing to reference technical terms.",
		unknownTerms: [
			T_PWL,
			"PWL",
			T_FACETS,
			T_DEPTH_HOAR,
			"ECTP",
			"ECT",
			T_STORM_SLAB,
			T_WIND_SLAB,
			"likelihood",
			"D2",
			"D3",
			"aspect",
			"propagation",
			"spatial variability",
			"isothermal",
			"spaghetti model",
			"SWE",
			"HN72",
		],
	},
	stuart: {
		id: "stuart",
		name: "Stuart Chambers",
		role: "Family physician, backcountry touring newbie",
		color: "#0EA5E9",
		literacyLevel: "low",
		travelMode: T_HUMAN_POWERED,
		tags: ["recreational", "family", T_HUMAN_POWERED],
		maxSentenceLength: 30,
		maxGradeLevel: 10,
		successCriteria:
			"Stuart correctly identifies that today's conditions exceed the risk threshold for a family tour, communicates a specific terrain limit to his group, and can explain in plain language why one slope is safer than another.",
		unknownTerms: [
			T_PWL,
			T_BWL,
			"pwl",
			T_STORM_SLAB,
			T_WIND_SLAB,
			"persistent slab",
			"wet avalanche",
			"glide avalanche",
			T_FACETS,
			T_DEPTH_HOAR,
			"graupel",
			"swe",
			"hs",
			"hn72",
			"hn24",
			"d1",
			"d2",
			"d3",
			"d4",
			"d5",
			"convexity",
			"terrain trap",
			"leeward",
			"windward",
			"cross-loaded",
			"propagation",
			"spatial distribution",
			"isolated",
			"specific",
			"widespread",
			"trigger point",
			"natural cycle",
			"natural avalanche",
			"human triggered",
			"reactive snowpack",
			"melt-freeze crust",
			"loading rate",
			"shooting cracks",
			"whumpfing",
			"cornice",
			"runout zone",
			"crown",
		],
	},
	beth: {
		id: "beth",
		name: "Beth Thornton",
		role: "Nonprofit exec director, skimo racer",
		color: "#EC4899",
		literacyLevel: "high",
		travelMode: T_HUMAN_POWERED,
		tags: ["recreational", T_HUMAN_POWERED, "athlete"],
		maxSentenceLength: 45,
		maxGradeLevel: 12,
		successCriteria:
			"Beth reads the forecast in under 3 minutes, correctly identifies the primary hazard and its relevant elevation band, and adjusts her planned route to avoid it — communicating the change to her group before they leave the car.",
		unknownTerms: [
			T_PWL,
			T_BWL,
			"pwl",
			T_FACETS,
			T_DEPTH_HOAR,
			"propagation",
			"swe",
			"hn72",
			"hn24",
			"d4",
			"d5",
			"cross-loaded",
			"spatial variability",
			"ectp",
			"ect",
			"reactive snowpack",
			"temperature gradient",
			"loading rate",
		],
	},
	mike: {
		id: "mike",
		name: "Mike Baxter",
		role: "Environmental scientist, once-a-year BC skier",
		color: "#84CC16",
		literacyLevel: "high",
		travelMode: T_HUMAN_POWERED,
		tags: ["recreational", T_HUMAN_POWERED, "remote"],
		maxSentenceLength: 50,
		maxGradeLevel: 14,
		successCriteria:
			"Mike understands the specific hazard profile for his planned hut-to-hut route, can articulate the key risk to his more experienced partners, and does not defer blindly when the group suggests a route that contradicts the forecast.",
		unknownTerms: [
			T_PWL,
			"pwl",
			T_STORM_SLAB,
			T_WIND_SLAB,
			T_FACETS,
			T_DEPTH_HOAR,
			"swe",
			"hn72",
			"d3",
			"d4",
			"d5",
			"terrain trap",
			"convexity",
			"cornice",
			"cross-loaded",
			"shooting cracks",
			"whumpfing",
			"ectp",
		],
	},
} as const;

export const PERSONA_IDS: PersonaId[] = [
	"jordan",
	"priya",
	"marcus",
	"sasha",
	"ryan_kowalczyk",
	"colby_reyes",
	"stuart",
	"beth",
	"mike",
];
