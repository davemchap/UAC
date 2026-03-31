# SNOTEL — NRCS AWDB REST API

## Overview

SNOTEL (Snow Telemetry) stations are automated weather stations that measure snowpack conditions across the western US. Operated by the USDA Natural Resources Conservation Service (NRCS). The AWDB (Air-Water Database) REST API provides access to the data.

- **Base URL:** `https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/`
- **Auth:** None required
- **Format:** JSON
- **Rate limits:** Not documented — government service, be respectful
- **Docs (Swagger):** https://wcc.sc.egov.usda.gov/awdbRestApi/swagger-ui/index.html

> **READ-ONLY ACCESS ONLY.** Your application must NEVER send POST, PUT, PATCH, or DELETE requests to SNOTEL endpoints. Use only GET requests. See the [API README](./README.md) for details.

## Endpoints

### Station Data (Time Series)

```
GET /services/v1/data?stationTriplets={triplet}&elements={elements}&duration=DAILY&beginDate={date}&endDate={date}
```

Returns daily snowpack readings for one or more stations.

#### Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `stationTriplets` | Station ID(s), comma-separated | `766:UT:SNTL` |
| `elements` | Data elements, comma-separated | `SNWD,WTEQ,TOBS` |
| `duration` | Time interval | `DAILY` |
| `beginDate` | Start date (YYYY-MM-DD) | `2026-02-27` |
| `endDate` | End date (YYYY-MM-DD) | `2026-03-06` |

#### Common Elements

| Code | Description | Unit |
|------|-------------|------|
| `SNWD` | Snow depth | inches |
| `WTEQ` | Snow water equivalent | inches |
| `TOBS` | Observed temperature | °F |
| `PREC` | Accumulated precipitation | inches |

#### Example Call

```
GET /services/v1/data?stationTriplets=766:UT:SNTL&elements=SNWD,WTEQ,TOBS&duration=DAILY&beginDate=2026-02-27&endDate=2026-03-06
```

#### Example Response (abbreviated)

```json
[
  {
    "stationTriplet": "766:UT:SNTL",
    "data": [
      {
        "stationElement": {
          "elementCode": "SNWD",
          "durationName": "DAILY",
          "storedUnitCode": "in"
        },
        "values": [
          { "date": "2026-02-27", "value": 71 },
          { "date": "2026-02-28", "value": 71 },
          { "date": "2026-03-01", "value": 70 }
        ]
      }
    ]
  }
]
```

### Station Metadata

```
GET /services/v1/stations?stateCds={state}&networkCds=SNTL
```

Returns metadata for all SNOTEL stations in a state. Use to discover station locations and triplet IDs.

**Example:** `GET /services/v1/stations?stateCds=UT&networkCds=SNTL` — returns all Utah SNOTEL stations.

## Station Triplet Format

Station IDs use a triplet format: `{station_number}:{state}:{network}`

- `766:UT:SNTL` = Snowbird, Utah, SNOTEL network
- `366:UT:SNTL` = Brighton, Utah, SNOTEL network

## Wasatch SNOTEL Stations

See `../shared/snotel-stations.json` for the full reference including coordinates and elevation.

| Triplet | Name | Elevation | Zone |
|---------|------|-----------|------|
| `766:UT:SNTL` | Snowbird | 9,820 ft | Salt Lake |
| `366:UT:SNTL` | Brighton | 8,755 ft | Salt Lake |
| `814:UT:SNTL` | Thaynes Canyon | 8,400 ft | Salt Lake |
| `628:UT:SNTL` | Mill D North | 8,900 ft | Salt Lake |
| `393:UT:SNTL` | Ben Lomond Peak | 7,600 ft | Ogden |
| `828:UT:SNTL` | Timpanogos Divide | 8,350 ft | Provo |

## Workshop Notes

- SNOTEL is slightly more complex than the other APIs because you need to know station triplet IDs
- Pre-seeded station reference is available in `../shared/snotel-stations.json`
- Pre-seeded snowpack data is available in the track data directories
- Not all Utah Avalanche Center (UAC) zones have nearby SNOTEL stations (Skyline and Moab have limited coverage)
- Data is daily — values represent the reading at a fixed time each day
