# ingestion component

Live data ingestion from external APIs. Polls UAC, NWS, and SNOTEL on a cron schedule and upserts into the database.

## Public API

```typescript
import { startScheduler, ingestAllUacZones, ingestAllNwsZones, ingestAllSnotelStations } from "../ingestion";
```

| Export | Use for |
|---|---|
| `startScheduler()` | Start all cron jobs; returns a stop function — called by HTTP base in `initApp()` |
| `ingestAllUacZones()` | One-shot UAC ingest (all 9 zones) |
| `ingestAllNwsZones()` | One-shot NWS ingest (all zones) |
| `ingestAllSnotelStations()` | One-shot SNOTEL ingest (all stations) |

## Cron Schedule

| Job | Interval | Tables updated |
|---|---|---|
| UAC forecast | Every 6 hours | `avalanche_forecasts`, `avalanche_problems` |
| NWS weather | Every 1 hour | `weather_readings` |
| SNOTEL snowpack | Every 24 hours | `snowpack_readings` |

All jobs also fire immediately on `startScheduler()` call.

## Files

| File | Purpose |
|---|---|
| `uac.ts` | Fetch + persist UAC Native forecast API |
| `nws.ts` | Fetch + persist NWS hourly forecast API (with in-memory grid point cache) |
| `snotel.ts` | Fetch + persist SNOTEL AWDB REST API |
| `scheduler.ts` | Wire fetch functions to `setInterval` timers |
| `index.ts` | Public exports |

## Not exported (internal)

- `fetchUacForecast`, `persistUacForecast` — implementation details of `ingestAllUacZones`
- `resolveGridPoint`, `fetchHourlyForecast`, `persistWeatherReadings` — NWS internals
- `fetchSnotelData`, `persistSnowpackReadings` — SNOTEL internals
- `gridPointCache` — in-memory Map keyed by zone_id; lives for process lifetime
- `runSafe` — error-isolating wrapper used by scheduler

## API Rules

**All fetches are GET-only.** This component must never send POST, PUT, PATCH, or DELETE to any external endpoint. UAC, NWS, and SNOTEL are all live production systems.
