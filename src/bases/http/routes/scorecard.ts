import { Hono } from "hono";
import {
	scoreForecast,
	simulateJourney,
	buildCoachingSuggestions,
	normalizeText,
	getLatestForecastsForScoring,
	getForecastForScoringByZone,
	type Persona,
	type PersonaId,
} from "../../../components/scorecard";
import { getAllPersonas, type PersonaRecord } from "../../../components/persona-trainer";

/** Map a DB PersonaRecord to the Persona interface used by scoring. */
function toScoringPersona(r: PersonaRecord): Persona {
	return {
		id: r.personaKey as PersonaId,
		name: r.name,
		role: r.role,
		color: r.color,
		literacyLevel: r.literacyLevel as Persona["literacyLevel"],
		unknownTerms: r.unknownTerms,
		maxSentenceLength: r.maxSentenceLength,
		maxGradeLevel: r.maxGradeLevel,
		successCriteria: r.successCriteria,
		tags: r.tags,
		yearsOfMountainExperience: r.yearsOfMountainExperience,
		avalancheTrainingLevel: r.avalancheTrainingLevel,
		backcountryDaysPerSeason: r.backcountryDaysPerSeason,
		weatherPatternRecognition: r.weatherPatternRecognition,
		terrainAssessmentSkill: r.terrainAssessmentSkill,
		riskTolerance: r.riskTolerance,
		groupDecisionTendency: r.groupDecisionTendency,
		localTerrainFamiliarity: r.localTerrainFamiliarity,
	};
}

/** Load active built-in personas from DB; fall back to undefined (uses static defaults). */
async function loadScoringPersonas(): Promise<Persona[] | undefined> {
	try {
		const records = await getAllPersonas();
		const active = records.filter((r) => r.active && r.isBuiltIn);
		return active.length > 0 ? active.map(toScoringPersona) : undefined;
	} catch {
		return undefined;
	}
}

const scorecard = new Hono();

/**
 * GET /api/scorecard
 * Returns scored forecasts for all zones (latest per zone).
 */
scorecard.get("/", async (c) => {
	const [forecasts, personas] = await Promise.all([getLatestForecastsForScoring(), loadScoringPersonas()]);

	const results = forecasts.map((f) => {
		const bottomLine = normalizeText(f.bottomLine);
		const currentConditions = normalizeText(f.currentConditions);
		const problems = [f.avalancheProblem1, f.avalancheProblem2, f.avalancheProblem3].filter(Boolean) as string[];
		const forecastText = [bottomLine, currentConditions].filter(Boolean).join("\n\n");
		const personaScores = scoreForecast(forecastText, f.overallDangerRating, problems, bottomLine, personas);
		const journeys = personaScores.map((ps) =>
			simulateJourney(f.overallDangerRating, problems, bottomLine, currentConditions, ps),
		);
		const coaching = personaScores.flatMap((ps) =>
			buildCoachingSuggestions(
				forecastText,
				ps,
				personas?.find((p) => p.id === ps.personaId),
			),
		);

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
	const [forecast, personas] = await Promise.all([getForecastForScoringByZone(zoneSlug), loadScoringPersonas()]);

	if (!forecast) {
		return c.json({ success: false, error: "No forecast found for zone" }, 404);
	}

	const bottomLine = normalizeText(forecast.bottomLine);
	const currentConditions = normalizeText(forecast.currentConditions);
	const problems = [forecast.avalancheProblem1, forecast.avalancheProblem2, forecast.avalancheProblem3].filter(
		Boolean,
	) as string[];
	const forecastText = [bottomLine, currentConditions].filter(Boolean).join("\n\n");
	const personaScores = scoreForecast(forecastText, forecast.overallDangerRating, problems, bottomLine, personas);
	const journeys = personaScores.map((ps) =>
		simulateJourney(forecast.overallDangerRating, problems, bottomLine, currentConditions, ps),
	);
	const coaching = personaScores.flatMap((ps) =>
		buildCoachingSuggestions(
			forecastText,
			ps,
			personas?.find((p) => p.id === ps.personaId),
		),
	);

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
