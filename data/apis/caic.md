# Colorado Avalanche Information Center (CAIC) API

## Overview

The Colorado Avalanche Information Center (CAIC) publishes avalanche forecasts through the AVID (Avalanche Information Distribution) platform — the same backend that powers avalanche.org. However, CAIC's AVID data has a different structure from the avalanche.org public API's product detail endpoint, and the full forecast detail is only available through CAIC's AVID API proxy.

- **Base URL:** `https://avalanche.state.co.us/api-proxy/avid`
- **Auth:** None required
- **Format:** JSON (AVID format — camelCase, multi-day arrays)
- **Rate limits:** Not documented — this is a state government service. Be respectful.
- **Website:** https://avalanche.state.co.us

> **CRITICAL — READ-ONLY ACCESS ONLY**
>
> **The CAIC API accepts POST requests without authentication.** This means your application could accidentally create real observation records in CAIC's production database. This is a live system that publishes real avalanche safety data used by backcountry travelers to make life-or-death decisions.
>
> **Your application must NEVER send POST, PUT, PATCH, or DELETE requests to any CAIC endpoint.** Use only GET requests to read data. Build any submission forms or write operations against your own local database, never against CAIC's API.
>
> This constraint is non-negotiable. There is no test environment, no sandbox, no staging API. Every request hits production.

## Endpoints

### All Forecast Products

```
GET /api-proxy/avid?_api_proxy_uri=/products/all?avalanche_center_id=CAIC&page_size=20
```

Returns all current CAIC forecast products. Each product covers a group of polygons (geographic zones) and contains the full forecast with danger ratings, avalanche problems, summaries, and media.

**Full URL:**
```
https://avalanche.state.co.us/api-proxy/avid?_api_proxy_uri=/products/all?avalanche_center_id=CAIC&page_size=20
```

### Zone Boundaries (via avalanche.org)

```
GET https://api.avalanche.org/v2/public/products/map-layer/CAIC
```

Returns GeoJSON FeatureCollection of CAIC forecast zones with polygon geometry. Note: zone names in this endpoint all show as "CAIC zone" — the human-readable zone names are not exposed through this API.

## Response Structure

### Forecast Product (abbreviated)

```json
{
  "id": "04fb804b-082c-4277-9bf1-428ee8cb1643",
  "publicName": "21-24-38-39-9",
  "type": "avalancheforecast",
  "polygons": ["UUID-1", "UUID-2", "..."],
  "areaId": "hash-string",
  "forecaster": "Andrew McWilliams",
  "issueDateTime": "2026-03-05T23:30:00Z",
  "expiryDateTime": "2026-03-06T23:30:00Z",
  "timezone": "America/Denver",
  "dangerRatings": {
    "days": [
      {
        "position": 1,
        "alp": "considerable",
        "tln": "considerable",
        "btl": "moderate",
        "date": "2026-03-06T23:30:00Z"
      },
      { "position": 2, "...": "..." },
      { "position": 3, "...": "..." }
    ]
  },
  "avalancheProblems": {
    "days": [
      [
        {
          "type": "windSlab",
          "aspectElevations": ["s_alp", "nw_alp", "w_tln", "sw_tln", "e_alp", "e_tln"],
          "likelihood": "likely",
          "expectedSize": { "min": "1.0", "max": "2.0" }
        }
      ],
      ["...day 2 problems..."],
      ["...day 3 problems..."]
    ]
  },
  "avalancheSummary": {
    "days": [
      {
        "date": "2026-03-06T23:30:00Z",
        "content": "<p>HTML forecast discussion</p>"
      }
    ]
  },
  "weatherSummary": { "days": [] },
  "snowpackSummary": { "days": [] },
  "terrainAndTravelAdvice": { "days": [[], [], []] },
  "media": {
    "Images": [
      {
        "id": "uuid",
        "url": "http://res.cloudinary.com/...",
        "caption": "<p>Image description</p>",
        "tag": "avalanche",
        "altText": "Alt text"
      }
    ]
  }
}
```

## Key Format Characteristics

