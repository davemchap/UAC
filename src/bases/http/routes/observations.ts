import { Hono } from "hono";
import {
	getObservationsByZone,
	getRecentObservations,
	submitObservation,
	validateObservation,
} from "../../../components/observations";
import type { ObservationInput } from "../../../components/observations";

const observations = new Hono();

type ObservationBody = Omit<ObservationInput, "observedAt"> & { observedAt: string };

// POST /api/observations — submit a field observation
observations.post("/", async (c) => {
	try {
		const b = await c.req.json<ObservationBody>();
		const input: ObservationInput = {
			observerName: b.observerName,
			observerEmail: b.observerEmail,
			experienceLevel: b.experienceLevel,
			zoneSlug: b.zoneSlug,
			areaName: b.areaName ?? null,
			aspect: b.aspect ?? null,
			elevationFt: b.elevationFt ?? null,
			observedAt: new Date(b.observedAt),
			obsTypes: Array.isArray(b.obsTypes) ? b.obsTypes.map(String) : [],
			avalancheType: b.avalancheType ?? null,
			trigger: b.trigger ?? null,
			sizeR: b.sizeR ?? null,
			sizeD: b.sizeD ?? null,
			widthFt: b.widthFt ?? null,
			verticalFt: b.verticalFt ?? null,
			depthIn: b.depthIn ?? null,
			surfaceConditions: b.surfaceConditions ?? null,
			snowDepthIn: b.snowDepthIn ?? null,
			stormSnowIn: b.stormSnowIn ?? null,
			weakLayers: b.weakLayers ?? null,
			weakLayersDesc: b.weakLayersDesc ?? null,
			skyCover: b.skyCover ?? null,
			windSpeed: b.windSpeed ?? null,
			windDirection: b.windDirection ?? null,
			temperatureF: b.temperatureF ?? null,
			precip: b.precip ?? null,
			fieldNotes: b.fieldNotes ?? null,
		};
		const errors = validateObservation(input);
		if (errors.length > 0) {
			return c.json({ success: false, errors }, 400);
		}
		const row = await submitObservation(input);
		return c.json({ success: true, observation: row }, 201);
	} catch (err) {
		return c.json({ success: false, error: err instanceof Error ? err.message : "unknown" }, 500);
	}
});

// GET /api/observations — recent observations (all zones)
observations.get("/", async (c) => {
	try {
		const rows = await getRecentObservations(50);
		return c.json({ success: true, observations: rows });
	} catch (err) {
		return c.json({ success: false, error: err instanceof Error ? err.message : "unknown" }, 500);
	}
});

// GET /api/observations/:zone — observations for a specific zone
observations.get("/:zone", async (c) => {
	try {
		const rows = await getObservationsByZone(c.req.param("zone"));
		return c.json({ success: true, observations: rows });
	} catch (err) {
		return c.json({ success: false, error: err instanceof Error ? err.message : "unknown" }, 500);
	}
});

export default observations;
