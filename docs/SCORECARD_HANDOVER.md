# Forecast Usability Scorecard — Design & Handover Guide

> **Purpose:** Technical and product documentation for handing off the Forecast Usability Scorecard to Chad or any team that wants to adopt, extend, or port the solution.

---

## What This Is

The Forecast Usability Scorecard is a prototype system that evaluates avalanche forecast text for how well different types of backcountry users can read, understand, and act on it. It is built on top of UAC (Utah Avalanche Center) forecast data ingested from the live API.

The system has **seven prototype solutions** (tabs), each exploring a different angle of forecast usability:

| # | Tab | What it does |
|---|-----|-------------|
| 1 | Readability Lens | Scores clarity, jargon load, and actionability per persona. Highlights phrases that may confuse each reader. |
| 2 | Forecaster Coach | Translates persona scores into writing feedback for forecasters. Grade card + coaching suggestions. |
| 3 | Assumption Audit | Maps technical concepts the forecast assumes readers know against a knowledge gap matrix per persona. |
| 4 | What They Heard | Simulates how each persona interpreted each forecast section (HIGH / MEDIUM / LOW / MISREAD). |
| 5 | Decision Mirror | Predicts what decision each persona made and whether it matches the forecast's intent (INVERTED detection). |
| 6 | Daily Report | Aggregated daily quality summary across all zones: worst comprehension zone, most inverted persona, assumption density. |
| 7 | Weekly Report | Weekly quality trends by forecaster and zone with improving/declining/stable indicators vs. prior 3-week average. |

---

## Architecture

```
src/
├── components/
│   ├── scorecard/           ← All scoring business logic (pure TypeScript, no framework deps)
│   │   ├── index.ts         ← Public exports
│   │   ├── personas.ts      ← 9 built-in persona definitions with domain dimensions
│   │   ├── scoring.ts       ← scoreForecast() — jargon, clarity, actionability scoring
│   │   ├── coaching.ts      ← buildCoachingSuggestions() — forecaster writing feedback
│   │   ├── persona-lens.ts  ← computePersonaLens() — section-by-section comprehension simulation
│   │   ├── decision-mirror.ts ← computeDecisionMirror() — decision confidence (INVERTED/UNCERTAIN/CLEAR)
│   │   ├── assumption-audit.ts ← analyzeAssumptions() — concept gap matrix
│   │   ├── daily-report.ts  ← buildDailyReport() — aggregated daily quality summary
│   │   ├── weekly-report.ts ← generateWeeklyReport() — weekly forecaster/zone trend report
│   │   └── golden-scenarios.ts ← loadGoldenScenarios() — 18 curated test scenarios
│   ├── persona-trainer/     ← Persona CRUD: create, edit, clone, delete personas via API
│   ├── scorecard-scheduler/ ← startScorecardScheduler() — runs at 6am MT daily, scores all zones
│   └── db/
│       └── schema.ts        ← scorecardRuns table (migration 0014)
├── bases/http/
│   └── routes/
│       ├── scorecard.ts     ← API routes: GET /api/scorecard, /api/scorecard/:zone, /report/daily, /report/weekly
│       └── personas.ts      ← CRUD API for persona trainer
├── projects/
│   └── scorecard/           ← Frontend: pure fetch + render, no business logic
│       ├── index.html
│       ├── scorecard.js
│       └── scorecard.css
└── data/
    ├── shared/
    │   └── golden-datasets/ ← 18 historical forecast scenarios used for demo mode
    └── black-diamond/
        └── zone-config.json ← 9 UAC Wasatch forecast zones
```

---

## The 9 Personas

Each persona represents a distinct type of backcountry user. All are seeded at startup via `persona-trainer` component.

