import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { fieldObservations } from "../db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ObservationInput {
	observerName: string;
	observerEmail: string;
	experienceLevel: string;
	zoneSlug: string;
	areaName?: string | null;
	aspect?: string | null;
	elevationFt?: number | null;
	observedAt: Date;
	obsTypes: string[];
	// Avalanche
	avalancheType?: string | null;
	trigger?: string | null;
	sizeR?: number | null;
	sizeD?: number | null;
	widthFt?: number | null;
	verticalFt?: number | null;
	depthIn?: number | null;
	// Snowpack
	surfaceConditions?: string | null;
	snowDepthIn?: number | null;
	stormSnowIn?: number | null;
	weakLayers?: boolean | null;
	weakLayersDesc?: string | null;
	// Weather
	skyCover?: string | null;
	windSpeed?: string | null;
	windDirection?: string | null;
	temperatureF?: number | null;
	precip?: string | null;
	// Field notes
	fieldNotes?: string | null;
}

export type ObservationRow = typeof fieldObservations.$inferSelect;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidEmail(email: string): boolean {
	const at = email.indexOf("@");
	if (at < 1) return false;
	const dot = email.lastIndexOf(".");
	return dot > at + 1 && dot < email.length - 1;
}

export function validateObservation(input: ObservationInput): string[] {
	const errors: string[] = [];
	if (!input.observerName.trim()) errors.push("Observer name is required");
	if (!input.observerEmail.trim()) errors.push("Observer email is required");
	else if (!isValidEmail(input.observerEmail)) errors.push("Observer email must be valid");
	if (!input.zoneSlug.trim()) errors.push("Zone is required");
	if (Number.isNaN(input.observedAt.getTime())) errors.push("Observation date is required");
	if (!input.obsTypes.length) errors.push("At least one observation type is required");
	return errors;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function submitObservation(input: ObservationInput): Promise<ObservationRow> {
	const [row] = await getDb().insert(fieldObservations).values(input).returning();
	return row;
}

export async function getObservationsByZone(zoneSlug: string): Promise<ObservationRow[]> {
	return getDb()
		.select()
		.from(fieldObservations)
		.where(eq(fieldObservations.zoneSlug, zoneSlug))
		.orderBy(desc(fieldObservations.observedAt));
}

export async function getRecentObservations(limit = 50): Promise<ObservationRow[]> {
	return getDb().select().from(fieldObservations).orderBy(desc(fieldObservations.observedAt)).limit(limit);
}
