import { Hono } from "hono";
import {
	scoreForecast,
	simulateJourney,
	buildCoachingSuggestions,
	normalizeText,
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
		const bottomLine = normalizeText(f.bottomLine);
		const currentConditions = normalizeText(f.currentConditions);
		const problems = [f.avalancheProblem1, f.avalancheProblem2, f.avalancheProblem3].filter(Boolean) as string[];
		const forecastText = [bottomLine, currentConditions].filter(Boolean).join("\n\n");
		const personaScores = scoreForecast(forecastText, f.overallDangerRating, problems, bottomLine);
		const journeys = personaScores.map((ps) =>
			simulateJourney(f.overallDangerRating, problems, bottomLine, currentConditions, ps),
		);
		const coaching = personaScores.flatMap((ps) => buildCoachingSuggestions(forecastText, ps));

		return {
			forecastId: f.id,
			zoneId: f.zoneId,
			zoneName: f.zoneName,
			zoneSlug: f.zoneSlug,
			forecasterName: f.forecasterName,
			dateIssued: f.dateIssued,
			overallDangerRating: f.overallDangerRating,
			bottomLine: bottomLine || null,
			currentConditions: currentConditions || null,
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

	const bottomLine = normalizeText(forecast.bottomLine);
	const currentConditions = normalizeText(forecast.currentConditions);
	const problems = [forecast.avalancheProblem1, forecast.avalancheProblem2, forecast.avalancheProblem3].filter(
		Boolean,
	) as string[];
	const forecastText = [bottomLine, currentConditions].filter(Boolean).join("\n\n");
	const personaScores = scoreForecast(forecastText, forecast.overallDangerRating, problems, bottomLine);
	const journeys = personaScores.map((ps) =>
		simulateJourney(forecast.overallDangerRating, problems, bottomLine, currentConditions, ps),
	);
	const coaching = personaScores.flatMap((ps) => buildCoachingSuggestions(forecastText, ps));

	return c.json({
		success: true,
		data: {
			forecastId: forecast.id,
			zoneId: forecast.zoneId,
			zoneName: forecast.zoneName,
			zoneSlug: forecast.zoneSlug,
			forecasterName: forecast.forecasterName,
			dateIssued: forecast.dateIssued,
			overallDangerRating: forecast.overallDangerRating,
			bottomLine: bottomLine || null,
			currentConditions: currentConditions || null,
			personas: personaScores,
			journeys,
			coaching,
			scoredAt: new Date().toISOString(),
		},
	});
});

export default scorecard;
