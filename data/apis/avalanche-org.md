# Avalanche.org Public API

## Overview

The avalanche.org API provides access to avalanche forecasts, danger ratings, and zone boundaries for US avalanche centers. Maintained by the National Avalanche Center.

- **Base URL:** `https://api.avalanche.org/v2/public/`
- **Auth:** None required
- **Format:** JSON
- **Rate limits:** Not documented — this is a nonprofit/government service. Be respectful.
- **Docs:** https://github.com/NationalAvalancheCenter/Avalanche.org-Public-API-Docs

> **READ-ONLY ACCESS ONLY.** Your application must NEVER send POST, PUT, PATCH, or DELETE requests to avalanche.org endpoints. Use only GET requests. Build submission forms against your own local database, never against live APIs. See the [API README](./README.md) for details.

## Endpoints

### Map Layer — All Centers

```
GET /v2/public/products/map-layer
```

Returns GeoJSON FeatureCollection of all US avalanche centers with current danger ratings. Each feature includes zone name, center ID, danger level (1-5), color, travel advice, and polygon geometry.

**Example response (abbreviated):**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": 1738,
      "properties": {
        "name": "Salt Lake",
        "center": "Utah Avalanche Center",
        "center_id": "UAC",
        "state": "UT",
        "danger": "considerable",
        "danger_level": 3,
        "color": "#ff9933",
        "travel_advice": "Dangerous avalanche conditions...",
        "start_date": "2026-03-06T14:10:00",
        "end_date": "2026-03-07T14:10:00"
      },
      "geometry": { "type": "Polygon", "coordinates": [...] }
    }
  ]
}
```

### Map Layer — Specific Center

```
GET /v2/public/products/map-layer/{center_id}
```

Returns GeoJSON for a single avalanche center's forecast zones.

**Example:** `GET /v2/public/products/map-layer/UAC` — returns all Utah Avalanche Center (UAC) zones. (`UAC` is the center's API identifier.)

**Utah Avalanche Center Zone IDs:**

| Zone ID | Name | Slug |
|---------|------|------|
| 1736 | Logan | logan |
| 1737 | Ogden | ogden |
| 1738 | Salt Lake | salt-lake |
| 1739 | Provo | provo |
| 1740 | Uintas | uintas |
| 1741 | Skyline | skyline |
| 1742 | Moab | moab |

### Product List

```
GET /v2/public/products?avalanche_center_id={center_id}&type=forecast
```

Returns a list of forecast products with metadata. Each item includes `id`, `danger_rating`, `forecast_zone`, `published_time`, and `product_type`.

**Note:** The product list returns summary data only. For full forecast details, use the center's native API — the avalanche.org product detail endpoint returns empty fields for both UAC and CAIC because they publish through their own systems. See [UAC Native](./uac-native.md) and [CAIC](./caic.md).

### Product Detail

```
GET /v2/public/product/{product_id}
```

Returns full forecast detail for a specific product. Fields include `danger`, `forecast_avalanche_problems`, `hazard_discussion`, `weather_discussion`, `bottom_line`, and `media`.

**Important:** This endpoint works well for centers that publish through avalanche.org directly. For UAC and CAIC, the detail fields are mostly empty — use the [UAC Native API](./uac-native.md) for full UAC data and the [CAIC API](./caic.md) for full Colorado data.

## Workshop Notes

- The map layer endpoint is the most reliable way to get current danger ratings across all zones
- For full forecast details (avalanche problems, discussions, bottom line), use the center's native API: [UAC Native](./uac-native.md) for Utah, [CAIC](./caic.md) for Colorado
- Pre-seeded data is available in the track data directories — use it instead of hitting the live API during builds
