/**
 * Persona definitions for forecast usability scoring.
 * Personas are synthetic scoring subjects — not tool users.
 */

export type PersonaId = "jordan" | "priya" | "marcus" | "sasha" | "ryan_kowalczyk" | "colby_reyes";

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
			"persistent weak layer",
			"buried weak layer",
			"pwl",
			"storm slab",
			"wind slab",
			"persistent slab",
			"wet avalanche",
			"glide avalanche",
			"facets",
			"depth hoar",
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
			"persistent weak layer",
			"PWL",
			"facets",
			"depth hoar",
			"ECTP",
			"ECT",
			"spatial variability",
			"storm slab",
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
		travelMode: "human-powered",
		tags: ["recreational", "human-powered"],
		maxSentenceLength: 18,
		maxGradeLevel: 7.5,
		successCriteria:
			"Colby reads the forecast on his phone before leaving home, correctly understands that today is not a low-risk day, and either cancels the tour or adjusts the objective to something significantly lower-angle. He can explain the key reason to his group without needing to reference technical terms.",
		unknownTerms: [
			"persistent weak layer",
			"PWL",
			"facets",
			"depth hoar",
			"ECTP",
			"ECT",
			"storm slab",
			"wind slab",
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
} as const;

export const PERSONA_IDS: PersonaId[] = ["jordan", "priya", "marcus", "sasha", "ryan_kowalczyk", "colby_reyes"];
