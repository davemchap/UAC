/**
 * Pre-Forecast Review component.
 * Runs the full persona analysis suite on arbitrary draft text —
 * no DB access required. Pure business logic; I/O handled in the route.
 */

import {
	scoreForecast,
	simulateJourney,
	buildCoachingSuggestions,
	normalizeText,
	type PersonaScore,
	type CoachingSuggestion,
} from "./scoring";
import { computePersonaLens, type PersonaLensResult } from "./persona-lens";
import { computeDecisionMirror, type DecisionMirrorResult } from "./decision-mirror";
import { analyzeAssumptions, type AssumptionAuditResult } from "./assumption-audit";
import type { Persona } from "./personas";

export interface DraftReviewInput {
	/** Raw draft text — may contain HTML entities; will be normalized */
	draftText: string;
	/** UAC danger rating string e.g. "Considerable" or empty */
	dangerRating: string;
	/** Avalanche problem descriptions (up to 3) */
	problems: string[];
	/** Optional bottom-line / headline for the forecast */
	bottomLine?: string;
}

export interface DraftReviewResult {
	/** Normalized text used for all analysis */
	forecastText: string;
	bottomLine: string;
	dangerRating: string;
	/** Per-persona readability + actionability scores */
	personas: PersonaScore[];
	/** Journey simulation per persona */
	journeys: ReturnType<typeof simulateJourney>[];
	/** Coaching suggestions keyed to specific phrases */
	coaching: CoachingSuggestion[];
	/** Section-by-section comprehension per persona */
	personaLens: PersonaLensResult[];
	/** Predicted go/caution/no-go decision per persona */
	decisionMirror: DecisionMirrorResult[];
	/** Technical concepts assumed by the draft and which personas will miss them */
	assumptionAudit: AssumptionAuditResult;
	scoredAt: string;
}

/**
 * Run the full analysis suite on a draft forecast text.
 * @param input - Draft content and metadata
 * @param personas - Active personas to score against (undefined = use static defaults)
 */
export function reviewDraft(input: DraftReviewInput, personas?: Persona[]): DraftReviewResult {
	const forecastText = normalizeText(input.draftText);
	const bottomLine = normalizeText(input.bottomLine ?? forecastText.split("\n")[0]);
	const currentConditions = forecastText;
	const dangerRating = input.dangerRating.trim();
	const problems = input.problems.filter(Boolean);

	const personaScores = scoreForecast(forecastText, dangerRating, problems, bottomLine, personas);

	const journeys = personaScores.map((ps) =>
		simulateJourney(dangerRating, problems, bottomLine, currentConditions, ps),
	);

	const coaching = personaScores.flatMap((ps) =>
		buildCoachingSuggestions(
			forecastText,
			ps,
			personas?.find((p) => p.id === ps.personaId),
		),
	);

	const personaLens = computePersonaLens(forecastText, dangerRating, problems, bottomLine, currentConditions, personas);

	const decisionMirror = computeDecisionMirror(forecastText, dangerRating, problems, bottomLine, personas);

	const assumptionAudit = analyzeAssumptions(forecastText, dangerRating, problems, personas);

	return {
		forecastText,
		bottomLine,
		dangerRating,
		personas: personaScores,
		journeys,
		coaching,
		personaLens,
		decisionMirror,
		assumptionAudit,
		scoredAt: new Date().toISOString(),
	};
}
