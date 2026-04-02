/**
 * Seed demo observation reports for presentation.
 * Run with: DATABASE_URL=... bun scripts/seed-demo-reports.ts
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { observationReports, observerHandles } from "../src/components/db/schema";

const sql = postgres(process.env.DATABASE_URL ?? "", { max: 3 });
const db = drizzle(sql);

// Reliable placeholder mountain/snow photos via picsum.photos (seeded IDs = consistent images)
const PHOTOS = [
	"https://picsum.photos/seed/avy1/640/480",
	"https://picsum.photos/seed/snow2/640/480",
	"https://picsum.photos/seed/pack3/640/480",
	null,
	null,
];

const REPORTS = [
	{
		handle: "powder_hound_83",
		zoneSlug: "salt-lake",
		lat: 40.6,
		lng: -111.75,
		hazardType: "wind_slab",
		severity: "high",
		contentText:
			"Found a significant wind slab on NE aspect around 9,800ft. Propagated easily on ski cut. Did not enter the slope.",
		aiSummary:
			"Observer identified a reactive wind slab on northeast aspect at elevation. Ski cut propagation confirms instability. High concern for triggering.",
		contentImageUrl: PHOTOS[1],
		impactCount: 12,
	},
	{
		handle: "skintrack_sue",
		zoneSlug: "salt-lake",
		lat: 40.65,
		lng: -111.8,
		hazardType: "avalanche",
		severity: "critical",
		contentText:
			"Natural release on Flagstaff, mid-morning after solar warming. Crown at about 10,200ft, ran to 8,500ft. Slab was 18 inches deep.",
		aiSummary:
			"Natural avalanche observed on Flagstaff. R3 D2.5 storm slab. Solar warming trigger. Significant runout elevation span.",
		contentImageUrl: PHOTOS[0],
		impactCount: 31,
	},
	{
		handle: "uac_patrol_1",
		zoneSlug: "ogden",
		lat: 41.22,
		lng: -111.78,
		hazardType: "cornice",
		severity: "high",
		contentText:
			"Cornices loaded heavily overnight on N and NE aspects along main ridgeline. Several small pieces dropping spontaneously this morning.",
		aiSummary:
			"Large cornice development on north-facing aspects. Spontaneous drops observed, indicating instability. Avoid terrain below ridgelines.",
		contentImageUrl: null,
		impactCount: 8,
	},
	{
		handle: "backcountry_mike",
		zoneSlug: "provo",
		lat: 40.35,
		lng: -111.65,
		hazardType: "wind_slab",
		severity: "moderate",
		contentText:
			"Extended column test gave ECTN results at 9,400ft on W aspect. Stiff wind slab over facets, about 8 inches thick.",
		aiSummary:
			"ECTN result indicates non-propagating wind slab. Faceted snow layer present beneath. Moderate concern, results suggest limited triggering potential.",
		contentImageUrl: PHOTOS[2],
		impactCount: 6,
	},
	{
		handle: "skintrack_sue",
		zoneSlug: "logan",
		lat: 41.75,
		lng: -111.85,
		hazardType: "avalanche",
		severity: "high",
		contentText:
			"Saw a natural avalanche from the road on the N face of Mt Naomi. Looked like a storm slab, maybe R3 D2.",
		aiSummary:
			"Natural storm slab observed from distance on north aspect. R3 D2 estimate. Suggests storm snow still unstable in Logan zone.",
		contentImageUrl: null,
		impactCount: 14,
	},
	{
		handle: "powder_hound_83",
		zoneSlug: "uintas",
		lat: 40.75,
		lng: -110.85,
		hazardType: "wet_snow",
		severity: "moderate",
		contentText:
			"Wet loose slides running in the afternoon on S aspects below 10k. Surface snow getting heavy. Morning was fine.",
		aiSummary:
			"Afternoon wet loose avalanche activity on solar aspects. Temperature-driven trigger. Conditions deteriorate midday on south-facing slopes.",
		contentImageUrl: PHOTOS[4],
		impactCount: 4,
	},
	{
		handle: "wasatch_wanderer",
		zoneSlug: "moab",
		lat: 38.4,
		lng: -109.55,
		hazardType: "other",
		severity: "low",
		contentText:
			"Snowpack is thin here but there are isolated wind slabs on shaded terrain. Only a few patches at elevation.",
		aiSummary:
			"Thin snowpack with isolated wind slabs on shaded aspects. Limited avalanche terrain. Low concern for the zone overall.",
		contentImageUrl: null,
		impactCount: 2,
	},
	{
		handle: "uac_patrol_1",
		zoneSlug: "salt-lake",
		lat: 40.58,
		lng: -111.72,
		hazardType: "wind_slab",
		severity: "high",
		contentText:
			"[Detailed Observation]\nZone: salt-lake | Date: 2026-04-02 | Area: Cardiff Fork\nElevation: 9800ft | Aspect: NE | Experience: Advanced\nObserved: snowpack, avalanche\nSNOWPACK: Surface: Wind Slab | Depth: 54in | Storm Snow: 18in | Weak Layers: Yes — buried surface hoar 1/28 layer\nAVALANCHE: Type: Slab | Trigger: Natural | Size: R3/D2.5 | Width: 150ft",
		aiSummary:
			"Detailed structural snowpack obs. Buried surface hoar layer from Jan 28 still reactive. Wind slab sitting on facets and hoar. High instability.",
		contentImageUrl: PHOTOS[0],
		impactCount: 22,
	},
	{
		handle: "trail_scout_99",
		zoneSlug: "skyline",
		lat: 39.6,
		lng: -111.15,
		hazardType: "wind_slab",
		severity: "moderate",
		contentText:
			"Cross-loaded gullies on SW aspects look loaded. Hollow feeling underfoot in places. Haven't tested but being cautious.",
		aiSummary:
			"Hollow feeling snowpack in cross-loaded gullies suggests wind slab presence. Observer exercising caution without formal test. Moderate concern.",
		contentImageUrl: null,
		impactCount: 3,
	},
	{
		handle: "wasatch_wanderer",
		zoneSlug: "ogden",
		lat: 41.3,
		lng: -111.82,
		hazardType: "avalanche",
		severity: "moderate",
		contentText:
			"Old debris in North Fork of Ogden Canyon. Looks like it ran a few days ago, maybe after the storm. R2 D2.",
		aiSummary:
			"Recent avalanche debris observed in Ogden canyon drainage. Estimated R2 D2 storm slab. Evidence of recent storm snow instability.",
		contentImageUrl: PHOTOS[3],
		impactCount: 7,
	},
];

const HANDLES = [
	{ handle: "skintrack_sue", totalImpactPoints: 45, badgeLevel: "sentinel", reportCount: 2 },
	{ handle: "uac_patrol_1", totalImpactPoints: 30, badgeLevel: "spotter", reportCount: 2 },
	{ handle: "powder_hound_83", totalImpactPoints: 16, badgeLevel: "spotter", reportCount: 2 },
	{ handle: "backcountry_mike", totalImpactPoints: 6, badgeLevel: "scout", reportCount: 1 },
	{ handle: "wasatch_wanderer", totalImpactPoints: 9, badgeLevel: "scout", reportCount: 2 },
	{ handle: "trail_scout_99", totalImpactPoints: 3, badgeLevel: "scout", reportCount: 1 },
];

async function seed() {
	console.log("Seeding demo observation reports...");

	// Clear existing demo data
	const handles = HANDLES.map((h) => h.handle);
	await sql`DELETE FROM observation_reports WHERE handle = ANY(${handles}::text[])`;
	await sql`DELETE FROM observer_handles WHERE handle = ANY(${handles}::text[])`;

	// Insert reports
	for (const r of REPORTS) {
		await db.insert(observationReports).values({
			handle: r.handle,
			zoneSlug: r.zoneSlug,
			lat: r.lat,
			lng: r.lng,
			hazardType: r.hazardType,
			severity: r.severity,
			contentText: r.contentText,
			aiSummary: r.aiSummary,
			contentImageUrl: r.contentImageUrl ?? null,
			impactCount: r.impactCount,
			status: "approved",
		});
		process.stdout.write(".");
	}

	// Insert leaderboard handles
	for (const h of HANDLES) {
		await db.insert(observerHandles).values(h);
	}

	console.log(`\nDone. Inserted ${REPORTS.length} approved reports and ${HANDLES.length} observer handles.`);
	await sql.end();
}

seed().catch((e) => {
	console.error(e);
	process.exit(1);
});
