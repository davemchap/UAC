import { eq, sql } from "drizzle-orm";
import { getDb, queries, observationReports, observerHandles } from "../db";
import { triageObservation } from "../observation-triage";
import { getZoneSlugForPoint } from "../zone-lookup";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportInput {
	handle?: string | null;
	contentText?: string | null;
	contentImageUrl?: string | null;
	lat?: number | null;
	lng?: number | null;
	zoneSlug?: string | null;
	staffRole?: string | null;
}

export interface ReportRow {
	id: number;
	handle: string | null;
	contentText: string | null;
	contentImageUrl: string | null;
	lat: number | null;
	lng: number | null;
	status: string;
	rejectionReason: string | null;
	aiSummary: string | null;
	zoneSlug: string | null;
	hazardType: string | null;
	severity: string | null;
	locationDescription: string | null;
	impactCount: number;
	createdAt: Date | null;
}

export interface ObserverRow {
	id: number;
	handle: string;
	totalImpactPoints: number;
	badgeLevel: string;
	rewardTriggered: boolean;
	observationCount: number;
	createdAt: Date | null;
}

// ---------------------------------------------------------------------------
// Badge logic
// ---------------------------------------------------------------------------

function computeBadgeLevel(points: number): string {
	if (points >= 50) return "guardian";
	if (points >= 25) return "sentinel";
	if (points >= 10) return "spotter";
	return "scout";
}

// ---------------------------------------------------------------------------
// Observer upsert
// ---------------------------------------------------------------------------

async function upsertObserver(handle: string): Promise<ObserverRow> {
	const db = getDb();
	const existing = await queries.getObserverByHandle(handle);
	if (existing.length > 0) return existing[0] as ObserverRow;

	const rows = await db
		.insert(observerHandles)
		.values({ handle, totalImpactPoints: 0, badgeLevel: "scout", rewardTriggered: false, observationCount: 0 })
		.returning();
	return rows[0] as ObserverRow;
}

async function incrementObserverCount(handle: string): Promise<ObserverRow> {
	const db = getDb();
	const rows = await db
		.update(observerHandles)
		.set({ observationCount: sql`${observerHandles.observationCount} + 1` })
		.where(eq(observerHandles.handle, handle))
		.returning();
	return rows[0] as ObserverRow;
}

// ---------------------------------------------------------------------------
// Submit report
// ---------------------------------------------------------------------------

export async function submitReport(input: ReportInput): Promise<ReportRow> {
	if (!input.contentText && !input.contentImageUrl) {
		throw new Error("Report must include text or an image.");
	}

	const db = getDb();
	const rawHandle = input.handle?.trim();
	const handle = rawHandle !== undefined && rawHandle !== "" ? rawHandle : null;

	if (handle) await upsertObserver(handle);

	const lat = input.lat ?? null;
	const lng = input.lng ?? null;
	const zoneSlug = input.zoneSlug ?? (lat !== null && lng !== null ? getZoneSlugForPoint(lat, lng) : null);

	const rows = await db
		.insert(observationReports)
		.values({
			handle,
			contentText: input.contentText ?? null,
			contentImageUrl: input.contentImageUrl ?? null,
			lat,
			lng,
			zoneSlug,
			status: input.staffRole ? "approved" : "pending",
			impactCount: 0,
		})
		.returning();

	const report = rows[0] as ReportRow;

	if (handle) await incrementObserverCount(handle);

	// Kick off async triage — fire and forget
	void triageReportAsync(report.id, input);

	return report;
}

// ---------------------------------------------------------------------------
// Async triage
// ---------------------------------------------------------------------------

export async function triageReportAsync(reportId: number, input: ReportInput): Promise<void> {
	try {
		const result = await triageObservation({
			contentText: input.contentText ?? null,
			contentImageUrl: input.contentImageUrl ?? null,
			lat: input.lat ?? null,
			lng: input.lng ?? null,
		});

		const db = getDb();
		await db
			.update(observationReports)
			.set({
				aiSummary: result.aiSummary,
				...(input.zoneSlug ? {} : { zoneSlug: result.zoneSlug }),
				hazardType: result.hazardType,
				severity: result.severity,
				locationDescription: result.locationDescription,
			})
			.where(eq(observationReports.id, reportId));
	} catch (err) {
		console.error(`[reports] triage failed for report ${reportId}:`, err);
	}
}

// ---------------------------------------------------------------------------
// Read reports
// ---------------------------------------------------------------------------

export async function getPendingReports(): Promise<ReportRow[]> {
	return queries.getPendingReports() as Promise<ReportRow[]>;
}

export async function getApprovedReportsByZone(zoneSlug: string): Promise<ReportRow[]> {
	return queries.getApprovedReportsByZone(zoneSlug) as Promise<ReportRow[]>;
}

export async function getAllApprovedReports(): Promise<ReportRow[]> {
	return queries.getAllApprovedReports() as Promise<ReportRow[]>;
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export async function approveReport(id: number): Promise<ReportRow> {
	const db = getDb();
	const rows = await db
		.update(observationReports)
		.set({ status: "approved" })
		.where(eq(observationReports.id, id))
		.returning();
	if (rows.length === 0) throw new Error(`Report ${id} not found`);
	return rows[0] as ReportRow;
}

export async function deleteReport(id: number): Promise<void> {
	const db = getDb();
	const rows = await db.delete(observationReports).where(eq(observationReports.id, id)).returning();
	if (rows.length === 0) throw new Error(`Report ${id} not found`);
}

export async function rejectReport(id: number, reason?: string): Promise<ReportRow> {
	const db = getDb();
	const rows = await db
		.update(observationReports)
		.set({ status: "rejected", rejectionReason: reason ?? null })
		.where(eq(observationReports.id, id))
		.returning();
	if (rows.length === 0) throw new Error(`Report ${id} not found`);
	return rows[0] as ReportRow;
}

// ---------------------------------------------------------------------------
// Impact points
// ---------------------------------------------------------------------------

export async function recordImpact(reportId: number): Promise<{ impactCount: number; observer: ObserverRow | null }> {
	const db = getDb();

	const reportRows = await db
		.update(observationReports)
		.set({ impactCount: sql`${observationReports.impactCount} + 1` })
		.where(eq(observationReports.id, reportId))
		.returning();

	if (reportRows.length === 0) throw new Error(`Report ${reportId} not found`);
	const report = reportRows[0] as ReportRow;

	let observer: ObserverRow | null = null;
	if (report.handle) {
		const pts = 1;
		const updated = await db
			.update(observerHandles)
			.set({
				totalImpactPoints: sql`${observerHandles.totalImpactPoints} + ${pts}`,
				badgeLevel: sql`CASE
					WHEN ${observerHandles.totalImpactPoints} + ${pts} >= 50 THEN 'guardian'
					WHEN ${observerHandles.totalImpactPoints} + ${pts} >= 25 THEN 'sentinel'
					WHEN ${observerHandles.totalImpactPoints} + ${pts} >= 10 THEN 'spotter'
					ELSE 'scout'
				END`,
				rewardTriggered: sql`(${observerHandles.totalImpactPoints} + ${pts}) >= 50`,
			})
			.where(eq(observerHandles.handle, report.handle))
			.returning();
		observer = updated.length > 0 ? (updated[0] as ObserverRow) : null;
	}

	return { impactCount: report.impactCount, observer };
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export async function getLeaderboard(limit = 10): Promise<ObserverRow[]> {
	return queries.getLeaderboard(limit) as Promise<ObserverRow[]>;
}

export { computeBadgeLevel };
