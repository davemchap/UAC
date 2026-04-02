import { Hono } from "hono";
import { queries } from "../../../components/db";
import { applyBriefingReview } from "../../../components/ingestion/briefing-generator";

const briefings = new Hono();

briefings.get("/today", async (c) => {
	const date = new Date().toISOString().slice(0, 10);
	const results = await queries.getTodaysBriefings(date);
	return c.json({ success: true, date, briefings: results });
});

briefings.post("/:id/review", async (c) => {
	const id = Number(c.req.param("id"));
	const body = await c.req.json<{
		reviewerName: string;
		decision: "approved" | "edited" | "rejected";
		editedExplanation?: string;
		notes?: string;
	}>();

	if (!body.reviewerName) {
		return c.json({ success: false, error: "reviewerName and decision are required" }, 400);
	}

	const ok = await applyBriefingReview(id, body);
	if (!ok) return c.json({ success: false, error: "Briefing not found" }, 404);

	return c.json({ success: true });
});

export default briefings;
