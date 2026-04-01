import { Hono } from "hono";
import { generateZoneAlert, getZoneDetail, getZoneSummaries } from "../../../components/zone-queries";
import { getSql } from "../../../components/db";
import { dispatchNotification, evaluateAndCreate, shouldNotify } from "../../../components/notifications";

const zones = new Hono();

zones.get("/", async (c) => {
	const { snapshotDate, zones: summaries } = await getZoneSummaries();
	const sql = getSql();

	// Fire-and-forget: evaluate and dispatch notifications — never blocks the response
	try {
		void Promise.allSettled(
			summaries
				.filter((z) => shouldNotify(z.alert.action))
				.map((z) =>
					evaluateAndCreate(sql, {
						zoneSlug: z.slug,
						zoneName: z.name,
						dangerLevel: z.dangerLevel,
						dangerName: z.dangerName,
						action: z.alert.action,
						label: z.alert.label,
						escalated: z.alert.escalated,
						escalationReason: z.alert.escalationReason,
					}).then((notification) => {
						if (notification) {
							void dispatchNotification(sql, notification).catch(console.error);
						}
					}),
				),
		);
	} catch {
		// Never let notification failures break the zones API
	}

	return c.json({ success: true, snapshotDate, count: summaries.length, zones: summaries });
});

zones.get("/:slug", async (c) => {
	const slug = c.req.param("slug");
	const zone = await getZoneDetail(slug);
	if (!zone) return c.json({ success: false, error: `Zone not found: ${slug}` }, 404);
	return c.json({ success: true, zone });
});

zones.post("/:slug/alert", async (c) => {
	const slug = c.req.param("slug");
	const body = await c.req.json<{ type: unknown }>();
	const type = body.type;
	if (type !== "traveler" && type !== "ops") {
		return c.json({ success: false, error: 'type must be "traveler" or "ops"' }, 400);
	}
	const result = await generateZoneAlert(slug, type);
	if (!result) return c.json({ success: false, error: `Zone not found: ${slug}` }, 404);
	return c.json({ success: true, alert: result });
});

export default zones;
