# Field Mapping Reference

> The Rosetta Stone for normalizing Colorado Avalanche Information Center (CAIC) and Utah Avalanche Center (UAC) Native data into the unified schema.

## Why This Is Hard

Both CAIC and UAC publish avalanche forecasts, but their native APIs use completely different structures, field names, and encoding strategies. This is not a contrived exercise — these are the actual formats used by real avalanche centers. The challenge mirrors what [avalanche.org](https://avalanche.org) has already solved: unifying data from dozens of independent centers into a single national view. Your job is to build that normalization layer for Colorado and Utah.

## Side-by-Side Field Mapping

| Unified Schema | CAIC (Center A) | UAC Native (Center B) |
|---|---|---|
| `id` | `[i].id` (UUID string) | `advisories[0].advisory.Nid` |
| `source_center` | Hardcode `"CAIC"` | Hardcode `"UAC"` |
| `source_region` | `[i].areaId` (hash) — no human name in API; join with `zones.json` for geometry | `advisories[0].advisory.region` (e.g. `"Salt Lake"`) |
| `issued_at` | `[i].issueDateTime` (ISO 8601 UTC) | `advisories[0].advisory.date_issued` (human string) + `date_issued_timestamp` (Unix epoch string) |
| `valid_until` | `[i].expiryDateTime` (ISO 8601 UTC) | Not provided — must be inferred or omitted |
| `overall_danger.rating` | Derive from `dangerRatings.days[0]` — take the max of `alp`, `tln`, `btl` strings | Decode `overall_danger_rose` CSV — take the max value and divide by 2 |
| `overall_danger.name` | Map string enum (see Danger Rating Encoding below) | `advisories[0].advisory.overall_danger_rating` (e.g. `"Considerable"`) |
| `danger_by_elevation.above_treeline` | `dangerRatings.days[0].alp` (lowercase string) | `overall_danger_rose` positions 0-7 (upper elevation band) |
| `danger_by_elevation.near_treeline` | `dangerRatings.days[0].tln` (lowercase string) | `overall_danger_rose` positions 8-15 (mid elevation band) |
| `danger_by_elevation.below_treeline` | `dangerRatings.days[0].btl` (lowercase string) | `overall_danger_rose` positions 16-23 (lower elevation band) |
| `avalanche_problems[].type` | `avalancheProblems.days[0][i].type` (see Problem Type Mapping) | `advisory.avalanche_problem_N` (see Problem Type Mapping) |
| `avalanche_problems[].likelihood` | `avalancheProblems.days[0][i].likelihood` (lowercase string) | Not provided as a separate field — embedded in description text |
| `avalanche_problems[].aspects` | Decode from `avalancheProblems.days[0][i].aspectElevations` — extract aspect prefix (see Aspect/Elevation Decoding) | Decode from `danger_rose_N` CSV positions (see Danger Rose Decoding) |
| `avalanche_problems[].elevation_bands` | Decode from `avalancheProblems.days[0][i].aspectElevations` — extract elevation suffix | Decode from `danger_rose_N` CSV position groups |
| `avalanche_problems[].size` | `avalancheProblems.days[0][i].expectedSize` (`{min, max}` as strings) | Not provided as structured data |
| `avalanche_problems[].description` | `avalancheSummary.days[0].content` (HTML — must strip tags) | `advisory.avalanche_problem_N_description` (HTML — must strip tags) |
| `confidence` | Not provided | Not provided |
| `bottom_line` | `avalancheSummary.days[0].content` (HTML — must strip tags) | `advisory.bottom_line` (HTML — must strip tags) |
| `weather_summary` | `weatherSummary.days[0].content` (HTML — often empty) | `advisory.mountain_weather` (HTML, often sparse) + `advisory.current_conditions` (HTML) |
| `snowpack_summary` | `snowpackSummary.days[0].content` (HTML — often empty) | Embedded in problem descriptions — no dedicated field |
| `terrain_and_travel_advice` | `terrainAndTravelAdvice.days[0]` (array of strings — often empty) | Embedded in `bottom_line` |

## Tricky Transformations

### 1. Compound `aspectElevation` String Decoding (CAIC)

CAIC encodes aspect and elevation as a single compound string: `"{aspect}_{elevation}"`. You must split on `_` to extract both values.

```json
// Source (CAIC)
"aspectElevations": ["s_alp", "nw_alp", "w_tln", "sw_tln", "e_alp", "e_tln"]

// Step 1: Split each string on "_"
// "s_alp"  → aspect: "s",  elevation: "alp"
// "nw_alp" → aspect: "nw", elevation: "alp"
// "w_tln"  → aspect: "w",  elevation: "tln"

// Step 2: Collect unique aspects and elevations
// aspects:    ["s", "nw", "w", "sw", "e"]
// elevations: ["alp", "tln"]

// Step 3: Normalize to unified format
// aspects:         ["S", "NW", "W", "SW", "E"]
// elevation_bands: ["above_treeline", "near_treeline"]
```

This is fundamentally different from UAC's approach, where aspects and elevations are encoded in the *positional index* of a 24-integer CSV string. The CAIC approach is explicit but requires string parsing; the UAC approach is implicit and requires positional decoding.

### 2. HTML to Plain Text Conversion

Both centers embed HTML in text fields. CAIC uses `<p>`, `<a>`, `<strong>` tags. UAC Native uses `&nbsp;`, `\r` for line breaks, and occasionally `<img>` tags.

```
// CAIC source
"<p>Look for and avoid areas of drifted snow on steep slopes.</p>"

// UAC Native source
"A CONSIDERABLE&nbsp;avalanche danger exists on upper elevation slopes...\r\r"

// Unified target
"Look for and avoid areas of drifted snow on steep slopes."
"A CONSIDERABLE avalanche danger exists on upper elevation slopes..."
```

Strip all HTML tags, decode HTML entities (`&nbsp;` to space, `&amp;` to `&`), and collapse `\r` sequences into single newlines.

### 3. Danger Rose CSV Decoding (UAC Native)

UAC encodes danger information as 24-integer CSV strings. The 24 positions represent 8 compass aspects at 3 elevation bands.

**Layout: 8 aspects x 3 elevations = 24 values**

```
Positions  0-7:  Upper elevation (above treeline) — N, NE, E, SE, S, SW, W, NW
Positions  8-15: Mid elevation (near treeline)    — N, NE, E, SE, S, SW, W, NW
Positions 16-23: Lower elevation (below treeline) — N, NE, E, SE, S, SW, W, NW
```

**`overall_danger_rose` value mapping (even integers):**

| CSV Value | Danger Rating | Name |
|---|---|---|
| 0 | 0 | No Rating |
| 2 | 1 | Low |
| 4 | 2 | Moderate |
| 6 | 3 | Considerable |
| 8 | 4 | High |
| 10 | 5 | Extreme |

To get the integer danger rating: divide the CSV value by 2.

**Per-problem danger roses (`danger_rose_1`, `danger_rose_2`, `danger_rose_3`):**

These use a different encoding that indicates whether the problem is present at each aspect/elevation cell:

| CSV Value | Meaning |
|---|---|
| 14 | Problem NOT present at this aspect/elevation |
| 16 | Problem IS present at this aspect/elevation |

To extract aspects and elevations for a problem, find all positions with value `16` and map them back to the aspect/elevation grid above.

**Example decoding:**

```
danger_rose_1: "16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,14,14,14,14,14,14,14,14"

Upper elevation (positions 0-7):  all 16 → problem present on N,NE,E,SE,S,SW,W,NW
Mid elevation (positions 8-15):   all 16 → problem present on N,NE,E,SE,S,SW,W,NW
Lower elevation (positions 16-23): all 14 → problem NOT present at any aspect

Result:
  elevation_bands: ["above_treeline", "near_treeline"]
  aspects: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
```

### 4. Aspect Value Normalization

CAIC uses lowercase aspect prefixes in compound strings; UAC uses positional decoding from danger roses. Both must normalize to uppercase.

```
CAIC:       "s_alp" → split → "s"  → uppercase → "S"
            "nw_tln" → split → "nw" → uppercase → "NW"
UAC Native: decoded from danger rose position (ordinal index)
Unified:    "N", "NE", "E", "SE", "S", "SW", "W", "NW"
```

### 5. Elevation Band Normalization

| Unified | CAIC (suffix in compound strings) | UAC Native (danger rose position group) |
|---|---|---|
| `above_treeline` | `"alp"` (Alpine) | Positions 0-7 |
| `near_treeline` | `"tln"` (Treeline) | Positions 8-15 |
| `below_treeline` | `"btl"` (Below Treeline) | Positions 16-23 |

### 6. Multi-Day vs. Single-Day Forecasts

CAIC provides 3-day forecasts in arrays indexed by day (`days[0]`, `days[1]`, `days[2]`). UAC provides only the current day's forecast. For the unified schema, use only the current day:

```
// CAIC: take days[0] for current day
"dangerRatings": {
  "days": [
    { "position": 1, "alp": "considerable", ... },  // ← use this
    { "position": 2, "alp": "moderate", ... },
    { "position": 3, "alp": "low", ... }
  ]
}

// UAC Native: only provides single day (no selection needed)
"overall_danger_rating": "Considerable"
```

## Problem Type Name Mapping

Each center uses different names for the same avalanche problem types. The unified schema uses the standardized names from the avalanche.org taxonomy.

| Unified Schema | CAIC `type` value | UAC Native `avalanche_problem_N` |
|---|---|---|
| Wind Slab | `windSlab` | Wind Drifted Snow |
| Storm Slab | `stormSlab` | New Snow |
| Persistent Slab | `persistentSlab` | Persistent Weak Layer |
| Wet Loose | `wetLoose`* | Wet Loose* |
| Deep Persistent Slab | `deepPersistentSlab`* | Deep Persistent Weak Layer* |
| Wet Slab | `wetSlab`* | Wet Snow* |
| Dry Loose | `dryLoose`* | Dry Loose* |
| Cornice Fall | `corniceFall`* | Cornice Fall* |
| Glide Avalanche | `glide`* | Glide Avalanche* |

\* These types do not appear in the current dataset but are part of the full taxonomy and may appear in other forecasts.

## Date Format Normalization

### CAIC

ISO 8601 format in UTC:

```
"issueDateTime": "2026-03-05T23:30:00Z"
"expiryDateTime": "2026-03-06T23:30:00Z"
```

To convert: parse as UTC, then render with timezone offset if needed. CAIC uses `America/Denver` timezone (provided in the `timezone` field).

### UAC Native

Human-readable string plus a Unix timestamp as a string:

```
"date_issued": "Friday, March 6, 2026 - 7:10am"
"date_issued_timestamp": "1772806250"
```

- The `date_issued` string is in local time (Mountain Time, UTC-7 in MST / UTC-6 in MDT).
- The `date_issued_timestamp` is a Unix epoch in seconds, stored as a **string** — must be parsed to integer first.
- There is no `valid_until` equivalent. If needed, teams may assume a 24-hour validity window.

To convert: use the Unix timestamp (`parseInt(date_issued_timestamp) * 1000` for JS) and format as ISO 8601 with timezone offset.

### Unified Schema

ISO 8601 with explicit timezone offset:

```
"issued_at": "2026-03-06T07:10:00-07:00"
"valid_until": "2026-03-07T07:10:00-07:00"
```

## Danger Rating Encoding

### CAIC

Plain lowercase strings per elevation band, nested under `dangerRatings.days[]`:

```json
"dangerRatings": {
  "days": [
    {
      "position": 1,
      "alp": "considerable",
      "tln": "considerable",
      "btl": "moderate",
      "date": "2026-03-06T23:30:00Z"
    }
  ]
}
```

**Value to integer mapping:**

| `dangerRatings` string | Integer | Name |
|---|---|---|
| `"noRating"` | 0 | No Rating |
| `"noForecast"` | 0 | No Forecast |
| `"low"` | 1 | Low |
| `"moderate"` | 2 | Moderate |
| `"considerable"` | 3 | Considerable |
| `"high"` | 4 | High |
| `"extreme"` | 5 | Extreme |

Note: `dangerRatings.days` is an **array** with one entry per forecast day (typically 3 days). Use index `[0]` for the current day.

### UAC Native

A single `overall_danger_rating` string plus a 24-integer CSV `overall_danger_rose`:

```json
"overall_danger_rating": "Considerable",
"overall_danger_rose": "6,6,6,6,6,6,6,6,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4"
```

- The `overall_danger_rating` is already a title-case name (e.g. `"Considerable"`, `"Moderate"`).
- The `overall_danger_rose` encodes per-aspect, per-elevation danger as even integers (divide by 2 for the standard 0-5 scale).
- To derive the per-elevation rating for the unified schema, take the **max** value within each 8-position group, then divide by 2.

### Unified Schema

Simple integer + name + hex color:

```json
"overall_danger": {
  "rating": 3,
  "name": "Considerable",
  "color": "#F7941E"
}
```

**Standard NAPADS colors:**

| Rating | Name | Hex Color |
|---|---|---|
| 1 | Low | `#50B848` |
| 2 | Moderate | `#FFF200` |
| 3 | Considerable | `#F7941E` |
| 4 | High | `#ED1C24` |
| 5 | Extreme | `#1A1A1A` |

## Likelihood Normalization

### CAIC

Uses plain lowercase strings:

```
"likely"    → "Likely"
"possible"  → "Possible"
"unlikely"  → "Unlikely"
"veryLikely"→ "Very Likely"
```

Title-case and add a space before the capital letter for compound values.

### UAC Native

Likelihood is **not provided as a structured field**. It is sometimes mentioned within the problem description text (e.g. "Human-triggered avalanches are likely"). Teams may need to extract it via text parsing or omit it.

### Unified Schema

A single title-case string from the standard scale: `"Unlikely"`, `"Possible"`, `"Likely"`, `"Very Likely"`, `"Almost Certain"`.

## Quick Reference: What Each Center Provides vs. Does Not

| Data Element | CAIC | UAC Native |
|---|---|---|
| Structured danger by elevation | Yes (plain strings per band) | Yes (CSV danger rose) |
| Multi-day forecast | Yes (array of 3 days) | No (single day) |
| Valid until datetime | Yes (`expiryDateTime`) | No |
| Problem likelihood | Yes (plain string) | No (in prose only) |
| Problem size range | Yes (`expectedSize.min/max`) | No |
| Problem aspects | Yes (compound `aspectElevation` strings) | Yes (encoded in per-problem danger rose) |
| Problem elevations | Yes (compound `aspectElevation` strings) | Yes (encoded in per-problem danger rose) |
| Forecast confidence | No | No |
| Snowpack summary | Dedicated field (often sparse) | No (embedded in problem descriptions) |
| Weather summary | Dedicated field (often sparse) | Partial (`mountain_weather` + `current_conditions`) |
| Bottom line / highlights | Yes (`avalancheSummary`) | Yes (`bottom_line`) |
| Terrain advice | Yes (`terrainAndTravelAdvice` — often empty) | No (embedded in `bottom_line`) |
| Zone geometry (GeoJSON) | Yes (separate `zones.json` via avalanche.org) | No |
| Forecaster name | Yes (`forecaster`) | No |
| Zone names in API | No (polygon IDs only) | Yes (named regions) |
| Media/photos | Yes (`media.Images[]`) | No |
