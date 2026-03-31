/**
 * CORS Proxy Routes
 *
 * Green Circle teams use client-side fetch() to call external APIs that block
 * browser requests with CORS errors. These server-side proxy routes allow the
 * browser to call our server instead, which then forwards to the external API.
 *
 * External APIs proxied:
 * - api.avalanche.org      — UAC avalanche forecasts (no CORS headers)
 * - wcc.sc.egov.usda.gov   — SNOTEL snowpack data (no CORS headers, SOAP-based)
 *
 * On external API failure, all routes return HTTP 200 with:
 *   { source: "cache", data: null, error: "external API unavailable" }
 * so the frontend can fall back gracefully to pre-seeded data without crashing.
 *
 * API Endpoints:
 * - GET /api/proxy/avalanche/forecast?zone=<zone_id>  - Avalanche forecast for a zone
 * - GET /api/proxy/avalanche/zones                    - All UAC avalanche zones (map layer)
 * - GET /api/proxy/snotel/station/:triplet            - SNOTEL station note (see below)
 */

import { Hono } from "hono";

// Returned when an external API call fails so frontends can fall back to pre-seeded data.
const EXTERNAL_API_UNAVAILABLE = "external API unavailable";

// SNOTEL uses a legacy SOAP/XML web service with no REST API.
// Rather than implement a full SOAP client, we document this limitation
// and return a consistent response shape so frontends can fall back to pre-seeded data.
const SNOTEL_SOAP_NOTE =
	"SNOTEL uses a SOAP/XML web service (wcc.sc.egov.usda.gov). " +
	"A full SOAP client is out of scope for this template. " +
	"Use the pre-seeded data file instead, or implement the SOAP client in a future iteration.";

interface ProxySuccess {
	source: "live";
	data: unknown;
}
interface ProxyFailure {
	source: "cache";
	data: null;
	error: string;
}
type ProxyResponse = ProxySuccess | ProxyFailure;

const unavailable: ProxyFailure = {
	source: "cache",
	data: null,
	error: EXTERNAL_API_UNAVAILABLE,
};

/**
 * Fetch a JSON URL server-side and return a typed proxy response.
 * On any error (network, non-OK status), returns the unavailable fallback.
 */
async function fetchJson(url: string): Promise<ProxyResponse> {
	try {
		const response = await fetch(url, {
			headers: {
				Accept: "application/json",
				"User-Agent": "ShipSummit-Proxy/1.0",
			},
		});

		if (!response.ok) {
			console.error(`Proxy upstream error: ${response.status} ${response.statusText} — ${url}`);
			return unavailable;
		}

		const data: unknown = await response.json();
		return { source: "live", data };
	} catch (error) {
		console.error(`Proxy fetch error for ${url}:`, error);
		return unavailable;
	}
}

const proxy: Hono = new Hono();

// =============================================================================
// GET /api/proxy/avalanche/forecast?zone=<zone_id>
// Proxies: https://api.avalanche.org/v2/public/products/avalanche-forecast?zone_id=<zone_id>
// =============================================================================
proxy.get("/avalanche/forecast", async (c) => {
	const zoneId = c.req.query("zone");

	if (!zoneId) {
		return c.json(
			{
				success: false,
				error: "Missing required query parameter: zone",
			},
			400,
		);
	}

	const url = `https://api.avalanche.org/v2/public/products/avalanche-forecast?zone_id=${encodeURIComponent(zoneId)}`;
	const result = await fetchJson(url);
	return c.json(result);
});

// =============================================================================
// GET /api/proxy/avalanche/zones
// Proxies: https://api.avalanche.org/v2/public/products/map-layer/UAC
// =============================================================================
proxy.get("/avalanche/zones", async (c) => {
	const url = "https://api.avalanche.org/v2/public/products/map-layer/UAC";
	const result = await fetchJson(url);
	return c.json(result);
});

// =============================================================================
// GET /api/proxy/snotel/station/:triplet
// SNOTEL (wcc.sc.egov.usda.gov) uses a legacy SOAP/XML service.
// This route documents the limitation and instructs callers to use pre-seeded data.
// =============================================================================
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
