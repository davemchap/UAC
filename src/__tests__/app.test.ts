import { describe, expect, test } from "bun:test";
import { mock } from "bun:test";

// Flat mock helpers for getDb — avoids deep nesting (sonarjs/no-nested-functions)
const mockInsertReturning = () =>
	Promise.resolve([
		{
			id: 1,
			handle: null,
			contentText: null,
			contentImageUrl: null,
			lat: null,
			lng: null,
			status: "pending",
			rejectionReason: null,
			aiSummary: null,
			zoneSlug: null,
			hazardType: null,
			severity: null,
			locationDescription: null,
			impactCount: 0,
			createdAt: new Date(),
		},
	]);
const mockInsertValues = () => ({ returning: mockInsertReturning });
const mockInsert = () => ({ values: mockInsertValues });
const mockUpdateReturning = () => Promise.resolve([]);
const mockUpdateWhere = () => ({ returning: mockUpdateReturning });
const mockUpdateSet = () => ({ where: mockUpdateWhere });
const mockUpdate = () => ({ set: mockUpdateSet });
const mockSelectWhere = () => ({ limit: () => Promise.resolve([]) });
const mockSelectOrderBy = () => ({ limit: () => Promise.resolve([]) });
const mockSelectFrom = () => ({ where: mockSelectWhere, orderBy: mockSelectOrderBy });
const mockSelect = () => ({ from: mockSelectFrom });
const mockDb = { insert: mockInsert, update: mockUpdate, select: mockSelect };

// Mock the db module before importing the app
void mock.module("../components/db", () => ({
	getSql: () => () => [],
	getDb: () => mockDb,
	queries: {
		getAllZones: () => Promise.resolve([]),
		getZoneBySlug: () => Promise.resolve([]),
		getZoneByZoneId: () => Promise.resolve([]),
		getSnotelStationsByZoneId: () => Promise.resolve([]),
		getLatestForecast: () => Promise.resolve([]),
		getForecastProblems: () => Promise.resolve([]),
		getWeatherReadings: () => Promise.resolve([]),
		getSnowpackReadings: () => Promise.resolve([]),
		getAllAlertThresholds: () => Promise.resolve([]),
		getAllEscalationRules: () => Promise.resolve([]),
		getPendingReports: () => Promise.resolve([]),
		getApprovedReportsByZone: () => Promise.resolve([]),
		getReportById: () => Promise.resolve([]),
		getLeaderboard: () => Promise.resolve([]),
		getObserverByHandle: () => Promise.resolve([]),
		getAllApprovedReports: () => Promise.resolve([]),
	},
	alertReviews: {},
	observationReports: {},
	observerHandles: {},
	checkDatabaseHealth: () => Promise.resolve(true),
	initializeDatabase: () => Promise.resolve(),
	closeDatabase: () => Promise.resolve(),
}));

// Import app after mocking
const { app } = await import("../bases/http/app");

function request(method: string, path: string): Request {
	return new Request(`http://localhost${path}`, { method });
}

describe("App", () => {
	describe("GET /health", () => {
		test("returns 200", async () => {
			const res = await app.fetch(request("GET", "/health"));
			expect(res.status).toBe(200);
		});

		test("returns health status object", async () => {
			const res = await app.fetch(request("GET", "/health"));
			const json = (await res.json()) as { status: string };
			expect(json.status).toBe("healthy");
		});
	});

	describe("GET /api/notes", () => {
		test("returns 404 — notes app has been removed", async () => {
			const res = await app.fetch(request("GET", "/api/notes"));
			expect(res.status).toBe(404);
		});
	});

	describe("GET /api", () => {
		test("returns 200", async () => {
			const res = await app.fetch(request("GET", "/api"));
			expect(res.status).toBe(200);
		});

		test("does not reference notes endpoints", async () => {
			const res = await app.fetch(request("GET", "/api"));
			const json = (await res.json()) as Record<string, unknown>;
			expect(JSON.stringify(json)).not.toContain("notes");
		});
	});
});
