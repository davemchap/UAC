/**
 * Persona Trainer component — DB persistence for persona configurations.
 * Seeded from hardcoded PERSONAS defaults; editable via API.
 */

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { personas } from "../db/schema";
import { PERSONA_IDS, PERSONAS } from "../scorecard/personas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PersonaRecord {
	id: number;
	personaKey: string;
	name: string;
	role: string;
	color: string;
	literacyLevel: string;
	unknownTerms: string[];
	maxSentenceLength: number;
	maxGradeLevel: number;
	successCriteria: string;
	behavioralContext: string | null;
	// Travel mode
	travelMode: string;
	// Domain dimensions
	yearsOfMountainExperience: number;
	avalancheTrainingLevel: number;
	backcountryDaysPerSeason: number;
	weatherPatternRecognition: number;
	terrainAssessmentSkill: number;
	groupDecisionTendency: number;
	riskTolerance: number;
	localTerrainFamiliarity: number;
	// Persona management
	active: boolean;
	tags: string[];
	isBuiltIn: boolean;
	// Avatar
	avatarSeed: string | null;
	avatarStyle: string;
	updatedAt: Date | null;
	createdAt: Date | null;
}

export interface PersonaUpdate {
	name?: string;
	role?: string;
	color?: string;
	literacyLevel?: string;
	unknownTerms?: string[];
	maxSentenceLength?: number;
	maxGradeLevel?: number;
	successCriteria?: string;
	behavioralContext?: string | null;
	// Travel mode
	travelMode?: string;
	// Domain dimensions
	yearsOfMountainExperience?: number;
	avalancheTrainingLevel?: number;
	backcountryDaysPerSeason?: number;
	weatherPatternRecognition?: number;
	terrainAssessmentSkill?: number;
	groupDecisionTendency?: number;
	riskTolerance?: number;
	localTerrainFamiliarity?: number;
	// Persona management
	active?: boolean;
	tags?: string[];
	// Avatar
	avatarSeed?: string | null;
	avatarStyle?: string;
}

// ---------------------------------------------------------------------------
// Seed dimension overrides per built-in persona
// ---------------------------------------------------------------------------

interface DimensionSeed {
	yearsOfMountainExperience: number;
	avalancheTrainingLevel: number;
	backcountryDaysPerSeason: number;
	weatherPatternRecognition: number;
	terrainAssessmentSkill: number;
	groupDecisionTendency: number;
	riskTolerance: number;
	localTerrainFamiliarity: number;
	tags: string[];
	travelMode?: string;
	avatarStyle?: string;
}

const PERSONA_DIMENSIONS: Record<string, DimensionSeed> = {
	jordan_mercer: {
		yearsOfMountainExperience: 4,
		avalancheTrainingLevel: 0,
		backcountryDaysPerSeason: 8,
		weatherPatternRecognition: 1,
		terrainAssessmentSkill: 1,
		groupDecisionTendency: 2,
		riskTolerance: 4,
		localTerrainFamiliarity: 2,
		tags: ["recreational"],
	},
	priya_sundaram: {
		yearsOfMountainExperience: 12,
		avalancheTrainingLevel: 2,
		backcountryDaysPerSeason: 35,
		weatherPatternRecognition: 3,
		terrainAssessmentSkill: 3,
		groupDecisionTendency: 3,
		riskTolerance: 3,
		localTerrainFamiliarity: 3,
		tags: ["recreational"],
	},
	marcus_ohlsson: {
		yearsOfMountainExperience: 18,
		avalancheTrainingLevel: 4,
		backcountryDaysPerSeason: 80,
		weatherPatternRecognition: 4,
		terrainAssessmentSkill: 5,
		groupDecisionTendency: 5,
		riskTolerance: 2,
		localTerrainFamiliarity: 4,
		tags: ["professional", "instructor"],
	},
	sasha_kowalski: {
		yearsOfMountainExperience: 22,
		avalancheTrainingLevel: 4,
		backcountryDaysPerSeason: 120,
		weatherPatternRecognition: 5,
		terrainAssessmentSkill: 5,
		groupDecisionTendency: 5,
		riskTolerance: 1,
		localTerrainFamiliarity: 5,
		tags: ["professional"],
	},
	ryan_kowalczyk: {
		yearsOfMountainExperience: 15,
		avalancheTrainingLevel: 0,
		backcountryDaysPerSeason: 30,
		weatherPatternRecognition: 2,
		terrainAssessmentSkill: 1,
		groupDecisionTendency: 4,
		riskTolerance: 4,
		localTerrainFamiliarity: 4,
		tags: ["recreational", "motorized"],
		travelMode: "motorized",
		avatarStyle: "avataaars",
	},
	colby_reyes: {
		yearsOfMountainExperience: 6,
		avalancheTrainingLevel: 0,
		backcountryDaysPerSeason: 20,
		weatherPatternRecognition: 1,
		terrainAssessmentSkill: 1,
		groupDecisionTendency: 4,
		riskTolerance: 3,
		localTerrainFamiliarity: 2,
		tags: ["recreational", "human-powered"],
		travelMode: "human-powered",
		avatarStyle: "avataaars",
	},
};

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

