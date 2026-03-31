# Black Diamond — Avalanche Forecast Analysis & Alerting Engine Data

Pre-seeded data for the **Black Diamond** track. Teams build a system that ingests forecast, weather, and snowpack data across all 9 Utah Avalanche Center (UAC) zones, analyzes conditions, generates risk assessments, and produces automated alerts.

## Files

| File | Description | Source |
|------|-------------|--------|
| [zone-config.json](./zone-config.json) | All 9 UAC zones with IDs, coordinates, and SNOTEL stations | Curated from API data |
| [multi-zone-snapshot.json](./multi-zone-snapshot.json) | Complete forecast + weather + snowpack snapshot for all 9 zones | Live APIs: UAC, NWS, SNOTEL |
| [alert-thresholds.json](./alert-thresholds.json) | Starting alert configuration with thresholds and escalation rules | Authored — reasonable defaults for teams to iterate on |
| [golden-datasets/](../shared/golden-datasets/) | 18 real forecast scenarios covering all 5 danger levels from 4 US avalanche centers (in `data/shared/`) | Live API data with forecaster assessments |

## How Teams Use This Data

### Run 1 (Build the engine)
Teams use `zone-config.json` to configure multi-zone ingestion and `multi-zone-snapshot.json` as the initial data source. Build against the snapshot — don't hit live APIs until the engine works.

### Run 2 (Build eval harnesses)
Teams build evaluation harnesses using the golden datasets in `data/shared/golden-datasets/`. Each golden dataset is a real forecast scenario where the UAC forecasters have already determined the danger rating — that's the expected output. Teams test whether their analysis engine reaches the same conclusions. `alert-thresholds.json` provides the starting alert rules.

### Run 3 (Iterate and parallelize)
Golden datasets drive iteration — eval failures become issues. Teams fix the analysis engine in parallel worktrees while adding new zones and improving alert templates. Quality gates block deployment if evals regress.

### Run 4 (Tune the autonomy slider)
Teams use alert thresholds to set autonomy levels: extreme alerts auto-send, considerable alerts need human review. The golden datasets verify these decisions are correct.

## zone-config.json

All 9 UAC forecast zones with:
- Zone IDs and coordinates for API queries
- SNOTEL station triplets for snowpack data
- API endpoint URLs for each zone

Note: Skyline and Moab have no nearby SNOTEL stations.

## multi-zone-snapshot.json

A complete data snapshot combining:
- **Forecast** — UAC native forecast for each zone (danger ratings, avalanche problems, discussions)
- **Weather** — NWS hourly weather forecast for each zone's coordinates
- **Snowpack** — SNOTEL readings where stations are available

This is a large file (~70KB+) because it contains the full API responses for all 9 zones across 3 data sources.

## Golden Datasets

Golden datasets live in [`data/shared/golden-datasets/`](../shared/golden-datasets/) — they're shared across tracks (used by both Black Diamond and Double Black Diamond).

Individual scenario files built from real forecast data. Each file contains:
- **Inputs** — the raw forecast, weather, and snowpack data
- **Expected outputs** — the forecaster's actual danger rating and avalanche problem assessment

The key insight: professional avalanche forecasters ARE avalanche scientists. Their assessments are the expert-verified "answers" teams test against. The 18 scenarios span UAC (Utah), CAIC (Colorado), NWAC (Pacific Northwest), and BTAC (Wyoming) — covering Low through Extreme danger with all 4 alert decision paths. See the [golden-datasets README](../shared/golden-datasets/README.md) for scenario details.

## alert-thresholds.json

Starting alert configuration:
- Danger levels 1-2: no alert
- Danger level 3 (Considerable): human review required
- Danger level 4 (High): auto-send
- Danger level 5 (Extreme): urgent auto-send

Plus escalation rules for multi-problem combinations, rapid changes, and data gaps. These are reasonable defaults — teams should iterate on them using eval results.

## Related

- [Shared reference data](../shared/) — danger scale, full zone list, SNOTEL stations
- [Green Circle data](../green-circle/) — single-zone data (Salt Lake) with the same API format
- [API documentation](../apis/) — endpoint details for live multi-zone ingestion
