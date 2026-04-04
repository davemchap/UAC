/**
 * Persona Trainer component — DB persistence for persona configurations.
 * Seeded from hardcoded PERSONAS defaults; editable via API.
 */

import { eq } from "drizzle-orm";
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
};

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

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
				behavioralContext: null,
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
