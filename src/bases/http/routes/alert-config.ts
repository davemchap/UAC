import { Hono } from "hono";
import {
	createRule,
	deleteRule,
	getAllRules,
	loadAlertConfig,
	updateRule,
	upsertThresholds,
} from "../../../components/alert-config";
import type { AlertAction } from "../../../components/alerts";
import { getSql } from "../../../components/db";

const alertConfig = new Hono();

// GET /api/alert-config — full config (thresholds + enabled rules)
alertConfig.get("/", async (c) => {
	try {
		const sql = getSql();
		const config = await loadAlertConfig(sql);
		return c.json({ success: true, ...config });
	} catch (err) {
		return c.json({ success: false, error: err instanceof Error ? err.message : "unknown" }, 500);
	}
});

// PUT /api/alert-config/thresholds — bulk update threshold actions
alertConfig.put("/thresholds", async (c) => {
	try {
		const body = await c.req.json<{ thresholds: { dangerLevel: number; action: AlertAction }[] }>();
		if (!Array.isArray(body.thresholds) || body.thresholds.length === 0) {
			return c.json({ success: false, error: "thresholds array required" }, 400);
		}
		const sql = getSql();
		await upsertThresholds(sql, body.thresholds);
		const config = await loadAlertConfig(sql);
		return c.json({ success: true, thresholds: config.thresholds });
	} catch (err) {
		return c.json({ success: false, error: err instanceof Error ? err.message : "unknown" }, 500);
	}
});

// GET /api/alert-config/rules — all rules (including disabled)
alertConfig.get("/rules", async (c) => {
	try {
		const sql = getSql();
		const rules = await getAllRules(sql);
		return c.json({ success: true, rules });
	} catch (err) {
		return c.json({ success: false, error: err instanceof Error ? err.message : "unknown" }, 500);
	}
});

// POST /api/alert-config/rules — create a rule
alertConfig.post("/rules", async (c) => {
	try {
		const body = await c.req.json<{
			name: string;
			minDangerLevel?: number | null;
			minProblemCount?: number | null;
			zoneSlug?: string | null;
			action: AlertAction;
			priority?: number;
			enabled?: boolean;
		}>();
		if (!body.name) {
			return c.json({ success: false, error: "name and action required" }, 400);
		}
		const sql = getSql();
		const rule = await createRule(sql, body);
		return c.json({ success: true, rule }, 201);
	} catch (err) {
		return c.json({ success: false, error: err instanceof Error ? err.message : "unknown" }, 500);
	}
});

// PUT /api/alert-config/rules/:id — update a rule
alertConfig.put("/rules/:id", async (c) => {
	try {
		const id = Number.parseInt(c.req.param("id"), 10);
		if (Number.isNaN(id)) return c.json({ success: false, error: "invalid id" }, 400);
		const body = await c.req.json<Parameters<typeof updateRule>[2]>();
		const sql = getSql();
		const rule = await updateRule(sql, id, body);
		if (!rule) return c.json({ success: false, error: "rule not found" }, 404);
		return c.json({ success: true, rule });
	} catch (err) {
		return c.json({ success: false, error: err instanceof Error ? err.message : "unknown" }, 500);
	}
});

// DELETE /api/alert-config/rules/:id — delete a rule
alertConfig.delete("/rules/:id", async (c) => {
	try {
		const id = Number.parseInt(c.req.param("id"), 10);
		if (Number.isNaN(id)) return c.json({ success: false, error: "invalid id" }, 400);
		const sql = getSql();
		const deleted = await deleteRule(sql, id);
		if (!deleted) return c.json({ success: false, error: "rule not found" }, 404);
		return c.json({ success: true });
	} catch (err) {
		return c.json({ success: false, error: err instanceof Error ? err.message : "unknown" }, 500);
	}
});

export default alertConfig;