/** Default narrative voice for each built-in persona.
 *  Applied on startup only where behavioralContext IS NULL — never overwrites edits. */
const PERSONA_DEFAULT_CONTEXTS: Record<string, string> = {
	jordan: `Jordan reads avalanche forecasts the way most weekend recreationists do — scanning for the bottom line danger rating and quickly deciding "safe enough" or "not worth it." Technical language like "facets," "wind slab," or "propagation" gets skimmed past rather than absorbed. Jordan anchors heavily on the overall danger number and the headline recommendation, often missing nuance buried in the problem descriptions.

When something sounds scary, Jordan's instinct is to defer to a friend in the group rather than interpret the forecast independently. Jordan's primary question is always: "Is today a good day to go out?" — not "what specific terrain should I avoid?"`,

	priya: `Priya reads forecasts methodically, cross-referencing the danger rating against each named avalanche problem, then mapping those problems to her planned route by aspect and elevation band. She has strong terrain intuition built over many seasons and uses the forecast to confirm or challenge her existing plan — not just validate a "go/no-go."

Priya is generally conservative when uncertainty is high, but can be pulled toward optimism when a trip has been long-planned or the group energy is positive. Her main question when reading: "What does this mean for my specific objectives today, and what are my turnaround criteria?" She notices when forecasters hedge their language and treats that as a meaningful signal.`,

	marcus: `Marcus reads forecasts with professional precision, looking for subtleties recreational users miss: trend lines, spatial variability caveats, confidence qualifiers, and problem likelihood gradients. He mentally translates the forecast into client-facing language in real time — asking "how would I explain this to a group with mixed experience levels?" before he even finishes reading.

Marcus is particularly alert to persistent weak layer problems and wind slab setups that may catch clients off guard on otherwise benign-looking terrain. He holds himself to a higher standard of conservative decision-making when guiding than when traveling solo, and treats any uncertainty in forecast language as a reason to simplify his group's terrain choices.`,

	sasha: `Sasha engages with forecasts as a professional peer of the forecasting team — she reads for operational implications across her organization's entire area of responsibility. She's attuned to the forecaster's confidence level, the specificity of problem descriptions, and language that signals rapidly changing or poorly-understood conditions.

Sasha is building a staff and client briefing, so she needs information that is both technically accurate and communicable under time pressure. Her primary question is "what could surprise us today that our team might underestimate?" She uses the forecast as one input among several (recent field observations, staff experience reports, weather records) and flags any disconnect between the written forecast and what her team has seen on the ground.`,

	ryan_kowalczyk: `Ryan is a confident, experienced snowmobiler who has been riding these mountains since he was a teenager. He checks the UAC forecast but reads it fast — he's looking for a number and a color, then gets on with his day. He knows what "High" means but often convinces himself that his local knowledge means the danger is lower for the zones he rides. When his buddy says "the face looks good," that carries more weight than a warning in a forecast. Ryan is not reckless — he lost his best friend to an avalanche and it changed him. But the group dynamic is powerful, and once they're at the trailhead with sleds unloaded, the sunk cost of a two-hour drive is real. He doesn't know what "persistent weak layer" means. He does understand "remote triggering" if it's explained in plain terms: "a sled on the bench below can pull the slope above." Specific run-out language and terrain trap warnings reach him; jargon-heavy snowpack narratives do not.`,

	colby_reyes: `Colby got into splitboarding because his co-workers at the startup were into it and it looked incredible on Instagram. He bought a full kit — beacon, probe, shovel — before he took any formal training. He's been out 20 days but mostly following people who know more than him, which has kept him safe so far. He took a short ride in a small slide near Alpental last season and was unhurt but shaken — it made him more cautious, though he's not sure what to do differently. Colby checks the UAC forecast on his phone the night before and reads the danger number. He understands that 4 and 5 are bad. He does not understand avalanche problem types, likelihood descriptors, or what "wind slab on north-facing terrain above 8,500 feet" means in terms of what he should actually do. He learns through YouTube and social media. A forecast that tells him specifically "don't skin the north-facing ridgeline above Snoqualmie Pass today" reaches him. A forecast full of snowpack layer names does not.`,
};

