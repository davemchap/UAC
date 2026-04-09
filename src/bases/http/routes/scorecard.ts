import { Hono } from "hono";
import mammoth from "mammoth";
import {
	scoreForecast,
	simulateJourney,
	buildCoachingSuggestions,
	normalizeText,
	getLatestForecastsForScoring,
	getForecastForScoringByZone,
	getForecastsForScoringByDate,
	loadGoldenScenarios,
	computePersonaLens,
	computeDecisionMirror,
	analyzeAssumptions,
	buildDailyReport,
	getAvailableReportDates,
	getForecastForScoringByZoneAndDate,
	getAvailableDatesForZone,
	fetchForecastLive,
	generateWeeklyReport,
	reviewDraft,
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
		travelMode: r.travelMode,
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
 * Optional ?date=YYYY-MM-DD returns forecasts for all zones on that specific date.
 */
scorecard.get("/", async (c) => {
	const date = c.req.query("date");
	const forecastLoader =
		date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? getForecastsForScoringByDate(date) : getLatestForecastsForScoring();
	const [forecasts, personas] = await Promise.all([forecastLoader, loadScoringPersonas()]);

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
			personaLens: computePersonaLens(
				forecastText,
				f.overallDangerRating,
				problems,
				bottomLine,
				currentConditions,
				personas,
			),
			decisionMirror: computeDecisionMirror(forecastText, f.overallDangerRating, problems, bottomLine, personas),
			assumptionAudit: analyzeAssumptions(forecastText, f.overallDangerRating, problems, personas),
			scoredAt: new Date().toISOString(),
		};
	});

	return c.json({ success: true, data: results });
});

/**
 * GET /api/scorecard/golden
 * Returns all 18 golden dataset scenarios scored against current personas.
 */
scorecard.get("/golden", async (c) => {
	const [scenarios, personas] = await Promise.all([Promise.resolve(loadGoldenScenarios()), loadScoringPersonas()]);

	const results = scenarios.map((f) => {
		const bottomLine = normalizeText(f.bottomLine);
		const currentConditions = normalizeText(f.currentConditions);
		const problems = [f.avalancheProblem1, f.avalancheProblem2, f.avalancheProblem3].filter(Boolean) as string[];
		const forecastText = [bottomLine, currentConditions].filter(Boolean).join("\n\n");
		const personaScores = scoreForecast(forecastText, f.overallDangerRating, problems, bottomLine, personas);
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
			coaching,
			personaLens: computePersonaLens(
				forecastText,
				f.overallDangerRating,
				problems,
				bottomLine,
				currentConditions,
				personas,
			),
			decisionMirror: computeDecisionMirror(forecastText, f.overallDangerRating, problems, bottomLine, personas),
			assumptionAudit: analyzeAssumptions(forecastText, f.overallDangerRating, problems, personas),
			scoredAt: new Date().toISOString(),
			// Golden-specific metadata
			isGolden: true,
			scenarioId: f.scenarioId,
			scenarioName: f.scenarioName,
			center: f.center,
			dangerLevel: f.dangerLevel,
			alertAction: f.alertAction,
		};
	});

	return c.json({ success: true, data: results });
});

/**
 * GET /api/scorecard/report/available-dates
 * Returns dates (up to 14 days back) that have scorecard_runs data.
 */
scorecard.get("/report/available-dates", async (c) => {
	const dates = await getAvailableReportDates(14);
	return c.json({ success: true, data: dates });
});

/**
 * GET /api/scorecard/report/daily?date=YYYY-MM-DD
 * Returns the daily scorecard report for all zones. Defaults to today.
 */
scorecard.get("/report/daily", async (c) => {
	const date = c.req.query("date");
	const report = await buildDailyReport(date);
	return c.json({ success: true, data: report });
});

/**
 * GET /api/scorecard/report/weekly?week=YYYY-MM-DD
 * Returns weekly forecast quality report aggregated by forecaster and zone.
 */
