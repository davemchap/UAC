import { getDb } from "../db";
import { avalancheForecasts, avalancheProblems, forecastZones } from "../db/schema";

// ---------------------------------------------------------------------------
// UAC Native API types
// ---------------------------------------------------------------------------

interface UacAdvisory {
	date_issued?: string;
	date_issued_timestamp?: string;
	overall_danger_rating?: string;
	overall_danger_rose?: string;
	avalanche_problem_1?: string;
	avalanche_problem_1_description?: string;
	danger_rose_1?: string;
	avalanche_problem_2?: string;
	avalanche_problem_2_description?: string;
	danger_rose_2?: string;
	avalanche_problem_3?: string;
	avalanche_problem_3_description?: string;
	danger_rose_3?: string;
	bottom_line?: string;
	current_conditions?: string;
	region?: string;
	forecaster_name?: string;
	Nid?: string;
	special_avalanche_bulletin?: string;
}

interface UacResponse {
	advisories?: { advisory: UacAdvisory }[];
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchUacForecast(apiUrl: string): Promise<UacAdvisory | null> {
	const res = await fetch(apiUrl, { method: "GET" });
	if (!res.ok) throw new Error(`UAC fetch failed: ${res.status} ${res.statusText}`);
	const data = (await res.json()) as UacResponse;
	return data.advisories?.at(0)?.advisory ?? null;
}

// ---------------------------------------------------------------------------
// Persist
// ---------------------------------------------------------------------------

async function persistUacForecast(zoneId: number, advisory: UacAdvisory): Promise<void> {
	const nid = advisory.Nid;
	const dateIssued = advisory.date_issued;
	const dangerRating = advisory.overall_danger_rating;

	if (!nid || !dateIssued || !dangerRating) {
		throw new Error(`UAC advisory for zone ${zoneId} missing required fields`);
	}

	const db = getDb();

	const [forecast] = await db
		.insert(avalancheForecasts)
		.values({
			zoneId,
			nid,
			dateIssued,
			dateIssuedTimestamp: advisory.date_issued_timestamp ?? null,
			overallDangerRating: dangerRating,
			overallDangerRose: advisory.overall_danger_rose ?? null,
			avalancheProblem1: advisory.avalanche_problem_1 ?? null,
			avalancheProblem2: advisory.avalanche_problem_2 ?? null,
			avalancheProblem3: advisory.avalanche_problem_3 ?? null,
			bottomLine: advisory.bottom_line ?? null,
			currentConditions: advisory.current_conditions ?? null,
			region: advisory.region ?? null,
			forecasterName: advisory.forecaster_name ?? advisory.region ?? null,
			specialBulletin: advisory.special_avalanche_bulletin ?? null,
		})
		.onConflictDoUpdate({
			target: [avalancheForecasts.zoneId, avalancheForecasts.nid],
			set: {
				overallDangerRating: dangerRating,
				overallDangerRose: advisory.overall_danger_rose ?? null,
				updatedAt: new Date(),
			},
		})
		.returning({ id: avalancheForecasts.id });

	const forecastId = forecast.id;

	const problems = [
		{
			num: 1,
			type: advisory.avalanche_problem_1,
			desc: advisory.avalanche_problem_1_description,
			rose: advisory.danger_rose_1,
		},
		{
			num: 2,
			type: advisory.avalanche_problem_2,
			desc: advisory.avalanche_problem_2_description,
			rose: advisory.danger_rose_2,
		},
		{
			num: 3,
			type: advisory.avalanche_problem_3,
			desc: advisory.avalanche_problem_3_description,
			rose: advisory.danger_rose_3,
		},
	].filter((p): p is typeof p & { type: string } => Boolean(p.type));

	for (const p of problems) {
		await db
			.insert(avalancheProblems)
			.values({
				forecastId,
				problemNumber: p.num,
				problemType: p.type,
				description: p.desc ?? null,
				dangerRose: p.rose ?? null,
			})
			.onConflictDoNothing();
	}
}

// ---------------------------------------------------------------------------
// Ingest all zones
// ---------------------------------------------------------------------------

export async function ingestAllUacZones(): Promise<void> {
	const db = getDb();
	const zones = await db.select({ zoneId: forecastZones.zoneId, apiUrl: forecastZones.apiUrl }).from(forecastZones);

	for (const zone of zones) {
		try {
			const advisory = await fetchUacForecast(zone.apiUrl);
			if (!advisory) {
				console.warn(`[uac] No advisory returned for zone ${zone.zoneId}`);
				continue;
			}
			await persistUacForecast(zone.zoneId, advisory);
			console.log(`[uac] Ingested zone ${zone.zoneId}`);
		} catch (err) {
			console.error(`[uac] Failed zone ${zone.zoneId}:`, err);
		}
	}
}
