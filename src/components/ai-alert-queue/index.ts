import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { aiAlerts, forecastZones } from "../db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueuedAlert {
	id: number;
	zoneId: number;
	zoneName: string;
	zoneSlug: string;
	lat: number;
	lon: number;
	dangerRating: string;
	dangerLevel: number;
	dangerAboveTreelineRating: string;
	dangerAboveTreelineLevel: number;
	dangerNearTreelineRating: string;
	dangerNearTreelineLevel: number;
	dangerBelowTreelineRating: string;
	dangerBelowTreelineLevel: number;
	avalancheProblems: string[];
	alertAction: string;
	alertReasoning: string;
	backcountrySummary: string;
	status: string;
	sentAt: Date | null;
	createdAt: Date | null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getAlertQueue(status = "pending"): Promise<QueuedAlert[]> {
	const db = getDb();
	return db
		.select({
			id: aiAlerts.id,
			zoneId: aiAlerts.zoneId,
			zoneName: forecastZones.name,
			zoneSlug: forecastZones.slug,
			lat: forecastZones.lat,
			lon: forecastZones.lon,
			dangerRating: aiAlerts.dangerRating,
			dangerLevel: aiAlerts.dangerLevel,
			dangerAboveTreelineRating: aiAlerts.dangerAboveTreelineRating,
			dangerAboveTreelineLevel: aiAlerts.dangerAboveTreelineLevel,
			dangerNearTreelineRating: aiAlerts.dangerNearTreelineRating,
			dangerNearTreelineLevel: aiAlerts.dangerNearTreelineLevel,
			dangerBelowTreelineRating: aiAlerts.dangerBelowTreelineRating,
			dangerBelowTreelineLevel: aiAlerts.dangerBelowTreelineLevel,
			avalancheProblems: aiAlerts.avalancheProblems,
			alertAction: aiAlerts.alertAction,
			alertReasoning: aiAlerts.alertReasoning,
			backcountrySummary: aiAlerts.backcountrySummary,
			status: aiAlerts.status,
			sentAt: aiAlerts.sentAt,
			createdAt: aiAlerts.createdAt,
		})
		.from(aiAlerts)
		.innerJoin(forecastZones, eq(aiAlerts.zoneId, forecastZones.zoneId))
		.where(eq(aiAlerts.status, status))
		.orderBy(desc(aiAlerts.dangerLevel), desc(aiAlerts.createdAt));
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function updateAlertSummary(id: number, backcountrySummary: string): Promise<QueuedAlert | null> {
	const db = getDb();
	const rows = await db
		.update(aiAlerts)
		.set({ backcountrySummary, updatedAt: new Date() })
		.where(eq(aiAlerts.id, id))
		.returning({
			id: aiAlerts.id,
			zoneId: aiAlerts.zoneId,
			dangerRating: aiAlerts.dangerRating,
			dangerLevel: aiAlerts.dangerLevel,
			dangerAboveTreelineRating: aiAlerts.dangerAboveTreelineRating,
			dangerAboveTreelineLevel: aiAlerts.dangerAboveTreelineLevel,
			dangerNearTreelineRating: aiAlerts.dangerNearTreelineRating,
			dangerNearTreelineLevel: aiAlerts.dangerNearTreelineLevel,
			dangerBelowTreelineRating: aiAlerts.dangerBelowTreelineRating,
			dangerBelowTreelineLevel: aiAlerts.dangerBelowTreelineLevel,
			avalancheProblems: aiAlerts.avalancheProblems,
			alertAction: aiAlerts.alertAction,
			alertReasoning: aiAlerts.alertReasoning,
			backcountrySummary: aiAlerts.backcountrySummary,
			status: aiAlerts.status,
			sentAt: aiAlerts.sentAt,
			createdAt: aiAlerts.createdAt,
		});
	return rows.length > 0 ? { ...rows[0], zoneName: "", zoneSlug: "", lat: 0, lon: 0 } : null;
}

export async function markAlertSent(id: number): Promise<boolean> {
	const db = getDb();
	const rows = await db
		.update(aiAlerts)
		.set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
		.where(eq(aiAlerts.id, id))
		.returning({ id: aiAlerts.id });
	return rows.length > 0;
}

export async function dismissAlert(id: number): Promise<boolean> {
	const db = getDb();
	const rows = await db
		.update(aiAlerts)
		.set({ status: "dismissed", updatedAt: new Date() })
		.where(eq(aiAlerts.id, id))
		.returning({ id: aiAlerts.id });
	return rows.length > 0;
}
