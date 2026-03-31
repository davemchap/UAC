# Blue Square — Avalanche Observation Network Data

Pre-seeded data for the **Blue Square** track. Teams build a platform where backcountry travelers submit field observations — snowpack conditions, avalanche sightings, weather notes, and red flags.

## Files

| File | Description | Source |
|------|-------------|--------|
| [sample-observations.json](./sample-observations.json) | ~20 realistic field observations | Authored — modeled after real Utah Avalanche Center (UAC) public observations |
| [observation-types.json](./observation-types.json) | Taxonomy of observation types with field schemas | SWAG 4th Edition, UAC/CAIC submission forms |

## How Teams Use This Data

### Run 1 (Build the platform)
Teams use `sample-observations.json` as seed data — the observations feed, detail views, and filtering all work from day one without waiting for user submissions. `observation-types.json` defines the data model for the submission form.

### Run 2 (Add consistency with Skills)
Teams create Skills to enforce the data model defined in `observation-types.json` — consistent schemas, validated fields, standardized card layouts.

### Run 3 (Testing and deployment)
Teams write acceptance criteria against the observation schema. The sample data serves as test fixtures.

### Run 4 (API enrichment — stretch goal)
Teams can enrich observations with live data from Green Circle's APIs:
- Auto-tag observations with current danger rating (Utah Avalanche Center API)
- Auto-populate weather fields (NWS API)
- Compare user-submitted snowpack observations with SNOTEL instrument readings

## sample-observations.json

20 realistic observations spanning multiple types:
- **Avalanche** — sightings with type, trigger, size, and weak layer details
- **Snowpack** — structure and stability observations
- **Weather** — current conditions and travel reports
- **Red Flag** — signs of instability (shooting cracks, collapsing, wind loading, etc.)

Observations use real Wasatch locations, realistic coordinates, and language modeled after real UAC public observations.

## observation-types.json

Defines four observation types with required/optional fields and valid options for dropdowns. Derived from:
- SWAG 4th Edition (Snow, Weather, and Avalanches Guidelines, American Avalanche Association, 2022)
- UAC and CAIC public observation submission forms
- Simplified to public-facing fields (the full professional SWAG spec has dozens of additional fields)

## Related

- [Shared reference data](../shared/) — danger scale, zones, avalanche problem types
- [Green Circle data](../green-circle/) — API data that can enrich observations
- [API documentation](../apis/) — endpoint details for live enrichment
