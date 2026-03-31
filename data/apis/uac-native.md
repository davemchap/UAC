# Utah Avalanche Center (UAC) Native Forecast API

## Overview

The Utah Avalanche Center (UAC) publishes forecasts through their own website in a native JSON format. This is distinct from the avalanche.org unified API — the UAC native format has a flat structure with unique encoding patterns (CSV danger roses, numbered problem fields, plain text content).

- **Base URL:** `https://utahavalanchecenter.org/forecast/`
- **Auth:** None required
- **Format:** JSON
- **Rate limits:** Not documented — behind Cloudflare protection
- **Website:** https://utahavalanchecenter.org

> **READ-ONLY ACCESS ONLY.** Your application must NEVER send POST, PUT, PATCH, or DELETE requests to UAC endpoints. Use only GET requests. Build submission forms against your own local database, never against live APIs. See the [API README](./README.md) for details.

## Endpoint

```
GET /forecast/{region}/json
```

Returns the current avalanche forecast for a specific UAC region.

### Regions

| Region Slug | Name |
|-------------|------|
| `salt-lake` | Salt Lake |
| `ogden` | Ogden |
| `provo` | Provo |
| `logan` | Logan |
| `uintas` | Uintas |
| `skyline` | Skyline |
| `moab` | Moab |

### Example Call

```
GET /forecast/salt-lake/json
```

### Response Structure

The response wraps the forecast in an `advisories` array:

```json
{
  "advisories": [
    {
      "advisory": {
        "date_issued": "Friday, March 6, 2026 - 7:10am",
        "date_issued_timestamp": "1772806250",
        "overall_danger_rating": "Considerable",
        "overall_danger_rose": "6,6,6,6,6,6,6,6,4,4,4,4,4,4,4,4,2,2,2,2,2,2,2,2",
        "avalanche_problem_1": "Storm Slab",
        "avalanche_problem_1_description": "Plain text description...",
        "danger_rose_1": "...",
        "avalanche_problem_2": "Wind Drifted Snow",
        "avalanche_problem_2_description": "...",
        "danger_rose_2": "...",
        "avalanche_problem_3": "Persistent Weak Layer",
        "avalanche_problem_3_description": "...",
        "danger_rose_3": "...",
        "bottom_line": "Plain text summary",
        "current_conditions": "Plain text with weather data",
        "mountain_weather": "Plain text forecast",
        "recent_activity": "Plain text recent avalanche observations",
        "region": "Salt Lake",
        "Nid": "102393"
      }
    }
  ]
}
```

## Key Format Characteristics

### Danger Rose Encoding

The danger rose is a CSV string of 24 integers representing danger levels across 8 aspects × 3 elevation bands:

```
"6,6,6,6,6,6,6,6,4,4,4,4,4,4,4,4,2,2,2,2,2,2,2,2"
 └─ positions 1-8 ─┘ └─ positions 9-16 ┘ └─ positions 17-24 ┘
    Above Treeline      Near Treeline        Below Treeline
```

Values use a different scale than the 1-5 danger scale:
- 2 = Low
- 4 = Moderate
- 6 = Considerable
- 8 = High
- 10 = Extreme

Positions within each elevation band map to aspects: N, NE, E, SE, S, SW, W, NW.

### Avalanche Problem Fields

Problems are numbered fields instead of an array:
- `avalanche_problem_1`, `avalanche_problem_1_description`, `danger_rose_1`
- `avalanche_problem_2`, `avalanche_problem_2_description`, `danger_rose_2`
- `avalanche_problem_3`, `avalanche_problem_3_description`, `danger_rose_3`

### Problem Type Names

UAC Native uses different names than the standard avalanche.org taxonomy:

| UAC Native | Standard (avalanche.org) |
|------------|------------------------|
| Wind Drifted Snow | Wind Slab |
| New Snow | Storm Slab |
| Persistent Weak Layer | Persistent Slab |

### Content Format

- All text content is plain text with `\r` linebreaks
- Some fields contain embedded HTML tags (like `<img>` for danger rose images)
- The `&nbsp;` entity appears in some text fields

### Date Format

