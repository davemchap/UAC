import { and, desc, eq } from "drizzle-orm";
import { getDb, queries } from "../db";
import { avalancheForecasts, avalancheProblems, snowpackReadings, snotelStations, weatherReadings } from "../db/schema";
import { dangerNameToLevel } from "../risk-assessment";
import { generateAlert } from "../alerts";
import { parseBulletin } from "../uac-bulletin";
import type { RiskAssessment } from "../risk-assessment";
import type { AlertDecision } from "../alerts";
import type { ActiveBulletin } from "../uac-bulletin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiAlertSummary {
	dangerLevel: number;
	dangerRating: string;
	alertAction: string;
	avalancheProblems: string[];
	backcountrySummary: string;
}

export interface AiAlertDetail extends AiAlertSummary {
	dangerAboveTreelineLevel: number;
	dangerAboveTreelineRating: string;
	dangerNearTreelineLevel: number;
	dangerNearTreelineRating: string;
	dangerBelowTreelineLevel: number;
	dangerBelowTreelineRating: string;
	alertReasoning: string;
	model: string;
	createdAt: Date | null;
}

export interface ZoneSummary {
	slug: string;
	name: string;
	zoneId: number;
	dangerLevel: number;
	dangerName: string;
	problemCount: number;
	problems: string[];
	alert: Pick<AlertDecision, "action" | "label" | "escalated" | "escalationReason">;
	aiAlert: AiAlertSummary | null;
}

export interface ZoneDetail {
	slug: string;
	name: string;
	zoneId: number;
	forecastUrl: string;
	assessment: RiskAssessment;
	alert: AlertDecision;
	bottomLine: string;
	currentConditions: string;
	dateIssued: string;
	problems: { problemNumber: number; problemType: string; description: string | null }[];
	aiAlert: AiAlertDetail | null;
	activeBulletin: ActiveBulletin | null;
}

export interface ZoneSummariesResult {
	snapshotDate: string;
	zones: ZoneSummary[];
}