| Persona | Role | Training | Risk Tolerance | Travel Mode |
|---------|------|----------|----------------|-------------|
| Jordan Mitchell | Weekend Recreational Skier | None (0) | 3/5 | Human-powered |
| Ryan Kowalczyk | Recreational Snowmobiler | Awareness (1) | 4/5 | Motorized |
| Colby Reyes | Splitboarder | AIARE 1 (2) | 3/5 | Human-powered |
| Stuart Chambers | Family Physician / First-Timer | None (0) | 2/5 | Human-powered |
| Beth Thornton | Skimo Racer | AIARE 1 (2) | 4/5 | Human-powered |
| Mike Baxter | Once-a-Year BC Skier | Awareness (1) | 3/5 | Out-of-bounds |
| Priya Sundaram | Experienced BC Traveler | AIARE 2 (3) | 2/5 | Human-powered |
| Marcus Ohlsson | Guide / Avalanche Educator | Pro 1 (4) | 2/5 | Human-powered |
| Sasha Kowalski | Snow Safety Professional / Forecaster | Pro 2+ (5) | 1/5 | Human-powered |

### How Persona Attributes Drive Scoring

| Attribute | Range | Effect |
|-----------|-------|--------|
| `avalancheTrainingLevel` | 0–5 | Determines which UAC jargon terms are recognized. Level 0 = unknown terms score 0. Level 3+ = most UAC terminology is understood. |
| `riskTolerance` | 1–5 | High (4–5) = needs explicit go/no-go language or defaults to "go". Low (1–2) = a general warning triggers caution. Primary driver of actionability score and Decision Mirror outcomes. |
| `terrainAssessmentSkill` | 1–5 | Comprehension of aspect, elevation band, and terrain feature language. Low = "E-facing slopes above 9,000 ft" is meaningless. |
| `yearsOfMountainExperience` | 0–40+ | Baseline modifier for general mountain conditions language. |
| `backcountryDaysPerSeason` | 0–100+ | Frequency modifier — heavy users recognize snowpack patterns; occasional users miss context. |
| `localTerrainFamiliarity` | 1–5 | Comprehension of zone-specific place names and local hazard indicators. |
| `groupDecisionTendency` | solo/group/leader | Used in Decision Mirror to simulate group risk amplification. |
| `weatherPatternRecognition` | 1–5 | Comprehension of wind, temperature, and weather-driven hazard descriptions. |

---

## API Reference

