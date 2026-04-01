import { describe, expect, mock, test } from "bun:test";
import { buildCooldownKey, shouldNotify } from "../components/notifications";
import type { AlertAction } from "../components/alerts";

// ---------------------------------------------------------------------------
// shouldNotify
// ---------------------------------------------------------------------------

describe("shouldNotify", () => {
	test("returns false for no_alert", () => {
		expect(shouldNotify("no_alert")).toBe(false);
	});

	test("returns true for human_review", () => {
		expect(shouldNotify("human_review")).toBe(true);
	});

	test("returns true for auto_send", () => {
		expect(shouldNotify("auto_send")).toBe(true);
	});

	test("returns true for auto_send_urgent", () => {
		expect(shouldNotify("auto_send_urgent")).toBe(true);
	});

	test("returns true for flag_for_review", () => {
		expect(shouldNotify("flag_for_review")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// buildCooldownKey
// ---------------------------------------------------------------------------

describe("buildCooldownKey", () => {
	test("combines slug and action with colon", () => {
		expect(buildCooldownKey("salt-lake", "auto_send")).toBe("salt-lake:auto_send");
	});

	test("is deterministic for same inputs", () => {
		const key1 = buildCooldownKey("uinta", "human_review");
		const key2 = buildCooldownKey("uinta", "human_review");
		expect(key1).toBe(key2);
	});

	test("differs for different actions on same zone", () => {
		const k1 = buildCooldownKey("moab", "auto_send");
		const k2 = buildCooldownKey("moab", "auto_send_urgent");
		expect(k1).not.toBe(k2);
	});

	test("differs for same action on different zones", () => {
		const k1 = buildCooldownKey("zone-a", "auto_send");
		const k2 = buildCooldownKey("zone-b", "auto_send");
		expect(k1).not.toBe(k2);
	});
});

// ---------------------------------------------------------------------------
// Notification API routes
// ---------------------------------------------------------------------------

void mock.module("../components/db", () => ({
	getSql: () => {
		const mockSql = (strings: TemplateStringsArray) => {
			const query = strings.join("?").toLowerCase();
			if (query.includes("select") && query.includes("notifications")) {
				return Promise.resolve([
					{
						id: 1,
						zoneSlug: "salt-lake",
						zoneName: "Salt Lake",
						dangerLevel: 3,
						dangerName: "Considerable",
						action: "auto_send" as AlertAction,
						label: "Auto-Send",
						escalated: false,
						escalationReason: null,
						status: "pending",
						webhookStatus: null,
						acknowledged: false,
						acknowledgedAt: null,
						cooldownKey: "salt-lake:auto_send",
						createdAt: new Date().toISOString(),
					},
				]);
			}
			if (query.includes("update") && query.includes("acknowledged")) {
				return Promise.resolve([
					{
						id: 1,
						zoneSlug: "salt-lake",
						zoneName: "Salt Lake",
						dangerLevel: 3,
						dangerName: "Considerable",
						action: "auto_send" as AlertAction,
						label: "Auto-Send",
						escalated: false,
						escalationReason: null,
						status: "pending",
						webhookStatus: null,
						acknowledged: true,
						acknowledgedAt: new Date().toISOString(),
						cooldownKey: "salt-lake:auto_send",
						createdAt: new Date().toISOString(),
					},
				]);
			}
			return Promise.resolve([]);
		};
		return mockSql;
	},
	checkDatabaseHealth: () => Promise.resolve(true),
	initializeDatabase: () => Promise.resolve(),
	closeDatabase: () => Promise.resolve(),
}));

const { app } = await import("../bases/http/app");

function request(method: string, path: string): Request {
	return new Request(`http://localhost${path}`, { method });
}

describe("GET /api/notifications", () => {
	test("returns 200 with notification list", async () => {
		const res = await app.fetch(request("GET", "/api/notifications"));
		expect(res.status).toBe(200);
		const json = (await res.json()) as { success: boolean; notifications: unknown[] };
		expect(json.success).toBe(true);
		expect(Array.isArray(json.notifications)).toBe(true);
	});

	test("returns count field", async () => {
		const res = await app.fetch(request("GET", "/api/notifications"));
		const json = (await res.json()) as { count: number };
		expect(typeof json.count).toBe("number");
	});
});

describe("POST /api/notifications/:id/acknowledge", () => {
	test("returns 200 with updated notification", async () => {
		const res = await app.fetch(request("POST", "/api/notifications/1/acknowledge"));
		expect(res.status).toBe(200);
		const json = (await res.json()) as { success: boolean; notification: { acknowledged: boolean } };
		expect(json.success).toBe(true);
		expect(json.notification.acknowledged).toBe(true);
	});

	test("returns 400 for non-numeric ID", async () => {
		const res = await app.fetch(request("POST", "/api/notifications/abc/acknowledge"));
		expect(res.status).toBe(400);
	});
});
