import { ingestAllNwsZones } from "./nws";
import { ingestAllSnotelStations } from "./snotel";
import { ingestAllUacZones } from "./uac";

const ONE_HOUR_MS = 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * ONE_HOUR_MS;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;

// ---------------------------------------------------------------------------
// Run a job safely — log errors, never throw
// ---------------------------------------------------------------------------

async function runSafe(name: string, fn: () => Promise<void>): Promise<void> {
	try {
		console.log(`[ingestion] ${name} starting`);
		await fn();
		console.log(`[ingestion] ${name} complete`);
	} catch (err) {
		console.error(`[ingestion] ${name} error:`, err);
	}
}

// ---------------------------------------------------------------------------
// UAC ingestion + alert generation pipeline
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

export function startScheduler(): () => void {
	// Run all jobs immediately on startup, then on their respective intervals
	void runSafe("UAC forecast", ingestAllUacZones);
	void runSafe("NWS weather", ingestAllNwsZones);
	void runSafe("SNOTEL snowpack", ingestAllSnotelStations);

	const uacTimer = setInterval(() => void runSafe("UAC forecast", ingestAllUacZones), SIX_HOURS_MS);
	const nwsTimer = setInterval(() => void runSafe("NWS weather", ingestAllNwsZones), ONE_HOUR_MS);
	const snotelTimer = setInterval(() => void runSafe("SNOTEL snowpack", ingestAllSnotelStations), TWENTY_FOUR_HOURS_MS);

	return () => {
		clearInterval(uacTimer);
		clearInterval(nwsTimer);
		clearInterval(snotelTimer);
		console.log("[ingestion] Scheduler stopped");
	};
}