All endpoints return `{ success: true, data: ... }` on success.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scorecard` | Latest scored forecast for all zones |
| GET | `/api/scorecard/golden` | 18 golden dataset scenarios scored (demo mode) |
| GET | `/api/scorecard/:zoneSlug` | Latest forecast for one zone |
| GET | `/api/scorecard/:zoneSlug/:date` | Historical forecast for one zone on YYYY-MM-DD |
| GET | `/api/scorecard/report/daily?date=YYYY-MM-DD` | Daily aggregated report (defaults to today) |
| GET | `/api/scorecard/report/weekly?week=YYYY-MM-DD` | Weekly report (defaults to current week) |
| GET | `/api/personas` | List all personas |
| POST | `/api/personas` | Create persona |
| PUT | `/api/personas/:key` | Update persona |
| DELETE | `/api/personas/:key` | Delete persona |
| POST | `/api/personas/:key/test` | Test-drive a persona (ask it a question) |

---

## Scoring Response Shape (per zone)

```typescript
{
  forecastId: number,
  zoneId: number,
  zoneName: string,
  zoneSlug: string,
  forecasterName: string,
  dateIssued: string,
  overallDangerRating: string,
  bottomLine: string | null,
  currentConditions: string | null,
  personas: PersonaScore[],       // clarity, jargon, actionability, overall, flags[]
  journeys: Journey[],            // simulated day in the field per persona
  coaching: CoachingSuggestion[], // rewrite suggestions for forecasters
  personaLens: PersonaLens[],     // section-by-section comprehension (HIGH/MEDIUM/LOW/MISREAD)
  decisionMirror: DecisionMirror[], // INVERTED/UNCERTAIN/CLEAR per persona
  assumptionAudit: AssumptionAudit, // concept inventory + knowledge gap matrix
  scoredAt: string
}
```

---

## Database

One table owned by this feature: **`scorecard_runs`** (migration `0014_scorecard_runs.sql`).

Columns: `forecast_id`, `zone_id`, `zone_slug`, `zone_name`, `forecaster_name`, `date_issued`, `overall_danger_rating`, `persona_id`, `persona_name`, `overall_score`, `clarity_score`, `jargon_score`, `actionability_score`, `comprehension_level`, `divergence_score`, `decision_confidence`, `assumption_density`, `most_common_flag`, `scored_at`.

Unique constraint: `(forecast_id, persona_id)` — upsert on conflict.

---

## Demo Mode

The `★ Demo Data` button loads 18 pre-scored golden scenarios from `/api/scorecard/golden`. These are static JSON files in `data/shared/golden-datasets/` — no live API calls needed. Demo mode is the recommended way to present the scorecard when live forecast data isn't available.

---

## Extracting the Scorecard for Another Project (Chad's Use Case)

The scorecard is designed as a self-contained module within a Hono + Bun + PostgreSQL app. To extract and reuse it:

### Files to take

```
src/components/scorecard/          ← All scoring logic (zero external deps beyond DB)
src/components/persona-trainer/    ← Persona CRUD
src/components/scorecard-scheduler/ ← Daily batch runner
src/projects/scorecard/            ← Frontend (HTML/JS/CSS — vanilla, no framework)
src/bases/http/routes/scorecard.ts ← API wiring
src/bases/http/routes/personas.ts  ← Persona API
src/components/db/migrations/0014_scorecard_runs.sql ← DB schema
data/shared/golden-datasets/       ← Demo data (optional)
```

### What the scoring components need at runtime

- A PostgreSQL database with the `scorecard_runs` table (run migration 0014)
- The `avalanche_forecasts` table (the scoring input — you can substitute any forecast text source by calling `scoreForecast()` directly)
- The `personas` table, seeded by `persona-trainer`

### To create a clean handover repo using git filter-repo

```bash
# Install git-filter-repo (pip install git-filter-repo)
# Clone the repo fresh
git clone <repo-url> scorecard-export
cd scorecard-export

# Keep only scorecard-relevant paths
git filter-repo \
  --path src/components/scorecard \
  --path src/components/persona-trainer \
  --path src/components/scorecard-scheduler \
  --path src/projects/scorecard \
  --path src/bases/http/routes/scorecard.ts \
  --path src/bases/http/routes/personas.ts \
  --path src/components/db \
  --path data/shared/golden-datasets \
  --path data/black-diamond/zone-config.json \
  --force

# Push to a new repo
git remote set-url origin <chad-repo-url>
git push origin main
```

> Note: `src/components/db/` includes migrations for all features, not just scorecard. Chad would need to run only `0001` (initial) and `0014` (scorecard_runs) plus whatever persona-trainer migrations exist.

---

## Operational Notes

- **Daily batch**: `startScorecardScheduler()` fires at 6am MT, scores all 9 UAC zones against all active personas, upserts results to `scorecard_runs`.
- **Wired in**: Called from `initApp()` in `src/bases/http/app.ts` — starts on every server boot.
- **Connection pool**: Max 10 connections (shared DB limit is 20 total across dev + prod).
- **UAC data dependency**: The scorecard reads from `avalanche_forecasts` table, which is populated by the UAC ingestion scheduler (every 6 hours). Without ingestion running, the scorecard will score stale data.

---

## Chad's Original Requests — Status

| # | Request | Status |
|---|---------|--------|
| 1 | Personas of various user groups and experience levels | ✅ 9 personas with full domain dimensions |
| 2 | Daily agent run — all 8 UAC forecasts scored against all personas | ✅ 6am MT scheduler, results in `scorecard_runs` |
| 3 | Daily management report | ✅ `GET /api/scorecard/report/daily` + visual UI tab |
| 4 | Evaluate past forecasts by date or URL | ✅ `GET /api/scorecard/:zone/:date` + UI date picker (2 weeks back) |
| 5 | Weekly report by region and forecaster | ✅ `GET /api/scorecard/report/weekly` + visual UI tab with trend indicators |
