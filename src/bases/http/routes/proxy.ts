import { Hono } from "hono";
import { EXTERNAL_API_UNAVAILABLE, fetchJson } from "../../../components/http-proxy";

const SNOTEL_SOAP_NOTE =
	"SNOTEL uses a SOAP/XML web service (wcc.sc.egov.usda.gov). " +
	"A full SOAP client is out of scope for this template. " +
	"Use the pre-seeded data file instead, or implement the SOAP client in a future iteration.";

const proxy: Hono = new Hono();

proxy.get("/avalanche/forecast", async (c) => {
	const zoneId = c.req.query("zone");

	if (!zoneId) {
		return c.json({ success: false, error: "Missing required query parameter: zone" }, 400);
	}

	const url = `https://api.avalanche.org/v2/public/products/avalanche-forecast?zone_id=${encodeURIComponent(zoneId)}`;
	return c.json(await fetchJson(url));
});

proxy.get("/avalanche/zones", async (c) => {
	const url = "https://api.avalanche.org/v2/public/products/map-layer/UAC";
	return c.json(await fetchJson(url));
});

proxy.get("/snotel/station/:triplet", (c) => {
	const triplet = c.req.param("triplet");
	return c.json({
		source: "cache",
		data: null,
		triplet,
		note: SNOTEL_SOAP_NOTE,
		error: EXTERNAL_API_UNAVAILABLE,
	});
});

export default proxy;
