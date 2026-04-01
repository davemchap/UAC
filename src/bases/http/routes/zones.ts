import { Hono } from "hono";
import { getZoneDetail, getZoneSummaries } from "../../../components/zone-queries";

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

export default zones;