export interface MapZoneData {
	slug: string;
	name: string;
	lat: number;
	lon: number;
	dangerLevel: number;
	dangerName: string;
	alert: Pick<AlertDecision, "action" | "label" | "escalated" | "escalationReason">;
	aiAlert: AiAlertSummary | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractProblems(
	forecast:
		| {
				avalancheProblem1: string | null;
				avalancheProblem2: string | null;
				avalancheProblem3: string | null;
		  }
		| undefined,
): string[] {
	if (!forecast) return [];
	return [forecast.avalancheProblem1, forecast.avalancheProblem2, forecast.avalancheProblem3].filter(
		(p): p is string => typeof p === "string" && p.length > 0,
	);
}

function buildAssessment(
	dangerRating: string | null | undefined,
	problems: string[],
	temperature: number | null | undefined,
	tempUnit: string | null | undefined,
	snowDepthIn: number | null,
	hasDataGap: boolean,
	bottomLine = "",
): RiskAssessment {
	const dangerName = dangerRating ?? "Unknown";
	return {
		dangerLevel: dangerNameToLevel(dangerName),
		dangerName,
		problems,
		problemCount: problems.length,
		bottomLine,
		currentTemp: temperature ?? null,
		tempUnit: tempUnit ?? "F",
		snowDepthIn,
		hasDataGap,
	};
}

async function fetchLatestAiAlert(zoneId: number): Promise<AiAlertDetail | null> {
	const row = await queries.getLatestAlert(zoneId).then((rows) => rows.at(0));
	if (!row) return null;
	return {
		dangerLevel: row.dangerLevel,
		dangerRating: row.dangerRating,
		alertAction: row.alertAction,
		avalancheProblems: row.avalancheProblems,
		backcountrySummary: row.backcountrySummary,
		dangerAboveTreelineLevel: row.dangerAboveTreelineLevel,
		dangerAboveTreelineRating: row.dangerAboveTreelineRating,
		dangerNearTreelineLevel: row.dangerNearTreelineLevel,
		dangerNearTreelineRating: row.dangerNearTreelineRating,
		dangerBelowTreelineLevel: row.dangerBelowTreelineLevel,
		dangerBelowTreelineRating: row.dangerBelowTreelineRating,
		alertReasoning: row.alertReasoning,
		model: row.model,
		createdAt: row.createdAt,
	};
}

function toAiAlertSummary(detail: AiAlertDetail | null): AiAlertSummary | null {
	if (!detail) return null;
	return {
		dangerLevel: detail.dangerLevel,
		dangerRating: detail.dangerRating,
		alertAction: detail.alertAction,
		avalancheProblems: detail.avalancheProblems,
		backcountrySummary: detail.backcountrySummary,
	};
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getZoneSummaries(): Promise<ZoneSummariesResult> {
	const db = getDb();
	const zoneRows = await queries.getAllZones();

	const zones = await Promise.all(
		zoneRows.map(async (zone): Promise<ZoneSummary> => {
			const forecast = await db
				.select()
				.from(avalancheForecasts)
				.where(eq(avalancheForecasts.zoneId, zone.zoneId))
				.orderBy(desc(avalancheForecasts.createdAt))
				.limit(1)
				.then((rows) => rows.at(0));

			const weather = await db
				.select()
				.from(weatherReadings)
				.where(eq(weatherReadings.zoneId, zone.zoneId))
				.orderBy(weatherReadings.startTime)
				.limit(1)
				.then((rows) => rows.at(0));

			const problems = extractProblems(forecast);
			const assessment = buildAssessment(
				forecast?.overallDangerRating,
				problems,
				weather?.temperature,
				weather?.temperatureUnit,
				null,
				!forecast || !weather,
			);
			const alert = generateAlert(assessment);
			const aiAlertDetail = await fetchLatestAiAlert(zone.zoneId);

			return {
				slug: zone.slug,
				name: zone.name,
				zoneId: zone.zoneId,
				dangerLevel: assessment.dangerLevel,
				dangerName: assessment.dangerName,
				problemCount: assessment.problemCount,
				problems: assessment.problems,
				alert: {
					action: alert.action,
					label: alert.label,
					escalated: alert.escalated,
					escalationReason: alert.escalationReason,
				},
				aiAlert: toAiAlertSummary(aiAlertDetail),
			};
		}),
	);

	const snapshotDate = await db
		.select({ dateIssued: avalancheForecasts.dateIssued })
		.from(avalancheForecasts)
		.orderBy(desc(avalancheForecasts.createdAt))
		.limit(1)
		.then((rows) => rows.at(0)?.dateIssued ?? new Date().toISOString().slice(0, 10));

	return { snapshotDate, zones };
}

export async function getMapData(): Promise<MapZoneData[]> {
	const db = getDb();
	const zoneRows = await queries.getAllZones();

	return Promise.all(
		zoneRows.map(async (zone): Promise<MapZoneData> => {
			const forecast = await db
				.select()
				.from(avalancheForecasts)
				.where(eq(avalancheForecasts.zoneId, zone.zoneId))
				.orderBy(desc(avalancheForecasts.createdAt))
				.limit(1)
				.then((rows) => rows.at(0));

			const problems = extractProblems(forecast);
			const assessment = buildAssessment(forecast?.overallDangerRating, problems, null, null, null, !forecast);
			const alert = generateAlert(assessment);
			const aiAlertDetail = await fetchLatestAiAlert(zone.zoneId);

			return {
				slug: zone.slug,
				name: zone.name,
				lat: zone.lat,
				lon: zone.lon,
				dangerLevel: assessment.dangerLevel,
				dangerName: assessment.dangerName,
				alert: {
					action: alert.action,
					label: alert.label,
					escalated: alert.escalated,
					escalationReason: alert.escalationReason,
				},
				aiAlert: toAiAlertSummary(aiAlertDetail),
			};
		}),
	);
}

export async function getZoneDetail(slug: string): Promise<ZoneDetail | null> {
	const db = getDb();

	const zone = await queries.getZoneBySlug(slug).then((rows) => rows.at(0));
	if (!zone) return null;

	const forecast = await db
		.select()
		.from(avalancheForecasts)
		.where(eq(avalancheForecasts.zoneId, zone.zoneId))
		.orderBy(desc(avalancheForecasts.createdAt))
		.limit(1)
		.then((rows) => rows.at(0));

	const forecastProblems = forecast
		? await db
				.select({
					problemNumber: avalancheProblems.problemNumber,
					problemType: avalancheProblems.problemType,
					description: avalancheProblems.description,
				})
				.from(avalancheProblems)
				.where(eq(avalancheProblems.forecastId, forecast.id))
				.orderBy(avalancheProblems.problemNumber)
		: [];

	const weather = await db
		.select()
		.from(weatherReadings)
		.where(eq(weatherReadings.zoneId, zone.zoneId))
		.orderBy(weatherReadings.startTime)
		.limit(1)
		.then((rows) => rows.at(0));

	const station = await db
		.select({ triplet: snotelStations.triplet })
		.from(snotelStations)
		.where(eq(snotelStations.zoneId, zone.zoneId))
		.limit(1)
		.then((rows) => rows.at(0));

	const snowDepthIn = station
		? await db
				.select({ value: snowpackReadings.value })
				.from(snowpackReadings)
				.where(and(eq(snowpackReadings.stationTriplet, station.triplet), eq(snowpackReadings.elementCode, "SNWD")))
				.orderBy(desc(snowpackReadings.date))
				.limit(1)
				.then((rows) => rows.at(0)?.value ?? null)
		: null;

	const problems = extractProblems(forecast);
	const assessment = buildAssessment(
		forecast?.overallDangerRating,
		problems,
		weather?.temperature,
		weather?.temperatureUnit,
		snowDepthIn,
		!forecast || !weather,
		forecast?.bottomLine ?? "",
	);

	const aiAlertDetail = await fetchLatestAiAlert(zone.zoneId);

	return {
		slug: zone.slug,
		name: zone.name,
		zoneId: zone.zoneId,
		forecastUrl: zone.forecastUrl,
		assessment,
		alert: generateAlert(assessment),
		bottomLine: forecast?.bottomLine ?? "",
		currentConditions: forecast?.currentConditions ?? "",
		dateIssued: forecast?.dateIssued ?? "",
		problems: forecastProblems,
		aiAlert: aiAlertDetail,
		activeBulletin: parseBulletin(forecast?.specialBulletin),
	};
}
