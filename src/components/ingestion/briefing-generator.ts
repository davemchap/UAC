import { eq } from "drizzle-orm";
import { getDb, morningBriefings, queries } from "../db";
import { aiAlerts } from "../db/schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayDate(): string {
	return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Generate morning briefing for a single zone
// ---------------------------------------------------------------------------

async function generateBriefingForZone(zoneId: number, date: string): Promise<void> {
	const db = getDb();

	// Skip if briefing already exists for this zone+date
	const existing = await queries.getBriefingForZoneDate(zoneId, date);
	if (existing.length > 0) {
		console.log(`[briefing] Zone ${zoneId}: briefing already exists for ${date}, skipping`);
		return;
	}

	const zone = await queries.getZoneByZoneId(zoneId).then((rows) => rows.at(0));
	if (!zone) return;

	// Read latest persisted AI alert for this zone
	const alert = await db
		.select()
		.from(aiAlerts)
		.where(eq(aiAlerts.zoneId, zoneId))
		.orderBy(aiAlerts.createdAt)
		.limit(1)
		.then((rows) => rows.at(0));

	if (!alert) {
		console.warn(`[briefing] Zone ${zoneId} (${zone.name}): no AI alert found, skipping`);
		return;
	}

	if (alert.alertAction === "no_alert") {
		await db.insert(morningBriefings).values({
			zoneId,
			zoneSlug: zone.slug,
			briefingDate: date,
			alertAction: "no_alert",
			status: "no_alert",
		});
		console.log(`[briefing] Zone ${zoneId} (${zone.name}): no_alert, recorded`);
		return;
	}

	await db.insert(morningBriefings).values({
		zoneId,
		zoneSlug: zone.slug,
		briefingDate: date,
		dangerRating: alert.dangerRating,
		dangerLevel: alert.dangerLevel,
		dangerAboveTreelineRating: alert.dangerAboveTreelineRating,
		dangerAboveTreelineLevel: alert.dangerAboveTreelineLevel,
		dangerNearTreelineRating: alert.dangerNearTreelineRating,
		dangerNearTreelineLevel: alert.dangerNearTreelineLevel,
		dangerBelowTreelineRating: alert.dangerBelowTreelineRating,
		dangerBelowTreelineLevel: alert.dangerBelowTreelineLevel,
		avalancheProblems: alert.avalancheProblems,
		alertAction: alert.alertAction,
		explanation: alert.alertReasoning,
		model: alert.model,
		status: "ready",
	});

	console.log(`[briefing] Zone ${zoneId} (${zone.name}): briefing generated (action=${alert.alertAction})`);
}

// ---------------------------------------------------------------------------
// Public: generate briefings for all zones (idempotent — skips existing)
// ---------------------------------------------------------------------------

export async function generateMorningBriefings(): Promise<void> {
	const date = todayDate();
	const zones = await queries.getAllZones();
	let generated = 0;

	for (const zone of zones) {
		try {
			await generateBriefingForZone(zone.zoneId, date);
			generated++;
		} catch (err) {
			console.error(`[briefing] Zone ${zone.zoneId} (${zone.name}) failed:`, err);
			// Record failure so dashboard can surface it
			try {
				const db = getDb();
				await db
					.insert(morningBriefings)
					.values({
						zoneId: zone.zoneId,
						zoneSlug: zone.slug,
						briefingDate: date,
						alertAction: "unknown",
						status: "briefing_failed",
					})
					.onConflictDoNothing();
			} catch {
				// Best effort — don't let failure recording block other zones
			}
		}
	}

	console.log(`[briefing] Processed ${generated}/${zones.length} zones for ${date}`);
}

// ---------------------------------------------------------------------------
// Public: apply a human review decision to a briefing
// ---------------------------------------------------------------------------

export interface ReviewDecision {
	reviewerName: string;
	decision: "approved" | "edited" | "rejected";
	editedExplanation?: string;
	notes?: string;
}

export async function applyBriefingReview(briefingId: number, review: ReviewDecision): Promise<boolean> {
	const db = getDb();

	const briefing = await queries.getBriefingById(briefingId).then((rows) => rows.at(0));
	if (!briefing) return false;

	await db
		.update(morningBriefings)
		.set({
			reviewStatus: review.decision,
			reviewerName: review.reviewerName,
			reviewedAt: new Date(),
			originalExplanation: review.decision === "edited" ? briefing.explanation : null,
			explanation: review.editedExplanation ?? briefing.explanation,
			reviewerNotes: review.notes ?? null,
		})
		.where(eq(morningBriefings.id, briefingId));

	console.log(`[briefing] Review applied: id=${briefingId} decision=${review.decision} by=${review.reviewerName}`);
	return true;
}