### Multi-Day Forecast Arrays

CAIC provides 3-day forecasts. Danger ratings, avalanche problems, and summaries are organized as arrays indexed by day:

```json
"dangerRatings": {
  "days": [
    { "position": 1, "alp": "considerable", "tln": "moderate", "btl": "low" },
    { "position": 2, "alp": "moderate",     "tln": "moderate", "btl": "low" },
    { "position": 3, "alp": "low",          "tln": "low",      "btl": "low" }
  ]
}
```

Use `days[0]` for the current day's forecast.

### Compound `aspectElevation` Strings

Aspects and elevation bands are combined into single strings: `"{aspect}_{elevation}"`.

```json
"aspectElevations": ["s_alp", "nw_alp", "w_tln", "sw_tln", "se_alp", "se_tln", "e_alp", "e_tln"]
```

- Aspect prefix: `n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw`
- Elevation suffix: `alp` (alpine), `tln` (treeline), `btl` (below treeline)
- Split on `_` to extract aspect and elevation separately

### Polygon-Based Zones

CAIC groups smaller geographic polygons into forecast zones dynamically. The `publicName` field contains polygon ID numbers (e.g. `"21-24-38-39-9"`), and `polygons` contains an array of UUID polygon identifiers. There are no human-readable zone names in the API — zone names (like "Front Range" or "Vail & Summit County") are only available on the CAIC website.

### Naming Conventions

- camelCase field names: `issueDateTime`, `dangerRatings`, `expectedSize`, `avalancheProblems`
- Problem types as camelCase: `"windSlab"`, `"persistentSlab"`, `"stormSlab"`
- Danger ratings as lowercase strings: `"considerable"`, `"moderate"`, `"low"`, `"noRating"`, `"noForecast"`
- Elevation bands abbreviated: `"alp"` (alpine), `"tln"` (treeline), `"btl"` (below treeline)

### Danger Rating Values

| String | Danger Level | Name |
|--------|-------------|------|
| `"noRating"` | 0 | No Rating |
| `"noForecast"` | 0 | No Forecast |
| `"low"` | 1 | Low |
| `"moderate"` | 2 | Moderate |
| `"considerable"` | 3 | Considerable |
| `"high"` | 4 | High |
| `"extreme"` | 5 | Extreme |

### Content Format

- HTML in narrative fields (`avalancheSummary.days[].content`, `weatherSummary.days[].content`)
- ISO 8601 dates in UTC
- UUID identifiers
- Media uses Cloudinary URLs
- Weather and snowpack summary fields are **often empty** — CAIC forecasters typically consolidate information into the avalanche summary

## Problem Type Name Mapping

| CAIC | Standard (avalanche.org) |
|------|------------------------|
| `windSlab` | Wind Slab |
| `stormSlab` | Storm Slab |
| `persistentSlab` | Persistent Slab |
| `deepPersistentSlab` | Deep Persistent Slab |
| `wetLoose` | Wet Loose |
| `wetSlab` | Wet Slab |
| `corniceFall` | Cornice Fall |
| `dryLoose` | Dry Loose |

## Observation Reports Endpoint

```
GET https://api.avalanche.state.co.us/api/v2/observation_reports
```

Returns community-submitted field observation reports. Each report can contain avalanche observations, weather observations, snowpack observations, and photo assets.

**Parameters:**

| Parameter | Description | Example |
|---|---|---|
| `page` | Page number (1-indexed) | `1` |
| `per` | Results per page | `10` |
| `obs_date_min` | Earliest observation date (YYYY-MM-DD) | `2026-03-01` |
| `obs_date_max` | Latest observation date (YYYY-MM-DD) | `2026-03-13` |

**Example:**
```
https://api.avalanche.state.co.us/api/v2/observation_reports?page=1&per=10&obs_date_min=2026-03-06&obs_date_max=2026-03-13
```

### Observation Report Structure (abbreviated)

