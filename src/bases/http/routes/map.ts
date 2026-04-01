import { Hono } from "hono";
import { getMapData } from "../../../components/zone-queries";

const map = new Hono();

map.get("/map-data", async (c) => {
	const zones = await getMapData();
	return c.json({ success: true, count: zones.length, zones });
});

export default map;
