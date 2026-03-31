# Golden Datasets — Eval Scenarios

Golden datasets are curated test scenarios for evaluating the analysis and alerting engine. Each file contains **real forecast data** paired with **expert-verified expected outputs** — professional avalanche forecasters' actual danger assessments from multiple US avalanche centers.

## How They Work

Professional avalanche forecasters at centers like UAC, NWAC, BTAC, and CAIC are trained avalanche scientists. When they rate a zone as "High" danger with "Wind Slab" and "Persistent Slab" problems, that IS the expert assessment. Teams build an analysis engine and test whether it reaches the same conclusions given the same input data.

Each golden dataset file contains:

- **Inputs** — raw forecast, weather, and snowpack data for one zone on one date
- **Expected outputs** — the forecaster's danger rating, avalanche problems, and the alert decision derived from `alert-thresholds.json`

## Dual Purpose: Tests and Evals

The expected outputs serve two distinct verification purposes:

**As test targets (deterministic pipeline):** The expected danger rating, problem list, and alert decision are direct comparison targets for testing the data ingestion and parsing pipeline. Did the parser extract "Considerable"? Did the alert router trigger "human_review"? These are binary pass/fail checks on deterministic code.

**As eval rubric criteria (AI analysis layer):** When the platform includes an AI-powered analysis layer — generating briefings, contextual alerts, or cross-zone synthesis — the same expected outputs become the rubric criteria for evaluating the AI's output. Does the AI-generated briefing accurately reflect Considerable danger? Does it mention all three expected avalanche problems? Does it correctly characterize the persistent weak layer situation described in the forecast discussion? The golden dataset's expected outputs define *what should be true*; the eval checks whether the AI's narrative is consistent with that truth.

## Coverage

18 scenarios across all 5 danger levels, all 4 alert decision paths, 4 avalanche centers, and 6 US states.

| Danger Level | Count | Alert Action | Scenarios |
|---|---|---|---|
| Low (1) | 1 | `no_alert` | gs-008 |
| Moderate (2) | 8 | `no_alert` | gs-001–003, 005–007, 009–010 |
| Considerable (3) | 3 | `human_review` | gs-004, 011–012 |
| High (4) | 4 | `auto_send` | gs-013–016 |
| Extreme (5) | 2 | `auto_send_urgent` | gs-017–018 |

## Scenarios

### Utah (UAC) — 7 scenarios from 2026-03-09

| File | Zone | Danger | Problems | Snowpack |
|------|------|--------|----------|----------|
| `gs-001-salt-lake.json` | Salt Lake | Moderate (2) | Wind Slab, Wet Slab, Persistent Slab | 4 SNOTEL stations |
| `gs-002-ogden.json` | Ogden | Moderate (2) | Wind Slab, Wet Slab, Persistent Slab | 4 SNOTEL stations |
| `gs-003-provo.json` | Provo | Moderate (2) | Wind Slab, Wet Slab, Persistent Slab | 4 SNOTEL stations |
| `gs-004-logan.json` | Logan | Considerable (3) | Wind Slab, Wet Slab, Persistent Slab | null |
| `gs-005-uintas.json` | Uintas | Moderate (2) | Persistent Slab, Wind Slab | null |
| `gs-006-skyline.json` | Skyline | Moderate (2) | Persistent Slab | null |
| `gs-007-moab.json` | Moab | Moderate (2) | Wet Slab, Persistent Slab | null |

### Colorado (CAIC) — 5 scenarios from 2026-03-09

| File | Zone | Danger (Alp/Tln/BTL) | Problems |
|------|------|----------------------|----------|
| `gs-008-southern-sawatch.json` | Southern Sawatch | Low / Low / Low | *(none)* |
| `gs-009-grand-mesa.json` | Grand Mesa | Moderate / Moderate / Low | Persistent Slab, Wind Slab |
| `gs-010-sawatch.json` | Sawatch Range | Moderate / Moderate / Moderate | Wind Slab, Wet Loose |
| `gs-011-northern-san-juan.json` | Northern San Juan | Considerable / Moderate / Moderate | Persistent Slab, Wind Slab, Wet Loose |
| `gs-012-vail-summit.json` | Vail & Summit County | Considerable / Considerable / Moderate | Persistent Slab, Wind Slab, Wet Loose |

### Pacific Northwest & Wyoming — 6 scenarios (High and Extreme)

| File | Zone | Center | Date | Danger (Upper/Mid/Lower) | Problems |
|------|------|--------|------|-------------------------|----------|
| `gs-013-stevens-pass-high.json` | Stevens Pass, WA | NWAC | 2026-03-09 | High / Considerable / Moderate | Wind Slab, Persistent Slab |
| `gs-014-mt-hood-high.json` | Mt Hood, OR | NWAC | 2026-02-24 | High / High / Considerable | Storm Slab, Wet Loose |
| `gs-015-east-slopes-north-high.json` | East Slopes North, WA | NWAC | 2026-02-27 | High / High / Considerable | Persistent Slab |
| `gs-016-togwotee-pass-high.json` | Togwotee Pass, WY | BTAC | 2026-02-25 | High / Considerable / null | Storm Slab, Persistent Slab |
| `gs-017-stevens-pass-extreme.json` | Stevens Pass, WA | NWAC | 2022-01-07 | Extreme / Extreme / Extreme | Storm Slab |
| `gs-018-salt-river-wyoming-extreme.json` | Salt River/Wyoming, WY | BTAC | 2017-02-09 | Extreme / Extreme / Extreme | Wind Slab, Wet Slab |

## Data Sources

- **Forecasts:** UAC native API, CAIC AVID API, avalanche.org product detail API
- **Weather:** NWS hourly forecast (`api.weather.gov`) for current-day scenarios; historical weather converted to NWS format from NOAA archive data for past scenarios
- **Snowpack:** SNOTEL/NRCS for Wasatch stations (Salt Lake, Ogden, Provo); null for other zones

## Format Differences by Center

The golden datasets intentionally include three different forecast formats — this mirrors real-world data that an analysis engine must handle:

| Center | Format | Danger Rating Location | Problem Type Naming |
|--------|--------|----------------------|-------------------|
| UAC | `advisories[].advisory` (flat strings) | `overall_danger_rating` | Title Case: "Wind Drifted Snow" |
| CAIC | AVID (multi-day arrays, compound aspects) | `dangerRatings.days[0].alp/tln/btl` | camelCase: "windSlab" |
| NWAC/BTAC | avalanche.org product detail (structured) | `danger[0].upper/middle/lower` | Title Case: "Storm Slab" |

## Building More Scenarios

To expand the golden dataset:
1. Fetch forecasts from any supported API for different dates or zones
2. Fetch corresponding NWS weather and SNOTEL data
3. The forecaster's danger rating becomes the expected output
4. Derive the alert decision from `../alert-thresholds.json`
5. For historical scenarios, use NOAA archive weather data converted to NWS period format

Key gaps to fill over time: scenarios with rapid danger escalation (+2 levels in 24 hours), data-gap edge cases, and spring wet avalanche cycles.
