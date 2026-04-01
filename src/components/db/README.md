# db component

Database access layer. Single source of truth for schema, migrations, and query helpers.

## Public API

```typescript
import { getDb, queries, getSql, checkDatabaseHealth, initializeDatabase, closeDatabase } from "../db";
import { forecastZones, snotelStations, avalancheForecasts, avalancheProblems,
         weatherReadings, snowpackReadings, alertThresholds, escalationRules } from "../db";
```

| Export | Use for |
|---|---|
| `getDb()` | Drizzle instance — primary interface for all queries |
| `queries.*` | Typed query helpers for common reads (see below) |
| `checkDatabaseHealth()` | Health check (`SELECT 1`) — used by `/health` route |
| `initializeDatabase()` | Runs migrations on startup — called by HTTP base |
| `closeDatabase()` | Graceful shutdown — called on SIGTERM |
| `getSql()` | Raw `postgres` client — **deprecated**, kept for test compatibility only |
| Table exports | Schema table refs for use in `getDb()` custom queries |

### queries helpers

```
queries.getAllZones()
queries.getZoneBySlug(slug)
queries.getZoneByZoneId(zoneId)
queries.getSnotelStationsByZoneId(zoneId)
queries.getLatestForecast(zoneId)
queries.getForecastProblems(forecastId)
queries.getWeatherReadings(zoneId)
queries.getSnowpackReadings(triplet)
queries.getAllAlertThresholds()
queries.getAllEscalationRules()
```

## Files

| File | Purpose |
|---|---|
| `schema.ts` | Drizzle table definitions — source of truth for all column types |
| `index.ts` | Connection management + public exports |
| `migrate.ts` | Standalone migration runner (`bun run db:migrate`) |
| `seed.ts` | Static data loader from `data/black-diamond/` (`bun run db:seed`) |
| `migrations/` | Generated SQL migration files — do not edit by hand |

## Not exported (internal)

- The `postgres` connection instance (`_client`) — use `getDb()` instead
- Migration internals — use `bun run db:migrate`