- `date_issued`: Human-readable string like `"Friday, March 6, 2026 - 7:10am"`
- `date_issued_timestamp`: Unix timestamp as a **string** (not integer)

### Identifiers

- `Nid`: Integer node ID as a string
- `region`: Human-readable region name

## Observation List Endpoint

```
GET /observations/all/json
```

Returns all current observations as an array of observation summaries. Unlike the CAIC observation API (which returns richly structured reports with 50+ fields per sub-observation), the UAC observation list provides only basic metadata per entry.

**Full URL:**
```
https://utahavalanchecenter.org/observations/all/json
```

**No parameters.** Returns all recent observations (currently ~25 at a time).

### Response Structure

The response wraps observations in an `observations` array, each containing an `observation` object:

```json
{
  "observations": [
    {
      "observation": {
        "state_region": "Salt Lake",
        "region": "Brighton Perimeter",
        "occurence_date": "3/13/2026",
        "type": "Observation: Brighton Perimeter",
        "name": "Maushund & Champion",
        "details": "https://utahavalanchecenter.org/observation/102905",
        "coordinates": "-111.5647713712,40.59533379206"
      }
    }
  ]
}
```

### Observation List Key Fields

| Field | Description | Example |
|---|---|---|
| `state_region` | UAC forecast zone name | `"Salt Lake"` |
| `region` | Specific location/peak name | `"Brighton Perimeter"` |
| `occurence_date` | Observation date as M/D/YYYY | `"3/13/2026"` |
| `type` | Type prefix + location name | `"Observation: Brighton Perimeter"` or `"Avalanche:  Bonkers"` |
| `name` | Observer name(s) | `"Maushund & Champion"` |
| `details` | URL to full observation page | `"https://utahavalanchecenter.org/observation/102905"` |
| `coordinates` | Longitude,latitude as a string | `"-111.5647713712,40.59533379206"` |

### Observation-Specific Format Notes

- **Coordinate order is longitude,latitude** (not the typical latitude,longitude). Split on `,` and swap to get standard lat/lng.
- **`type` field encodes the observation kind**: starts with `"Observation:"` for general field reports or `"Avalanche:"` for avalanche sightings. Note the double space in `"Avalanche:  "` (two spaces before the location name).
- **Date format** is `M/D/YYYY` (no zero-padding, US order), unlike the forecast endpoint's human-readable string format.
- **`coordinates` may be missing** on some observations.
- **Individual observation detail pages** (the `details` URL) return full HTML pages, not JSON. There is no JSON endpoint for individual observation details. The list endpoint provides all the structured data available via the API.

### Contrast with CAIC Observations

This format asymmetry is a key part of the Double Black Diamond integration challenge:

| Aspect | CAIC | UAC Native |
|---|---|---|
| Fields per observation | 50+ (structured sub-observations) | 7 (flat summary) |
| Sub-observation types | Avalanche, weather, snowpack (separate arrays) | None (single flat object) |
| GPS format | Separate `latitude`/`longitude` float fields | Single `coordinates` string (lng,lat) |
| Date format | ISO 8601 UTC | M/D/YYYY |
| Photos | Cloudinary URLs with metadata | Not available in API |
| Detail level | Complete: trigger type, size, aspect, elevation, crown, slab, bed surface... | Summary only: zone, location, date, observer |
| Observation types | Typed sub-arrays (avalanche_observations, weather_observations, snowpack_observations) | Encoded in `type` field prefix ("Observation:" vs "Avalanche:") |

## Workshop Notes

- This is the primary source for full UAC forecast data — the avalanche.org product detail endpoint returns empty fields for UAC
- Pre-seeded forecast data is available in `../double-black-diamond/center-b-uac-native/`
- Pre-seeded observation data is available in `../double-black-diamond/center-b-uac-native/observations.json` (25 recent observations)
- The flat structure and CSV encoding make this format a good contrast with the CAIC's AVID format (camelCase, multi-day arrays, compound `aspectElevation` strings) for the Double Black Diamond integration challenge
- The observation data asymmetry (CAIC: rich structured JSON vs UAC: sparse list) mirrors a real-world integration problem — not all centers expose the same depth of data