```json
{
  "id": "6f331e5c-97a6-409c-8953-4ee6541ff50c",
  "type": "observation_report",
  "backcountry_zone": {
    "slug": "sawatch",
    "title": "Sawatch"
  },
  "observed_at": "2026-03-13T12:00:00.000Z",
  "latitude": 39.3267372,
  "longitude": -106.2660333,
  "description": "Witnessed the after of an avalanche...",
  "route": "Followed the unmaintained trail up past Sangrees Hut.",
  "saw_avalanche": true,
  "triggered_avalanche": false,
  "caught_in_avalanche": false,
  "full_name": "Joey Tripple",
  "state": "CO",
  "status": "approved",
  "avalanche_observations_count": 1,
  "avalanche_observations": [
    {
      "type": "avalanche_observation",
      "observed_at": "2026-03-08T18:00:00Z",
      "latitude": 39.3267372,
      "longitude": -106.2660333,
      "type_code": "U",
      "problem_type": "Unknown",
      "aspect": "E",
      "elevation": "&#62;TL",
      "relative_size": "R2",
      "destructive_size": "D1",
      "primary_trigger": "N"
    }
  ],
  "weather_observations_count": 0,
  "weather_observations": [],
  "snowpack_observations_count": 1,
  "snowpack_observations": [
    {
      "type": "snowpack_observation",
      "observed_at": "2026-03-13T18:00:00Z",
      "cracking": "None",
      "collapsing": "None"
    }
  ],
  "assets_count": 1,
  "assets": [
    {
      "type": "image_asset",
      "caption": "",
      "full_url": "https://res.cloudinary.com/...",
      "thumb_url": "https://res.cloudinary.com/..."
    }
  ]
}
```

### Observation Report Key Fields

The response is an array of observation reports. Each report is a container that groups related sub-observations:

- **Top level:** Observer info, GPS, zone, date, route, description, and boolean flags (`saw_avalanche`, `triggered_avalanche`, `caught_in_avalanche`)
- **`avalanche_observations[]`:** Detailed avalanche sighting data with 50+ fields (type code, problem type, aspect, elevation, trigger, size, crown/slab/bed surface details, slope characteristics)
- **`weather_observations[]`:** Weather conditions at the time/location
- **`snowpack_observations[]`:** Snowpack stability indicators (cracking, collapsing, weak layers)
- **`assets[]`:** Photos with Cloudinary URLs (full, reduced, thumbnail sizes)

Many fields in the avalanche observation sub-objects are `null` for any given report. This is normal: observers fill in what they can. The sparsity is realistic and mirrors the submission friction problem described in the Blue Square challenge.

### Observation-Specific Format Notes

- **Elevation encoding:** HTML entities in strings (e.g., `"&#62;TL"` means `">TL"`, above treeline)
- **Size scales:** `R1`-`R5` (relative size), `D1`-`D5` (destructive size)
- **Trigger codes:** `N` (natural), `AS` (skier), `AR` (snowboarder), `AM` (snowmobile), `AE` (explosive), `AF` (foot)
- **Type codes:** `SS` (soft slab), `HS` (hard slab), `WS` (wet slab), `L` (loose), `WL` (wet loose), `U` (unknown)
- **Zone data:** Deeply nested `backcountry_zone` objects are repeated in every sub-observation (redundant with the top-level zone)

## Workshop Notes

- This API is used exclusively by the **Double Black Diamond** track for the multi-center integration challenge
- The AVID format with compound `aspectElevation` strings and multi-day arrays contrasts with the flat Utah Avalanche Center (UAC) Native format — this contrast IS the learning objective
- Pre-seeded forecast data is available in `../double-black-diamond/center-a-caic/forecast.json`
- Pre-seeded observation data is available in `../double-black-diamond/center-a-caic/observations.json` (10 recent reports)
- CAIC publishes through the AVID platform (the same backend as avalanche.org) — but the full forecast detail is only available through the AVID proxy endpoint, not through avalanche.org's public product detail API
- The observation reports endpoint is separate from the AVID forecast system and uses a different base URL (`api.avalanche.state.co.us` vs `avalanche.state.co.us/api-proxy/avid`)
