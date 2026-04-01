import { and, desc, eq } from "drizzle-orm";
import { getDb, queries } from "../db";
import { avalancheForecasts, avalancheProblems, snowpackReadings, snotelStations, weatherReadings } from "../db/schema";
import { dangerNameToLevel } from "../risk-assessment";
import { generateAlert } from "../alerts";
import type { RiskAssessment } from "../risk-assessment";
import type { AlertDecision } from "../alerts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ZoneSummary {
	slug: string;
	name: string;
	zoneId: number;
	dangerLevel: number;
	dangerName: string;
	problemCount: number;
	problems: string[];
	currentTemp: number | null;
	tempUnit: string;
	snowDepthIn: number | null;
	alert: Pick<AlertDecision, "action" | "label" | "escalated" | "escalationReason">;
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

			return {
				slug: zone.slug,
				name: zone.name,
				zoneId: zone.zoneId,
				dangerLevel: assessment.dangerLevel,
				dangerName: assessment.dangerName,
				problemCount: assessment.problemCount,
				problems: assessment.problems,
				currentTemp: assessment.currentTemp,
				tempUnit: assessment.tempUnit,
				snowDepthIn: assessment.snowDepthIn,
				alert: {
					action: alert.action,
					label: alert.label,
					escalated: alert.escalated,
					escalationReason: alert.escalationReason,
				},
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
	};
}
