import { Hono } from "hono";
import {
	scoreForecast,
	simulateJourney,
	buildCoachingSuggestions,
	getLatestForecastsForScoring,
	getForecastForScoringByZone,
} from "../../../components/scorecard";

const scorecard = new Hono();

/**
 * GET /api/scorecard
 * Returns scored forecasts for all zones (latest per zone).
 */
scorecard.get("/", async (c) => {
	const forecasts = await getLatestForecastsForScoring();

	const results = forecasts.map((f) => {
		const problems = [f.avalancheProblem1, f.avalancheProblem2, f.avalancheProblem3].filter(Boolean) as string[];
		const forecastText = [f.bottomLine, f.currentConditions].filter(Boolean).join("\n\n");
		const personaScores = scoreForecast(forecastText, f.overallDangerRating, problems, f.bottomLine ?? "");
		const journeys = personaScores.map((ps) =>
			simulateJourney(f.overallDangerRating, problems, f.bottomLine ?? "", f.currentConditions ?? "", ps),
		);
		const coaching = personaScores.flatMap((ps) => buildCoachingSuggestions(forecastText, ps));

		return {
			forecastId: f.id,
			zoneId: f.zoneId,
			zoneName: f.zoneName,
			zoneSlug: f.zoneSlug,
			dateIssued: f.dateIssued,
			overallDangerRating: f.overallDangerRating,
			personas: personaScores,
			journeys,
			coaching,
			scoredAt: new Date().toISOString(),
		};
	});

	return c.json({ success: true, data: results });
});

/**
 * GET /api/scorecard/:zoneSlug
 * Returns scored forecast for a single zone.
 */
scorecard.get("/:zoneSlug", async (c) => {
	const zoneSlug = c.req.param("zoneSlug");
	const forecast = await getForecastForScoringByZone(zoneSlug);

	if (!forecast) {
		return c.json({ success: false, error: "No forecast found for zone" }, 404);
	}

	const problems = [forecast.avalancheProblem1, forecast.avalancheProblem2, forecast.avalancheProblem3].filter(
		Boolean,
	) as string[];
	const forecastText = [forecast.bottomLine, forecast.currentConditions].filter(Boolean).join("\n\n");
	const personaScores = scoreForecast(forecastText, forecast.overallDangerRating, problems, forecast.bottomLine ?? "");
	const journeys = personaScores.map((ps) =>
		simulateJourney(
			forecast.overallDangerRating,
			problems,
			forecast.bottomLine ?? "",
			forecast.currentConditions ?? "",
			ps,
		),
	);
	const coaching = personaScores.flatMap((ps) => buildCoachingSuggestions(forecastText, ps));

	return c.json({
		success: true,
		data: {
			forecastId: forecast.id,
			zoneId: forecast.zoneId,
			zoneName: forecast.zoneName,
			zoneSlug: forecast.zoneSlug,
			dateIssued: forecast.dateIssued,
			overallDangerRating: forecast.overallDangerRating,
			personas: personaScores,
			journeys,
			coaching,
			scoredAt: new Date().toISOString(),
		},
	});
});

export default scorecard;
