# Green Circle — Avalanche Field Guide Data

Pre-seeded data for the **Green Circle** track. Teams build a digital backcountry field guide for the Park City / Wasatch Range area (Utah Avalanche Center Salt Lake zone).

## Files

| File | Description | Source |
|------|-------------|--------|
| [avalanche-forecast.json](./avalanche-forecast.json) | Current Utah Avalanche Center (UAC) Salt Lake forecast | Live API: `utahavalanchecenter.org/forecast/salt-lake/json` |
| [weather.json](./weather.json) | Current Wasatch weather (hourly, ~7-day) | Live API: `api.weather.gov` (NWS) |
| [snotel-snowpack.json](./snotel-snowpack.json) | Recent snowpack readings from 4 Wasatch SNOTEL stations | Live API: NRCS AWDB |
| [reference.json](./reference.json) | Region-to-API-parameter mapping | Authored |

## How Teams Use This Data

### Run 1 (Chat prototype)
Teams build with mock/hardcoded data — these files aren't used yet.

### Run 2 (Connect to real data)
Teams wire their field guide to display real conditions. Start with pre-seeded files, then optionally connect to live APIs.

### Run 3 (Context-driven iteration)
With project context files in place, teams add ambitious features: snowpack data (from `snotel-snowpack.json`), historical conditions, printable trip briefings, adaptive gear checklists.

## Data Freshness

These snapshots were fetched on **2026-03-06**. For live data, use the API endpoints documented in [reference.json](./reference.json) and the [API documentation](../apis/).

## Related

- [Shared reference data](../shared/) — danger scale, zones, SNOTEL stations
- [API documentation](../apis/) — endpoint details and parameters
