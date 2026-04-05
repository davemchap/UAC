# Chad's Wish List — Evaluation Log

> Maintained by AI agent. Updated continuously as features are built and evaluated.
> Each request is scored: ✅ Done | 🟡 Partial | ❌ Not started

---

## Chad's Original Requests

### 1. Personas of various user groups and experience levels
**Request:** 3–4 levels of experience across motorized and non-motorized user groups, a guide, avalanche educator, and snow safety professional/avalanche forecaster.

**Status:** ✅ **Done**

**Evidence:**
- 9 personas defined in `src/components/scorecard/personas.ts`
- Experience levels: `low` (Jordan, Ryan, Colby, Stuart), `high` (Priya, Beth, Mike), `expert` (Marcus), `forecaster` (Sasha)
- Motorized: Ryan Kowalczyk (recreational snowmobiler)
- Human-powered: Colby Reyes (splitboarder), Stuart Chambers (family physician/newbie), Beth Thornton (skimo racer), Mike Baxter (once-a-year BC skier), Priya Sundaram (experienced BC traveler)
- Guide/educator: Marcus Ohlsson (Guide / Avalanche Educator)
- Snow safety professional: Sasha Kowalski (Snow Safety Professional / forecaster)
- Domain dimensions (training level, terrain familiarity, risk tolerance, etc.) feed into scoring thresholds

**Gaps:**
- DB seeds for Stuart, Beth, Mike not yet verified in live DB (persona-trainer seeds them at startup)

---

### 2. Daily agent run — all 8 UAC forecasts scored against all personas
**Request:** Each day have an agent run the personas against each of the UAC's 8 daily forecasts.

**Status:** 🟡 **Partial**

**Evidence:**
- `GET /api/scorecard` already scores latest forecasts for all zones (ingested every 6h via scheduler)
- UAC ingestion runs automatically at startup and every 6h
- Scoring runs on-demand per HTTP request — NOT on a scheduled daily batch

**Missing:**
- No scheduled daily batch job that scores all forecasts and persists results
- No daily report artifact generated automatically
- No persistent `scorecard_runs` table logging daily results

**Next:** Build a `scorecard-scheduler` component that fires at 6am daily, scores all zones, and persists results to DB.

---

### 3. Daily management report — readability + flags per forecast per persona
**Request:** Daily report on forecast readability, with flags showing what makes each forecast more/less usable for each persona.

**Status:** 🟡 **Partial**

**Evidence:**
- Scoring components exist and return rich data:
  - `scoreForecast()` → jargon flags, sentence length flags, clarity/actionability/jargon scores
  - `computePersonaLens()` → per-section comprehension levels (HIGH/MEDIUM/LOW/MISREAD), divergence score, "what they'll do"
  - `computeDecisionMirror()` → signal extraction, INVERTED/UNCERTAIN detection
  - `analyzeAssumptions()` → concept gap matrix per persona
  - `buildCoachingSuggestions()` → actionable forecaster feedback
- Frontend scorecard UI renders all this per zone
- Golden dataset demo mode shows 18 curated scenarios

**Missing:**
- No report FORMAT (PDF/HTML email/markdown) generated automatically
- No daily summary aggregated across all zones
- No management-facing dashboard showing per-forecaster or per-zone trends over time
- Report not delivered anywhere (email, Slack, S3)

**Next:** Build a report generator component and a `/api/reports/daily` endpoint that produces a structured daily summary.

---

### 4. Evaluate past forecasts by date or URL
**Request:** Ability to give a past date or forecast URL and have the agent evaluate those forecasts.

**Status:** 🟡 **Partial**

**Evidence:**
- Golden dataset (`GET /api/scorecard/golden`) scores 18 pre-loaded historical scenarios
- DB stores all ingested forecasts — queries could support date-range lookups
- `getForecastForScoringByZone()` exists but only returns latest

**Missing:**
- No `GET /api/scorecard/:zoneSlug/:date` endpoint for historical date lookup
- No UI date picker or URL input for ad-hoc evaluation
- No mechanism to fetch a forecast by external URL (UAC URL → parse → score)

**Next:** Add `getForecastForScoringByZoneAndDate()` query + route param, and a UI date picker on the scorecard.

---

### 5. Weekly report by region and forecaster — forecast "quality"
**Request:** Weekly aggregated report by region and forecaster showing forecast quality over time.

**Status:** ❌ **Not started**

**Evidence:** No weekly report component, no forecaster attribution aggregation, no trend data.

**Missing:**
- No `forecaster_scores` or `forecast_quality_log` table
- No weekly aggregation query
- No report generation for "by forecaster" or "by region" breakdowns
- No trend visualization (quality improving/declining over time)

**Next:** Build `reports` component with `generateWeeklyReport()`, add DB table for persisting per-forecast scores, add `/api/reports/weekly` endpoint.

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-05 | Built 9-persona set with domain dimensions | Covers all experience levels Chad requested; dimensions (training, familiarity, risk tolerance) make scoring adaptive |
| 2026-04-05 | Built 3 new scoring components (Assumption Audit, Persona Lens, Decision Mirror) | Moves beyond word replacement — gives forecasters insight into comprehension failures and inverted decisions |
| 2026-04-05 | Kept all persona scoring server-side, API-driven | Frontend stays thin (fetch+render); scoring logic is testable and reusable across daily batch and UI |
| 2026-04-05 | Items 2, 3, 4, 5 require new agents | Merge complete — launching agents for daily batch + historical + weekly report features |

---

## Iteration Queue (active)

- [ ] Daily batch scorecard job (Item 2)
- [ ] Daily management report endpoint + format (Item 3)
- [ ] Historical forecast evaluation by date (Item 4)
- [ ] Weekly report by region + forecaster (Item 5)
- [ ] Frontend tabs: Assumption Audit, What They Heard, Decision Mirror (backlog story app-gsm.3/4)
