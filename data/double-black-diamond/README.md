# Double Black Diamond — Multi-Center Avalanche Operations Platform Data

Pre-seeded data for the **Double Black Diamond** track. Teams build a platform that unifies avalanche operations across the Colorado Avalanche Information Center (CAIC) and the Utah Avalanche Center (UAC) into a coherent cross-center view.

## The Core Challenge

[Avalanche.org](https://avalanche.org) already aggregates data from dozens of independent US avalanche centers into a unified national view. But each center publishes through its own native API with a genuinely different format. Your job is to **re-engineer what avalanche.org does** — build the normalization layer that takes two centers' raw native data and unifies it into a single, consistent schema.

> **Why not just use avalanche.org's unified data?** Because avalanche.org's product detail API returns empty data for centers like UAC and CAIC that publish through their own systems. The zone-level summary (danger ratings, colors) is available, but the full forecast details — avalanche problems, discussions, terrain advice — require going to each center's native API. Building this normalization layer IS the challenge.

Each pair on the team gets data from a **different avalanche center with a genuinely different native API format**. When they try to unify, the integration pain is real — different field names, different nesting depth, different encoding strategies, different problem type terminology.

## Directory Structure

```
double-black-diamond/
├── center-a-caic/                ← Pair A works with this (Colorado)
│   ├── forecast.json             ← AVID format: camelCase, multi-day, compound aspectElevations
│   ├── observations.json         ← 10 richly structured observation reports (50+ fields each)
│   └── zones.json                ← GeoJSON forecast zones from avalanche.org
├── center-b-uac-native/          ← Pair B works with this (Utah)
│   ├── salt-lake.json            ← Flat structure, CSV danger roses
│   ├── ogden.json
│   ├── provo.json
│   └── observations.json         ← 25 sparse observation summaries (7 fields each)
├── unified-schema-target.json    ← The north star both pairs normalize toward
└── field-mapping-reference.md    ← Rosetta Stone for field name mapping
```

## How Teams Use This Data

### Run 1 (Build independently)
Each pair takes one center's data and builds their own ingestion pipeline, alerting rules, and dashboard. Everyone moves fast independently.
- **Pair A** uses `center-a-caic/` — AVID format with camelCase fields, multi-day forecast arrays, compound `aspectElevation` strings (e.g. `"s_alp"`, `"nw_tln"`), HTML content, polygon-based zones
- **Pair B** uses `center-b-uac-native/` — flat structure, CSV danger roses, numbered problem fields (`avalanche_problem_1`, `_2`, `_3`), human-readable dates, named zones

### Observation data (stretch goal)
Both centers have observation data pre-seeded, but in dramatically different formats. CAIC provides richly structured reports with typed sub-observations (avalanche, weather, snowpack) and 50+ fields per report. UAC provides a sparse list of observation summaries with only 7 fields each (zone, location, date, observer, coordinates, type, detail URL). Unifying these into a common observation schema is a real data integration challenge on top of the forecast unification.

### Run 2 (Design the shared stack)
Teams use `unified-schema-target.json` as the target format and `field-mapping-reference.md` to understand how fields map between sources. Build the normalization layer that maps both formats into the common schema. This is essentially what avalanche.org's backend does — you're building it from scratch.

### Run 3 (Build the factory)
Eval results feed back into skill refinement. Teams ensure both pipelines produce consistent unified output. Quality gates verify cross-center data integrity.

### Run 4 (The Disruptor's Mandate)
Frame the unified platform as a case for organizational change. How would you roll this out to a real avalanche center network? What would it take to add a third center (e.g., Northwest Avalanche Center)?

## Key Format Differences

| Aspect | CAIC (Colorado) | Utah Avalanche Center (UAC) Native |
|--------|-----------------|------------|
| API format | AVID (avalanche.org backend) | UAC proprietary |
| Case convention | camelCase | snake_case |
| Nesting depth | 4-5 levels (days arrays within objects) | 3 levels (nearly flat) |
| Danger rating | Plain lowercase strings per elevation band | Title-case string + 24-integer CSV |
| Problem structure | Array of arrays (days → problems) | Numbered fields (`_1`, `_2`, `_3`) |
| Aspect/elevation encoding | Compound strings: `"s_alp"`, `"nw_tln"` | Positional in 24-integer CSV |
| Problem names | `"windSlab"` (camelCase) | `"Wind Drifted Snow"` (title case) |
| Dates | ISO 8601 UTC | Human-readable + Unix timestamp string |
| Content | HTML | Plain text with `\r` and `&nbsp;` |
| Multi-day forecast | Yes (3 days) | No (single day) |
| Zone naming | Polygon IDs (no human names in API) | Fixed named zones |
| IDs | UUID strings | Integer node IDs |
| Observation detail | 50+ fields per report with typed sub-arrays (avalanche, weather, snowpack) | 7 fields: zone, location, date, name, coordinates, type, detail URL |
| Observation GPS | Separate `latitude`/`longitude` floats | Single `coordinates` string (lng,lat order) |
| Observation photos | Cloudinary URLs with full/reduced/thumb sizes | Not available via API |

See [field-mapping-reference.md](./field-mapping-reference.md) for the complete mapping.

## Related

- [Shared reference data](../shared/) — danger scale, zone list (the "standard" to normalize toward)
- [API documentation](../apis/) — CAIC and UAC Native API details
- [Black Diamond data](../black-diamond/) — multi-zone UAC data (same format as Center B, but all 9 zones)
