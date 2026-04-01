---
name: db
description: Use this skill for database operations — running migrations, seeding data, inspecting the database, and understanding the Drizzle ORM schema for this project.
version: 0.1.0
---

# Database Operations

This project uses **Drizzle ORM** with PostgreSQL. The schema, migrations, and query helpers all live in `src/components/db/`.

## Quick Reference

```bash
bun run db:migrate   # Apply pending migrations to the database
bun run db:seed      # Load static black-diamond JSON data into all tables (idempotent)
bun run db:studio    # Open Drizzle Studio UI to browse/edit data
psql $DATABASE_URL   # Direct psql session (inspect, debug, ad-hoc queries)
```

## Schema

Schema is defined in `src/components/db/schema.ts` using Drizzle's `pgTable` builder.
When you change the schema, regenerate and commit the migration:

```bash
bunx drizzle-kit generate --config=drizzle.config.ts   # generates SQL in src/components/db/migrations/
bun run db:migrate                                       # applies it to the database
```

**Never edit migration files by hand.** Always regenerate via drizzle-kit.

## Tables

| Table | Key columns |
|---|---|
| `forecast_zones` | `zone_id` (UAC ID), `slug`, `lat`, `lon`, `api_url` |
| `snotel_stations` | `triplet` (e.g. `766:UT:SNTL`), `zone_id` |
| `avalanche_forecasts` | `zone_id`, `nid` (UAC forecast ID), `overall_danger_rating` |
| `avalanche_problems` | `forecast_id`, `problem_number` (1-3), `problem_type` |
| `weather_readings` | `zone_id`, `start_time`, `temperature`, `short_forecast` |
| `snowpack_readings` | `station_triplet`, `date`, `element_code` (SNWD/WTEQ/TOBS), `value` |
| `alert_thresholds` | `danger_level` (1-5), `action`, `name` |
| `escalation_rules` | `condition`, `action` |

## Querying in Code

Import `getDb()` and `queries` from `src/components/db`:

```typescript
import { getDb, queries } from "../db";

// Use prebuilt helpers for common reads
const zones = await queries.getAllZones();
const forecast = await queries.getLatestForecast(zoneId);
const problems = await queries.getForecastProblems(forecastId);
const weather = await queries.getWeatherReadings(zoneId);
const snowpack = await queries.getSnowpackReadings(triplet);
const thresholds = await queries.getAllAlertThresholds();

// Custom queries use getDb() + schema imports
import { forecastZones } from "../db/schema";
import { eq } from "drizzle-orm";
const db = getDb();
const zone = await db.select().from(forecastZones).where(eq(forecastZones.slug, "salt-lake")).limit(1);
```

## Inspecting with psql

```bash
psql $DATABASE_URL

\dt                                          -- list all tables
\d forecast_zones                            -- describe table structure
SELECT COUNT(*) FROM avalanche_forecasts;    -- count rows
SELECT slug, overall_danger_rating FROM avalanche_forecasts JOIN forecast_zones USING (zone_id);
\q                                           -- quit
```

## Test Mocking

Tests mock the entire `../components/db` module. When you add new exports to `db/index.ts`,
add them to the mock in `src/__tests__/app.test.ts` to avoid "Export not found" errors:

```typescript
void mock.module("../components/db", () => ({
  getSql: () => () => [],
  getDb: () => ({}),
  checkDatabaseHealth: () => Promise.resolve(true),
  initializeDatabase: () => Promise.resolve(),
  closeDatabase: () => Promise.resolve(),
  // add new exports here
}));
```
