# Data — Avalanche Workshop Resources

This directory contains all data resources for the Ship Summit Impact Lab workshop. It serves as the single data layer seeded into every participant workspace for all tracks.

## Quick Start

**Building an Avalanche Field Guide?** Start with [green-circle/](./green-circle/)
**Building an Observation Network?** Start with [blue-square/](./blue-square/)
**Building an Analysis & Alerting Engine?** Start with [black-diamond/](./black-diamond/)
**Building a Multi-Center Platform?** Start with [double-black-diamond/](./double-black-diamond/)

Need reference data (danger scale, zones, SNOTEL stations)? See [shared/](./shared/)
Want to call a live API? See [apis/](./apis/) for documentation and rate-limiting guidance.

## Directory Structure

```
data/
├── README.md                          ← You are here
├── apis/                              ← API documentation and endpoint reference
│   ├── README.md                      ← API index and protection strategy
│   ├── avalanche-org.md               ← avalanche.org (danger ratings, zone boundaries)
│   ├── nws.md                         ← NWS (weather forecasts, alerts)
│   ├── snotel.md                      ← SNOTEL/NRCS (snowpack data)
│   ├── uac-native.md                  ← Utah Avalanche Center (UAC) native forecast format
│   └── caic.md                        ← Colorado Avalanche Information Center (CAIC) forecast format
├── shared/                            ← Reference data used across all tracks
│   ├── README.md
│   ├── avalanche-reference.json       ← Danger scale, problem types, codes
│   ├── zones.json                     ← UAC forecast zones with current danger
│   ├── snotel-stations.json           ← Wasatch SNOTEL station reference
│   └── golden-datasets/               ← Eval scenarios with expert assessments
│       ├── README.md
│       └── gs-{NNN}-{zone}.json       ← Individual scenario files
├── green-circle/                      ← Avalanche Field Guide (single zone)
│   ├── README.md
│   ├── avalanche-forecast.json        ← UAC Salt Lake forecast snapshot
│   ├── weather.json                   ← Wasatch weather (hourly, 7-day)
│   ├── snotel-snowpack.json           ← Snowpack readings (4 stations, 7 days)
│   └── reference.json                 ← Region → API parameter mapping
├── blue-square/                       ← Observation Network (user-generated data)
│   ├── README.md
│   ├── sample-observations.json       ← 20 realistic field observations
│   └── observation-types.json         ← Observation taxonomy and field schemas
├── black-diamond/                     ← Analysis & Alerting Engine (multi-zone)
│   ├── README.md
│   ├── zone-config.json               ← All 9 UAC zones with coordinates/SNOTEL
│   ├── multi-zone-snapshot.json       ← Complete 9-zone data snapshot
│   └── alert-thresholds.json          ← Alert rules and escalation config
└── double-black-diamond/              ← Multi-Center Platform (cross-format)
    ├── README.md
    ├── center-a-caic/                 ← Pair A: Colorado (AVID format)
    │   ├── forecast.json
    │   └── zones.json
    ├── center-b-uac-native/           ← Pair B: Utah (flat format)
    │   ├── salt-lake.json
    │   ├── ogden.json
    │   └── provo.json
    ├── unified-schema-target.json     ← Target schema for normalization
    └── field-mapping-reference.md     ← Cross-format field mapping guide
```

## Data Sources

All pre-seeded data was fetched from live APIs on **2026-03-06**. Sources:

