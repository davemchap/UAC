# Shared Reference Data

Reference data used across all tracks. These files contain authoritative standards and location metadata — they don't change between tracks.

## Files

| File | Description | Source |
|------|-------------|--------|
| [zones.json](./zones.json) | All Utah Avalanche Center (UAC) forecast zones with IDs, names, danger levels, and coordinates | Live API: `api.avalanche.org/v2/public/products/map-layer/UAC` |
| [avalanche-reference.json](./avalanche-reference.json) | North American Avalanche Danger Scale, problem types, trigger codes, size scales | NAPADS, avalanche.org, SWAG 4th Edition |
| [snotel-stations.json](./snotel-stations.json) | Wasatch-area SNOTEL stations with triplet IDs, coordinates, and elevations | NRCS SNOTEL network |
| [golden-datasets/](./golden-datasets/) | 18 real forecast scenarios with expert-verified expected outputs, covering all 5 danger levels from 4 US avalanche centers | Live API data with forecaster assessments |

## zones.json

UAC forecast zones. Each zone has:
- `zone_id` — unique identifier used in API calls
- `name` — human-readable zone name
- `slug` — URL-friendly name for the UAC native API
- `danger_level` — current danger rating (1-5, or -1 for no rating)
- `danger_name` — current danger name (low, moderate, considerable, high, extreme)
- `travel_advice` — current travel advice text

## avalanche-reference.json

Authoritative reference data for avalanche science terminology:
- `danger_scale` — 5 levels with official colors and travel advice
- `avalanche_problems` — 9 standard problem types
- `aspects` — 8 cardinal/intercardinal directions
- `elevation_bands` — Above Treeline, Near Treeline, Below Treeline
- `trigger_codes` — How avalanches are triggered
- `size_destructive` — D1 through D5 destructive size scale

## snotel-stations.json

SNOTEL station reference for Wasatch-area stations. Use station triplets when calling the SNOTEL API. See [SNOTEL API documentation](../apis/snotel.md) for endpoint details.

## golden-datasets/

Evaluation scenarios built from real forecast data across 4 US avalanche centers. Each scenario pairs raw inputs (forecast + weather + snowpack) with the forecaster's expert-verified expected outputs (danger rating, avalanche problems, alert decision). Used by Black Diamond for eval harnesses and by Double Black Diamond for cross-center evaluation.

The 18 scenarios span UAC (Utah), CAIC (Colorado), NWAC (Pacific Northwest), and BTAC (Wyoming) — covering Low through Extreme danger with all 4 alert decision paths. See the [golden-datasets README](./golden-datasets/README.md) for scenario details.