scorecard.get("/report/weekly", async (c) => {
	const week = c.req.query("week");
	if (week !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
		return c.json({ success: false, error: "Invalid week parameter — expected YYYY-MM-DD" }, 400);
	}
	const report = await generateWeeklyReport(week);
	return c.json({ success: true, data: report });
});

/**
 * GET /api/scorecard/:zoneSlug/available-dates
 * Returns ISO dates (YYYY-MM-DD) with forecast data for a zone, newest first.
 */
scorecard.get("/:zoneSlug/available-dates", async (c) => {
	const zoneSlug = c.req.param("zoneSlug");
	const dates = await getAvailableDatesForZone(zoneSlug, 60);
	return c.json({ success: true, data: dates });
});

/**
 * GET /api/scorecard/:zoneSlug/:date
 * Returns scored forecast for a single zone on a specific date (YYYY-MM-DD).
 * Falls back to a live UAC API fetch if the date is not in the local DB.
 */
scorecard.get("/:zoneSlug/:date", async (c) => {
	const zoneSlug = c.req.param("zoneSlug");
	const date = c.req.param("date");

	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return c.json({ success: false, error: "Invalid date format. Expected YYYY-MM-DD" }, 400);
	}

	// Try DB first; fall back to live UAC fetch and cache result
	let forecast = await getForecastForScoringByZoneAndDate(zoneSlug, date);
	forecast ??= await fetchForecastLive(zoneSlug, date);

	const personas = await loadScoringPersonas();

	if (!forecast) {
		return c.json({ success: false, error: "No forecast found for zone on date" }, 404);
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
			personaLens: computePersonaLens(
				forecastText,
				forecast.overallDangerRating,
				problems,
				bottomLine,
				currentConditions,
				personas,
			),
			decisionMirror: computeDecisionMirror(forecastText, forecast.overallDangerRating, problems, bottomLine, personas),
			assumptionAudit: analyzeAssumptions(forecastText, forecast.overallDangerRating, problems, personas),
			scoredAt: new Date().toISOString(),
			dateQueried: date,
		},
	});
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
			personaLens: computePersonaLens(
				forecastText,
				forecast.overallDangerRating,
				problems,
				bottomLine,
				currentConditions,
				personas,
			),
			decisionMirror: computeDecisionMirror(forecastText, forecast.overallDangerRating, problems, bottomLine, personas),
			assumptionAudit: analyzeAssumptions(forecastText, forecast.overallDangerRating, problems, personas),
			scoredAt: new Date().toISOString(),
		},
	});
});

/**
 * POST /api/scorecard/review
 * Runs full persona analysis on a draft forecast text (no DB required).
 * Body: { draftText: string, dangerRating: string, problems: string[], bottomLine?: string }
 */
scorecard.post("/review", async (c) => {
	const body = await c.req.json<{
		draftText: string;
		dangerRating?: string;
		problems?: string[];
		bottomLine?: string;
	}>();

	if (!body.draftText.trim()) {
		return c.json({ success: false, error: "draftText is required" }, 400);
	}

	const personas = await loadScoringPersonas();
	const result = reviewDraft(
		{
			draftText: body.draftText,
			dangerRating: body.dangerRating ?? "",
			problems: body.problems ?? [],
			bottomLine: body.bottomLine,
		},
		personas,
	);

	return c.json({ success: true, data: result });
});

/**
 * POST /api/scorecard/review/parse
 * Extracts plain text from an uploaded .docx or .txt file.
 * Returns { text: string } — client displays text in the draft textarea.
 */
scorecard.post("/review/parse", async (c) => {
	const formData = await c.req.formData();
	const file = formData.get("file");

	if (!(file instanceof File)) {
		return c.json({ success: false, error: "No file uploaded" }, 400);
	}

	const name = file.name.toLowerCase();
	const bytes = await file.arrayBuffer();

	if (name.endsWith(".txt")) {
		const text = new TextDecoder().decode(bytes);
		return c.json({ success: true, text });
	}

	if (name.endsWith(".docx")) {
		const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
		return c.json({ success: true, text: result.value });
	}

	return c.json({ success: false, error: "Unsupported file type. Upload a .docx or .txt file." }, 400);
});

export default scorecard;
