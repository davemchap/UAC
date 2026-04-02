import { Hono } from "hono";
import { dismissAlert, getAlertQueue, markAlertSent, updateAlertSummary } from "../../../components/ai-alert-queue";

const aiAlerts = new Hono();

aiAlerts.get("/", async (c) => {
	const status = c.req.query("status") ?? "pending";
	const alerts = await getAlertQueue(status);
	return c.json({ success: true, count: alerts.length, alerts });
});

aiAlerts.patch("/:id", async (c) => {
	const id = Number.parseInt(c.req.param("id"), 10);
	if (Number.isNaN(id)) return c.json({ success: false, error: "Invalid ID" }, 400);
	const body = await c.req.json<{ backcountrySummary?: string }>();
	if (!body.backcountrySummary) return c.json({ success: false, error: "backcountrySummary required" }, 400);
	const alert = await updateAlertSummary(id, body.backcountrySummary);
	if (!alert) return c.json({ success: false, error: "Alert not found" }, 404);
	return c.json({ success: true, alert });
});

aiAlerts.post("/:id/send", async (c) => {
	const id = Number.parseInt(c.req.param("id"), 10);
	if (Number.isNaN(id)) return c.json({ success: false, error: "Invalid ID" }, 400);
	const ok = await markAlertSent(id);
	if (!ok) return c.json({ success: false, error: "Alert not found" }, 404);
	return c.json({ success: true });
});

aiAlerts.delete("/:id", async (c) => {
	const id = Number.parseInt(c.req.param("id"), 10);
	if (Number.isNaN(id)) return c.json({ success: false, error: "Invalid ID" }, 400);
	const ok = await dismissAlert(id);
	if (!ok) return c.json({ success: false, error: "Alert not found" }, 404);
	return c.json({ success: true });
});

export default aiAlerts;
