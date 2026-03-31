# Available APIs

All APIs below are **free, require no authentication, and return JSON**.

> **CRITICAL — READ-ONLY ACCESS ONLY**
>
> **Your application must NEVER create, update, or delete data on any of these APIs.** These are live production systems operated by government agencies and nonprofit organizations that publish real avalanche safety information. Their data directly informs life-or-death backcountry travel decisions.
>
> Specifically, your application must:
>
> - **NEVER send POST requests** to create observations, reports, or any other records
> - **NEVER send PUT or PATCH requests** to modify existing data
> - **NEVER send DELETE requests** to remove any data
> - **ONLY use GET requests** to read data
>
> This is a workshop environment. Test data submitted to these production APIs would pollute real avalanche safety databases that forecasters and backcountry travelers rely on. Some of these APIs (notably CAIC) accept write operations without authentication, which means an accidental POST from your application could create a real observation record in their production database.
>
> **Build your submission forms and write operations against your own local database or in-memory storage. Never point them at these external APIs.**

> **IMPORTANT:** These are public, free APIs operated by nonprofit and government organizations. They are not designed to handle a room full of workshop participants hitting them simultaneously. **Always use the pre-seeded data files first.** Only call live APIs when you specifically need real-time data or are verifying a live integration.

## API Index

| API | What It Provides | Documentation |
|-----|-----------------|---------------|
| [Avalanche.org](./avalanche-org.md) | Zone boundaries (GeoJSON for maps), zone-level danger summaries | [avalanche-org.md](./avalanche-org.md) |
| [NWS (National Weather Service)](./nws.md) | Official US government weather forecasts, alerts, and observations | [nws.md](./nws.md) |
| [SNOTEL](./snotel.md) | Snowpack data — snow depth, snow water equivalent, temperature | [snotel.md](./snotel.md) |
| [Utah Avalanche Center (UAC) Native](./uac-native.md) | Utah Avalanche Center forecasts in their native format | [uac-native.md](./uac-native.md) |
| [CAIC (Colorado)](./caic.md) | Colorado Avalanche Information Center forecasts (AVID format) | [caic.md](./caic.md) |

## Weather Data: NWS + SNOTEL

The National Weather Service (NWS) API provides all weather forecast data for the workshop — temperature, wind, precipitation probability, and text forecasts. NWS is the official US government weather source operated by NOAA. No API key required.

For snow depth and snowpack measurements, pair NWS with [SNOTEL](./snotel.md) — NWS forecasts weather but does not provide snowpack depth. See [nws.md](./nws.md) for endpoint details, the two-step coordinate lookup, and the workshop coordinate table.

## Which APIs Do I Need?

| Track | Primary APIs | Notes |
|-------|-------------|-------|
| **Green Circle** | UAC Native (forecast), NWS (weather), SNOTEL (snowpack) | Single zone: Salt Lake |
| **Blue Square** | Same as Green Circle (for enrichment features) | Core data is user-generated observations |
| **Black Diamond** | Same as Green Circle but for all 9 UAC zones | Multi-zone ingestion |
| **Double Black Diamond** | CAIC (Colorado) + UAC Native (Utah) — integration challenge | Two genuinely different US formats to unify |
| **Any track (maps)** | Avalanche.org (zone boundaries) | Only source for GeoJSON polygons — use if building a map |

## API Protection Strategy

1. **Pre-seeded data first** — every track has JSON snapshots of API responses in its data directory. Build against these.
2. **Cache if you fetch live** — store responses locally so page reloads don't re-hit the API.
3. **Rate awareness** — NWS has no documented rate limits but requests should include a `User-Agent` header. Other APIs are government/nonprofit services — be respectful of their resources.
4. **Fallback plan** — if any API is down, the pre-seeded data files ensure you can still build a working app.
