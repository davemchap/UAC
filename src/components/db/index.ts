import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { and, count, eq, desc, gte, asc } from "drizzle-orm";
import postgres from "postgres";
import { resolve } from "node:path";
import * as schema from "./schema";
import {
	aiAlerts,
	alertReviews,
	alertThresholds,
	avalancheForecasts,
	avalancheProblems,
	escalationRules,
	fieldObservations,
	forecastZones,
	observationReports,
	observerHandles,
	scorecardRuns,
	snowpackReadings,
	snotelStations,
	weatherReadings,
} from "./schema";

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	console.warn(
		"⚠  DATABASE_URL not set — database features disabled.\n" +
			"   Create .env with DATABASE_URL=postgresql://... for local dev.",
	);
}

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getClient(): ReturnType<typeof postgres> {
	if (_client) return _client;
	if (!databaseUrl) throw new Error("DATABASE_URL is not set. Configure it in .env for local development.");
	_client = postgres(databaseUrl, { max: 10, idle_timeout: 20, connect_timeout: 10, transform: postgres.camel });
	return _client;
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
	if (_db) return _db;
	_db = drizzle(getClient(), { schema });
	return _db;
}

/** For raw SQL only. Prefer getDb() for typed queries via Drizzle. */
export function getSql(): ReturnType<typeof postgres> {
	return getClient();
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function checkDatabaseHealth(): Promise<boolean> {
	if (!databaseUrl) return false;
	try {
		const client = getClient();
		await client`SELECT 1`;
		return true;
	} catch (error) {
		console.error("Database health check failed:", error);
		return false;
	}
}

export async function initializeDatabase(): Promise<void> {
	if (!databaseUrl) {
		console.log("Skipping database initialization (no DATABASE_URL)");
		return;
	}
	console.log("Running database migrations...");
	const migrationClient = postgres(databaseUrl, { max: 1 });
	try {
		const migrationDb = drizzle(migrationClient);
		await migrate(migrationDb, { migrationsFolder: resolve(import.meta.dir, "migrations") });
		console.log("Database migrations complete.");
	} finally {
		await migrationClient.end();
	}
}

export async function closeDatabase(): Promise<void> {
	if (_client) {
		await _client.end();
		_client = null;
		_db = null;
	}
	console.log("Database connection closed");
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export const queries = {
	getAllZones: () => getDb().select().from(forecastZones).orderBy(forecastZones.name),

	getZoneBySlug: (slug: string) => getDb().select().from(forecastZones).where(eq(forecastZones.slug, slug)).limit(1),

	getZoneByZoneId: (zoneId: number) =>
		getDb().select().from(forecastZones).where(eq(forecastZones.zoneId, zoneId)).limit(1),

	getSnotelStationsByZoneId: (zoneId: number) =>
		getDb().select().from(snotelStations).where(eq(snotelStations.zoneId, zoneId)),

	getLatestForecast: (zoneId: number) =>
		getDb()
			.select()
			.from(avalancheForecasts)
			.where(eq(avalancheForecasts.zoneId, zoneId))
			.orderBy(avalancheForecasts.createdAt)
			.limit(1),

	getForecastProblems: (forecastId: number) =>
		getDb()
			.select()
			.from(avalancheProblems)
			.where(eq(avalancheProblems.forecastId, forecastId))
			.orderBy(avalancheProblems.problemNumber),

	getWeatherReadings: (zoneId: number) =>
		getDb().select().from(weatherReadings).where(eq(weatherReadings.zoneId, zoneId)).orderBy(weatherReadings.startTime),

	getSnowpackReadings: (triplet: string) =>
		getDb()
			.select()
			.from(snowpackReadings)
			.where(eq(snowpackReadings.stationTriplet, triplet))
			.orderBy(snowpackReadings.date),

	getAllAlertThresholds: () => getDb().select().from(alertThresholds).orderBy(alertThresholds.dangerLevel),

	getAllEscalationRules: () => getDb().select().from(escalationRules),

	getLatestAlert: (zoneId: number) =>
		getDb().select().from(aiAlerts).where(eq(aiAlerts.zoneId, zoneId)).orderBy(desc(aiAlerts.createdAt)).limit(1),

	getAlertHistory: (zoneId: number, since: Date) =>
		getDb()
			.select()
			.from(aiAlerts)
			.where(and(eq(aiAlerts.zoneId, zoneId), gte(aiAlerts.createdAt, since)))
			.orderBy(desc(aiAlerts.createdAt)),

	getPendingReports: () =>
		getDb()
			.select()
			.from(observationReports)
			.where(eq(observationReports.status, "pending"))
			.orderBy(desc(observationReports.createdAt)),

	getApprovedReportsByZone: (zoneSlug: string) =>
		getDb()
			.select()
			.from(observationReports)
			.where(and(eq(observationReports.zoneSlug, zoneSlug), eq(observationReports.status, "approved")))
			.orderBy(desc(observationReports.createdAt)),

	getReportById: (id: number) =>
		getDb().select().from(observationReports).where(eq(observationReports.id, id)).limit(1),

	getLeaderboard: (limit = 10) =>
		getDb().select().from(observerHandles).orderBy(desc(observerHandles.totalImpactPoints)).limit(limit),

	getObserverByHandle: (handle: string) =>
		getDb().select().from(observerHandles).where(eq(observerHandles.handle, handle)).limit(1),

	getAllApprovedReports: () =>
		getDb()
			.select()
			.from(observationReports)
			.where(eq(observationReports.status, "approved"))
			.orderBy(asc(observationReports.zoneSlug), desc(observationReports.createdAt)),

	getReportCounts: async () => {
		const db = getDb();
		const [approvedRow, pendingRow] = await Promise.all([
			db.select({ count: count() }).from(observationReports).where(eq(observationReports.status, "approved")),
			db.select({ count: count() }).from(observationReports).where(eq(observationReports.status, "pending")),
		]);
		return {
			approved: approvedRow[0]?.count ?? 0,
			pending: pendingRow[0]?.count ?? 0,
		};
	},
};

// Re-export schema tables for use in other components
export {
	aiAlerts,
	alertReviews,
	fieldObservations,
	forecastZones,
	observationReports,
	observerHandles,
	scorecardRuns,
	snotelStations,
	avalancheForecasts,
	avalancheProblems,
	weatherReadings,
	snowpackReadings,
	alertThresholds,
	escalationRules,
};
