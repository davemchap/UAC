import { loadZoneConfig, getZoneData, getAllZoneSlugs } from "../avalanche-data";
import type { ZoneConfig } from "../avalanche-data";
import { assessZone } from "../risk-assessment";
import { generateAlert } from "../alerts";
import type { AlertDecision } from "../alerts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MapZoneData {
	slug: string;
	name: string;
	lat: number;
	lon: number;
	dangerLevel: number;
	dangerName: string;
	alert: AlertDecision;
}

// ---------------------------------------------------------------------------
// Pure assembly logic
// ---------------------------------------------------------------------------

export function getMapZoneData(zoneConfig: ZoneConfig[] = loadZoneConfig()): MapZoneData[] {
	const slugs = getAllZoneSlugs();

	return slugs
		.map((slug) => {
			const data = getZoneData(slug);
			if (!data) return null;

			const config = zoneConfig.find((z) => z.slug === slug);
			if (!config) return null;

			const assessment = assessZone(data);
			const alert = generateAlert(assessment);

			return {
				slug,
				name: config.name,
				lat: config.lat,
				lon: config.lon,
				dangerLevel: assessment.dangerLevel,
				dangerName: assessment.dangerName,
				alert,
			};
		})
		.filter((z): z is MapZoneData => z !== null);
}