| Source | Type | Auth | Rate Limit |
|--------|------|------|------------|
| [avalanche.org](https://api.avalanche.org) | Zone boundaries (GeoJSON for maps), zone-level danger summaries | None | Undocumented — be respectful |
| [NWS](https://api.weather.gov) | Weather forecasts, alerts, observations | None (User-Agent recommended) | None documented |
| [SNOTEL/NRCS](https://wcc.sc.egov.usda.gov/awdbRestApi/) | Snowpack readings | None | Undocumented — be respectful |
| [UAC](https://utahavalanchecenter.org) | Native forecast format | None | Cloudflare-protected |
| [CAIC](https://avalanche.state.co.us) | Colorado forecasts (AVID format) | None | Via AVID API proxy |

## API Protection

> **IMPORTANT:** These are public, free APIs operated by nonprofit and government organizations. They are not designed to handle simultaneous requests from a room full of workshop participants.

1. **Use pre-seeded data first** — build and test against the JSON files in this directory
2. **Cache if you fetch live** — store API responses locally
3. **The pre-seeded data IS your fallback** — if any API is down, you can still build a fully working app

See [apis/README.md](./apis/README.md) for detailed guidance.

## Design Decisions

- **One image, all tracks.** Rather than four separate workspace images with track-specific data, this single `data/` directory serves every track. AI assistants use progressive discovery (README → track directory → individual files) to find what's relevant.
- **Pre-seeded data from live APIs.** All JSON data files were fetched from real APIs (avalanche forecasts and snowpack on 2026-03-06, NWS weather on 2026-03-09) with real conditions — not synthetic or hand-crafted. This means the data has authentic structure, realistic values, and real-world quirks.
- **Golden datasets use forecaster assessments as expected outputs.** UAC forecasters are professional avalanche scientists. Their danger ratings in the forecast data ARE the expert-verified "answer key" for eval harnesses (used by Black Diamond and Double Black Diamond). No separate avalanche science expertise was needed to author expected outputs.
- **Blue Square observations are authored, not from an API.** There is no public observation API — the avalanche.org API only covers forecasts and zone data, and the UAC website blocks programmatic access (Cloudflare). The 20 sample observations were authored using real UAC observation language, real Wasatch locations, and realistic field values.
- **Raw API responses preserved for Double Black Diamond.** The CAIC (via AVID proxy) and UAC native forecast files are saved as-is from the APIs — no cleaning or normalization. The real format differences ARE the learning objective. This mirrors what avalanche.org already does — teams build the normalization layer themselves.
- **Curriculum outline trimmed.** The inline data schemas that were previously in `project-documentation/curriculum-outline.md` (lines 340-933) have been replaced with references pointing to this directory as the authoritative source.

## Known Limitations

- **avalanche.org product detail API returns empty data for UAC and CAIC.** The `GET /v2/public/product/{id}` endpoint returns null fields (`danger`, `forecast_avalanche_problems`, `bottom_line`, etc.) for both Utah Avalanche Center and Colorado Avalanche Information Center products because they publish through their own systems. Use the UAC Native API and CAIC AVID proxy for full forecast data instead.
- **SNOTEL coverage gaps.** Station triplets for Logan (1194:UT:SNTL) and Uintas (1014:UT:SNTL) did not return data. Skyline and Moab have no nearby SNOTEL stations. Snowpack is `null` for these zones in the Black Diamond multi-zone snapshot.
- **avalanche.org observation filtering doesn't work.** The `type=observation` query parameter on `GET /v2/public/products` returns forecasts regardless — the API doesn't appear to support observation queries.
- **Data freshness.** All snapshots are from 2026-03-06. Avalanche conditions change daily. For the workshop event, these files should ideally be refreshed the morning of by re-running the API fetches. The API endpoints documented in `apis/` and in `green-circle/reference.json` make this straightforward.

## Which Track Uses What

| Data | Green Circle | Blue Square | Black Diamond | Double Black Diamond |
|------|:-----------:|:-----------:|:------------:|:-------------------:|
| Shared reference | ✓ | ✓ | ✓ | ✓ |
| Green Circle data | ✓ | Enrichment | Base layer | — |
| Blue Square data | — | ✓ | — | — |
| Black Diamond data | — | — | ✓ | — |
| Double Black Diamond data | — | — | — | ✓ |
| Live APIs | Run 2+ | Run 4 (stretch) | Run 3+ | Run 3+ |