/** Fill in default behavioral context for built-in personas that have none yet.
 *  Safe to call on every startup — only updates rows where behavioralContext IS NULL. */
export async function backfillPersonaDefaults(): Promise<void> {
	const db = getDb();
	for (const [key, context] of Object.entries(PERSONA_DEFAULT_CONTEXTS)) {
		await db
			.update(personas)
			.set({ behavioralContext: context })
			.where(and(eq(personas.personaKey, key), isNull(personas.behavioralContext)));
	}
	console.log("[db] Persona behavioral contexts backfilled where missing");
}

export async function seedPersonasIfNeeded(): Promise<void> {
	const db = getDb();

	for (const key of PERSONA_IDS) {
		const p = PERSONAS[key];
		const dims = PERSONA_DIMENSIONS[p.id] ?? {};

		await db
			.insert(personas)
			.values({
				personaKey: p.id,
				name: p.name,
				role: p.role,
				color: p.color,
				literacyLevel: p.literacyLevel,
				unknownTerms: [...p.unknownTerms],
				maxSentenceLength: p.maxSentenceLength,
				maxGradeLevel: p.maxGradeLevel,
				successCriteria: p.successCriteria,
				behavioralContext: PERSONA_DEFAULT_CONTEXTS[p.id] ?? null,
				isBuiltIn: true,
				...dims,
			})
			.onConflictDoUpdate({
				target: personas.personaKey,
				set: {
					isBuiltIn: true,
					...dims,
				},
			});
	}

	console.log(`[db] Personas seeded/updated: ${PERSONA_IDS.length} built-ins`);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getAllPersonas(): Promise<PersonaRecord[]> {
	const db = getDb();
	return db.select().from(personas).orderBy(personas.id);
}

export async function getPersonaByKey(key: string): Promise<PersonaRecord | null> {
	const db = getDb();
	const rows = await db.select().from(personas).where(eq(personas.personaKey, key));
	return rows[0] ?? null;
}

export async function updatePersona(key: string, updates: PersonaUpdate): Promise<PersonaRecord | null> {
	const db = getDb();
	const rows = await db
		.update(personas)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(personas.personaKey, key))
		.returning();
	return rows[0] ?? null;
}

export async function injectInstruction(key: string, instruction: string): Promise<PersonaRecord | null> {
	const existing = await getPersonaByKey(key);
	if (!existing) return null;

	const timestamp = new Date().toISOString().slice(0, 10);
	const entry = `[${timestamp}] ${instruction}`;
	const updated = existing.behavioralContext ? `${existing.behavioralContext}\n\n---\n\n${entry}` : entry;

	return updatePersona(key, { behavioralContext: updated });
}

export async function clonePersona(
	sourceKey: string,
	newKey: string,
	name: string,
	role: string,
): Promise<PersonaRecord | null> {
	const source = await getPersonaByKey(sourceKey);
	if (!source) return null;

	const db = getDb();
	const rows = await db
		.insert(personas)
		.values({
			personaKey: newKey,
			name,
			role,
			color: source.color,
			literacyLevel: source.literacyLevel,
			unknownTerms: [...source.unknownTerms],
			maxSentenceLength: source.maxSentenceLength,
			maxGradeLevel: source.maxGradeLevel,
			successCriteria: source.successCriteria,
			behavioralContext: source.behavioralContext,
			travelMode: source.travelMode,
			yearsOfMountainExperience: source.yearsOfMountainExperience,
			avalancheTrainingLevel: source.avalancheTrainingLevel,
			backcountryDaysPerSeason: source.backcountryDaysPerSeason,
			weatherPatternRecognition: source.weatherPatternRecognition,
			terrainAssessmentSkill: source.terrainAssessmentSkill,
			groupDecisionTendency: source.groupDecisionTendency,
			riskTolerance: source.riskTolerance,
			localTerrainFamiliarity: source.localTerrainFamiliarity,
			active: source.active,
			tags: [...source.tags],
			isBuiltIn: false,
			avatarSeed: source.avatarSeed,
			avatarStyle: source.avatarStyle,
		})
		.returning();

	return rows[0] ?? null;
}

export async function deletePersona(key: string): Promise<boolean> {
	const existing = await getPersonaByKey(key);
	if (!existing || existing.isBuiltIn) return false;

	const db = getDb();
	await db.delete(personas).where(eq(personas.personaKey, key));
	return true;
}
