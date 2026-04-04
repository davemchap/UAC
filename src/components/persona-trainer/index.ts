/**
 * Persona Trainer component — DB persistence for persona configurations.
 * Seeded from hardcoded PERSONAS defaults; editable via API.
 */

import { count, eq } from "drizzle-orm";
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
	updatedAt: Date | null;
	createdAt: Date | null;
}

export interface PersonaUpdate {
	name: string;
	role: string;
	color: string;
	literacyLevel: string;
	unknownTerms: string[];
	maxSentenceLength: number;
	maxGradeLevel: number;
	successCriteria: string;
	behavioralContext: string | null;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export async function seedPersonasIfNeeded(): Promise<void> {
	const db = getDb();
	const [{ value: existing }] = await db.select({ value: count() }).from(personas);
	if (existing > 0) return;

	for (const key of PERSONA_IDS) {
		const p = PERSONAS[key];
		await db.insert(personas).values({
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
		});
	}

	console.log(`[db] Personas seeded: ${PERSONA_IDS.length} defaults`);
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

export async function updatePersona(key: string, updates: Partial<PersonaUpdate>): Promise<PersonaRecord | null> {
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
