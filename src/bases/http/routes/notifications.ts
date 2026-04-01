import { Hono } from "hono";
import { getSql } from "../../../components/db";
import { acknowledgeNotification, getNotifications } from "../../../components/notifications";

const notifications = new Hono();

notifications.get("/", async (c) => {
	try {
		const sql = getSql();
		const zone = c.req.query("zone");
		const limitParam = c.req.query("limit");
		const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;
		const acknowledgedParam = c.req.query("acknowledged");
		const acknowledged = acknowledgedParam !== undefined ? acknowledgedParam === "true" : undefined;

		const items = await getNotifications(sql, { zone, limit, acknowledged });
		return c.json({ success: true, count: items.length, notifications: items });
	} catch (err) {
		console.error("Failed to fetch notifications:", err);
		return c.json({ success: false, error: "Failed to fetch notifications" }, 500);
	}
});

notifications.post("/:id/acknowledge", async (c) => {
	try {
		const idParam = c.req.param("id");
		const id = Number.parseInt(idParam, 10);
		if (Number.isNaN(id)) {
			return c.json({ success: false, error: "Invalid notification ID" }, 400);
		}

		const sql = getSql();
		const notification = await acknowledgeNotification(sql, id);

		if (!notification) {
			return c.json({ success: false, error: "Notification not found" }, 404);
		}

		return c.json({ success: true, notification });
	} catch (err) {
		console.error("Failed to acknowledge notification:", err);
		return c.json({ success: false, error: "Failed to acknowledge notification" }, 500);
	}
});

export default notifications;
