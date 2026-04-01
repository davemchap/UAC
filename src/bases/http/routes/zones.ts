import { Hono } from "hono";
import { getAllZoneSlugs, getSnapshotDate, getZoneData, loadZoneConfig } from "../../../components/avalanche-data";
import { generateAlert } from "../../../components/alerts";
import { assessZone } from "../../../components/risk-assessment";

const zones = new Hono();

zones.get("/", (c) => {
	const slugs = getAllZoneSlugs();
	const zoneConfig = loadZoneConfig();
	const snapshotDate = getSnapshotDate();

	const summaries = slugs
		.map((slug) => {
			const data = getZoneData(slug);
			if (!data) return null;

			const config = zoneConfig.find((z) => z.slug === slug);
			const assessment = assessZone(data);
			const alert = generateAlert(assessment);

			return {
				slug,
				name: config?.name ?? slug,
				zoneId: data.zone_id,
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
		})
		.filter((z): z is NonNullable<typeof z> => z !== null);

	return c.json({ success: true, snapshotDate, count: summaries.length, zones: summaries });
});

zones.get("/:slug", (c) => {
	const slug = c.req.param("slug");
	const data = getZoneData(slug);

	if (!data) {
		return c.json({ success: false, error: `Zone not found: ${slug}` }, 404);
	}

	const zoneConfig = loadZoneConfig();
	const config = zoneConfig.find((z) => z.slug === slug);
	const assessment = assessZone(data);
	const alert = generateAlert(assessment);
	const advisory = data.forecast.advisories.at(0)?.advisory;

	return c.json({
		success: true,
		zone: {
			slug,
			name: config?.name ?? slug,
			zoneId: data.zone_id,
			forecastUrl: config?.forecast_url ?? null,
			assessment,
			alert,
			bottomLine: advisory?.bottom_line ?? "",
			currentConditions: advisory?.current_conditions ?? "",
			dateIssued: advisory?.date_issued ?? "",
		},
	});
});

export default zones;
