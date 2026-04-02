import { Hono } from "hono";
import {
	approveReport,
	deleteReport,
	getAllApprovedReports,
	getLeaderboard,
	getPendingReports,
	recordImpact,
	rejectReport,
	submitReport,
} from "../../../components/reports";
import type { ReportInput } from "../../../components/reports";

const reports = new Hono();

// POST /api/reports — submit a field report
reports.post("/", async (c) => {
	try {
		const body = await c.req.json<ReportInput>();
		const report = await submitReport(body);
		return c.json({ success: true, report }, 201);
	} catch (err) {
		return c.json({ success: false, error: err instanceof Error ? err.message : "unknown" }, 500);
	}
});

// GET /api/reports — all approved reports (for zone tiles)
reports.get("/", async (c) => {
	try {
		const status = c.req.query("status");
		const rows = status === "pending" ? await getPendingReports() : await getAllApprovedReports();
		return c.json({ success: true, reports: rows });
	} catch (err) {
		return c.json({ success: false, error: err instanceof Error ? err.message : "unknown" }, 500);
	}
});

// PATCH /api/reports/:id — approve or reject
reports.patch("/:id", async (c) => {
	try {
		const id = Number(c.req.param("id"));
		const body = await c.req.json<{ action: "approve" | "reject"; reason?: string }>();
		if (body.action === "approve") {
			const report = await approveReport(id);
			return c.json({ success: true, report });
		}
		const report = await rejectReport(id, body.reason);
		return c.json({ success: true, report });
	} catch (err) {
		return c.json({ success: false, error: err instanceof Error ? err.message : "unknown" }, 500);
	}
});

// DELETE /api/reports/:id — hard delete (staff only)
reports.delete("/:id", async (c) => {
	try {
		const id = Number(c.req.param("id"));
		await deleteReport(id);
		return c.json({ success: true });
	} catch (err) {
		return c.json({ success: false, error: err instanceof Error ? err.message : "unknown" }, 500);
	}
});

// POST /api/reports/:id/impact — record an impact point
reports.post("/:id/impact", async (c) => {
	try {
		const id = Number(c.req.param("id"));
		const result = await recordImpact(id);
		return c.json({ success: true, ...result });
	} catch (err) {
		return c.json({ success: false, error: err instanceof Error ? err.message : "unknown" }, 500);
	}
});

// GET /api/leaderboard
reports.get("/leaderboard", async (c) => {
	try {
		const board = await getLeaderboard(20);
		return c.json({ success: true, leaderboard: board });
	} catch (err) {
		return c.json({ success: false, error: err instanceof Error ? err.message : "unknown" }, 500);
	}
});

export default reports;
