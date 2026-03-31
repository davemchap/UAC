# National Weather Service (NWS) API

## Overview

The National Weather Service API provides official US government weather forecasts, observations, and alerts. Operated by NOAA. Completely free for any use — no API key, no rate limits, no commercial restrictions.

- **Base URL:** `https://api.weather.gov`
- **Auth:** None required
- **Format:** JSON (GeoJSON / JSON-LD)
- **Rate limits:** None documented — requests should include a `User-Agent` header with your app name and contact email
- **Docs:** https://www.weather.gov/documentation/services-web-api

> **READ-ONLY ACCESS ONLY.** Your application must NEVER send POST, PUT, PATCH, or DELETE requests to NWS endpoints. Use only GET requests. See the [API README](./README.md) for details.

## How It Works

The NWS API uses a two-step lookup. You can't query by coordinates directly — you first resolve coordinates to a grid point, then query that grid point for forecasts.

### Step 1: Resolve Coordinates to Grid Point

```
GET /points/{latitude},{longitude}
```

Returns the NWS office and grid coordinates for a location.

**Example:**

```
GET /points/40.65,-111.51
```

**Response (abbreviated):**

```json
{
  "properties": {
    "gridId": "SLC",
    "gridX": 97,
    "gridY": 162,
    "forecast": "https://api.weather.gov/gridpoints/SLC/97,162/forecast",
    "forecastHourly": "https://api.weather.gov/gridpoints/SLC/97,162/forecast/hourly",
    "observationStations": "https://api.weather.gov/gridpoints/SLC/97,162/stations"
  }
}
```

Cache this response — the grid point for a location doesn't change.

### Step 2: Get Forecast Data

#### Human-Readable Forecast (12-hour periods)

```
GET /gridpoints/{office}/{gridX},{gridY}/forecast
```

Returns 7-day forecast in 12-hour periods with plain-language descriptions.

**Example response (abbreviated):**

```json
{
  "properties": {
    "periods": [
      {
        "name": "Tonight",
        "temperature": 24,
        "temperatureUnit": "F",
        "windSpeed": "10 to 15 mph",
        "windDirection": "WSW",
        "shortForecast": "Chance Snow Showers",
        "detailedForecast": "A chance of snow showers. Mostly cloudy, with a low around 24. West southwest wind 10 to 15 mph.",
        "probabilityOfPrecipitation": { "value": 40 }
      }
    ]
  }
}
```

#### Hourly Forecast

```
GET /gridpoints/{office}/{gridX},{gridY}/forecast/hourly
```

Same structure as above but with 1-hour periods. This is the format used for all pre-seeded weather data in the workshop.

#### Raw Grid Data (Most Detail)

```
GET /gridpoints/{office}/{gridX},{gridY}
```

Returns all forecast data layers as time series. This is where you get the full set of variables:

| Variable | Description | Unit |
|----------|-------------|------|
| `temperature` | Air temperature | °F |
| `windSpeed` | Wind speed | mph |
| `windDirection` | Wind direction | degrees |
| `windGust` | Wind gust speed | mph |
| `probabilityOfPrecipitation` | Chance of precipitation | % |
| `quantitativePrecipitation` | Precipitation amount | inches |
| `snowfallAmount` | Snowfall amount | inches |
| `snowLevel` | Elevation where precip turns to snow | feet |
| `iceAccumulation` | Ice accumulation | inches |
| `skyCover` | Cloud coverage | % |
| `visibility` | Visibility | miles |
| `windChill` | Wind chill | °F |

The raw grid endpoint returns many more variables (50+) including fire weather indices, mixing heights, and wave data. The table above covers what's relevant for backcountry weather.

## Alerts

This is the NWS API's unique strength — no other weather API provides official NWS alerts.

```
GET /alerts/active?area=UT
```

Returns all active watches, warnings, and advisories for a state. Includes winter storm warnings, avalanche warnings (when issued by NWS), wind advisories, and more.

## Observations (Recent Weather)

To get actual observed conditions (not forecasts), find a nearby station and query its observations:

```
GET /gridpoints/{office}/{gridX},{gridY}/stations    → list of stations
GET /stations/{stationId}/observations/latest         → most recent observation
```

## Workshop Coordinates

The `/points` endpoint resolves workshop coordinates to NWS grid points:

| Location | Coordinates | NWS Office | Grid |
|----------|------------|------------|------|
| Salt Lake / Wasatch | 40.65, -111.51 | SLC | 113,169 |
| Ogden | 41.25, -111.80 | SLC | 106,197 |
| Provo | 40.35, -111.60 | SLC | 108,156 |
| Uintas | 40.70, -110.90 | SLC | 134,169 |
| Logan | 41.90, -111.50 | SLC | 120,225 |
| Skyline | 39.60, -111.30 | SLC | 114,121 |
| Moab | 38.70, -109.55 | GJT | 59,89 |

> **Note:** Grid coordinates were resolved via the `/points` endpoint on 2026-03-09. If NWS updates its gridding, re-resolve by calling `/points/{lat},{lon}` for each location.

## Mountain Weather Limitations

