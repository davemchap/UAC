import { Hono } from "hono";
import { generateZoneAlert, getZoneDetail, getZoneSummaries } from "../../../components/zone-queries";

const zones = new Hono();

zones.get("/", async (c) => {
	const { snapshotDate, zones: summaries } = await getZoneSummaries();
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
