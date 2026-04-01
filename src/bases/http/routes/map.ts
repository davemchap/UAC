import { Hono } from "hono";
import { getMapZoneData } from "../../../components/zone-map";

const map = new Hono();

map.get("/map-data", (c) => {
	const zones = getMapZoneData();
	return c.json({ success: true, count: zones.length, zones });
});

export default map;