### The Elevation Gap

NWS forecasts are tied to grid cells approximately 2.5 km across. In mountainous terrain, each grid cell's elevation is a smoothed average that can sit thousands of feet below actual avalanche terrain. This means surface-level variables like `temperature`, `windSpeed`, and `windDirection` reflect conditions at the grid cell's effective elevation — not at ridgetop or starting zone elevations where avalanche problems develop.

| Location | Grid Cell Elevation | Typical Avalanche Terrain | Elevation Gap |
|----------|-------------------|--------------------------|---------------|
| Salt Lake / Wasatch | ~6,900 ft | 8,000–11,000 ft | 1,100–4,100 ft |
| Ogden | ~5,300 ft | 7,000–9,700 ft | 1,700–4,400 ft |
| Provo | ~5,700 ft | 8,000–11,750 ft | 2,300–6,050 ft |
| Uintas | ~9,200 ft | 10,000–13,500 ft | 800–4,300 ft |
| Logan | ~5,500 ft | 7,000–9,700 ft | 1,500–4,200 ft |
| Moab (La Sals) | ~5,200 ft | 9,000–12,700 ft | 3,800–7,500 ft |

Grid cell elevations are approximate — the NWS API returns an `elevation` field in the `/points` response that represents the grid cell's effective terrain height.

### What Still Works at Elevation

Not all NWS variables suffer equally from the elevation gap:

- **`snowfallAmount`** and **`quantitativePrecipitation`** — Precipitation forecasts are reasonably useful. NWS forecasters account for orographic lift in their grid edits, so snowfall amounts at mountain grid points are often closer to reality than temperature or wind.
- **`snowLevel`** — The elevation where precipitation transitions from rain to snow. This is one of the most valuable NWS variables for avalanche work because it directly tells you whether precipitation at a given elevation band is falling as rain or snow. A rain/snow boundary climbing through the snowpack is a significant avalanche concern.
- **`probabilityOfPrecipitation`** and **`skyCover`** — These are broad enough to be useful regardless of the elevation gap.
- **`transportWindSpeed`** and **`transportWindDirection`** — These represent winds in the atmospheric mixing layer, typically closer to ridgetop conditions than surface winds. Available in the raw grid endpoint (`/gridpoints/{office}/{gridX},{gridY}`) but NOT in the `/forecast` or `/forecast/hourly` endpoints. These are the closest NWS proxy for the ridgetop winds that load avalanche starting zones.

### What's Unreliable at Elevation

- **`temperature`** — Surface temperature at the grid cell elevation. Expect conditions in avalanche terrain to be 5–15°F colder depending on the elevation gap. Temperatures near or above freezing at the grid cell may still mean well-below-freezing conditions at ridgetop.
- **`windSpeed`** and **`windDirection`** — Surface winds at the grid cell. Mountain ridgetops and exposed terrain experience dramatically different wind patterns. Use `transportWindSpeed`/`transportWindDirection` from the raw grid endpoint as a better (though imperfect) proxy.
- **`windChill`** — Derived from surface temperature and wind speed, so inherits both problems.

### Practical Guidance for Workshop Teams

NWS weather data is a useful starting point — it's free, official, and provides precipitation forecasts that account for mountain effects. But teams should understand the limitations:

1. **Pair NWS with SNOTEL** — [SNOTEL stations](./snotel.md) sit at elevation in avalanche terrain and provide ground-truth temperature, snow depth, and snow water equivalent. NWS gives you the forecast; SNOTEL gives you what actually happened.
2. **Use `snowLevel` and `transportWind` variables** — These are the most avalanche-relevant NWS variables and are less affected by the elevation gap.
3. **Treat temperature and wind as valley-floor proxies** — Useful for context, but not representative of conditions where avalanches release.
4. **Consider higher-elevation coordinates** — For tracks that fetch live NWS data, querying coordinates further up-canyon or on the mountain itself may resolve to grid cells with higher effective elevations, reducing the gap.

## What NWS Does NOT Provide

- **Snow depth on the ground** — NWS forecasts snowfall amounts but not current snowpack depth. Use [SNOTEL](./snotel.md) for that.
- **Elevation data** — No elevation API. Use a separate service if needed.
- **Historical data** — Only the last few days of observations. For historical weather, use NOAA's Climate Data Online (separate service).
- **Avalanche forecasts** — Not an NWS product. Use [UAC](./uac-native.md) or [avalanche.org](./avalanche-org.md).

## Workshop Notes

- The two-step lookup adds complexity — consider caching the `/points` response so you only do it once per location
- The raw grid endpoint (`/gridpoints/{office}/{gridX},{gridY}`) returns time series with ISO 8601 duration intervals, which can be tricky to parse. The `/forecast/hourly` endpoint is simpler if you just need hourly values
- Include a `User-Agent` header (e.g., `"ShipSummit Workshop (your-email@example.com)"`) — NWS may block requests without one
- Pre-seeded data using NWS format is available in the track data directories. Build against those files first, then fetch live when ready
- For snow depth, pair NWS with [SNOTEL](./snotel.md) — NWS does not provide snowpack depth measurements
