import { describe, expect, test } from "bun:test";
import { mock } from "bun:test";

// Mock the db module before importing the app
void mock.module("../db", () => ({
	getSql: () => () => [],
	checkDatabaseHealth: () => Promise.resolve(true),
	initializeDatabase: () => Promise.resolve(),
	closeDatabase: () => Promise.resolve(),
}));

// Import app after mocking
const { app } = await import("../index");

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
