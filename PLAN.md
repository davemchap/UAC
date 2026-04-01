# Plan: Run 1 — Remaining Work

## Already Implemented

- ✅ `src/components/avalanche-data/` — snapshot loader, zone config, accessors
- ✅ `src/components/alerts/` — threshold-based alert decision engine (danger 1-5 → action)
- ✅ `src/components/risk-assessment/` — danger level mapping, problem extraction, weather/snowpack
- ✅ `src/bases/http/routes/zones.ts` — `GET /api/zones`, `GET /api/zones/:slug`
- ✅ `src/public/` — full dashboard (zone grid, danger colors, modal, summary bar)

## Remaining Stories

### Step 0 — Commit plan to repo

```bash
cp ~/.claude/plans/zippy-dreaming-wilkinson.md ~/workspaces/app/PLAN.md
git add PLAN.md
git commit -m "Add Run 1 implementation plan (beads epic/story graph)"
```

---

### Epic D — AI Alert Component  ← HIGHEST PRIORITY

**D1: Install Anthropic SDK + AI alert component**
```bash
bun add @anthropic-ai/sdk
```
- File: `src/components/ai-alert/index.ts`
- Types: `AlertType = "traveler" | "ops"`, `AlertResult { content, model, generatedAt }`
- Beads pipeline: `buildPrompt → callClaude → parseResponse`
  - `buildPrompt(zone, type)`:
    - `traveler` → translate danger rating + problems into plain language for backcountry skier
      ("Translate, don't re-analyze. Forecaster judgment is ground truth.")
    - `ops` → explain why alert fired, what data triggered it, for operations staff
  - `callClaude(prompt)` → `claude-sonnet-4-6`
  - `parseResponse` → extract text, return `AlertResult`
- Export: `generateAlert(zone, type) → Promise<AlertResult>`

**D2: AI alert API route**  (blocked by D1)
- Add to `src/bases/http/routes/zones.ts`:
  - `GET /api/zones/:slug/alert?type=traveler|ops`
  - Guard: skip if `alertDecision.action === "no_alert"`
  - Return: `{ zone: slug, alertDecision, alertType, content, generatedAt }`

**D3: Wire alert button in frontend**  (blocked by D2)
- `src/public/app.js`: add "Generate Alert" button in zone detail modal
- Fetch `GET /api/zones/:slug/alert?type=traveler`
- Render AI content in modal below detail

---

### Epic E — Context Architecture

**E1: Subsystem CLAUDE.md files**  (independent, parallel with D)
- `src/components/ai-alert/CLAUDE.md`
  - Model: `claude-sonnet-4-6`
  - Constraint: translate forecaster's published judgment; never re-derive danger ratings
  - GET-only to external APIs
- `src/components/avalanche-data/CLAUDE.md`
  - Offline-first: snapshot is source of truth for Run 1; live APIs in stretch
- `src/components/alerts/CLAUDE.md`
  - Threshold rules from `data/black-diamond/alert-thresholds.json`; pure functions only
- `src/components/risk-assessment/CLAUDE.md`
  - Pure transformation: no I/O, no side effects

---

### Deploy Checkpoints

**Deploy #1** (after D2+D3): `git push` → verify AI alert flow live end-to-end

---

## Parallel Swim Lanes

| Track | Stories |
|-------|---------|
| Engineer: AI | D1 → D2 → D3 → Deploy #1 |
| Anyone: Context | E1 (no blockers) |

---

## Files to Create/Edit

| File | Story |
|------|-------|
| `src/components/ai-alert/index.ts` | D1 (create) |
| `src/bases/http/routes/zones.ts` | D2 (edit) |
| `src/public/app.js` | D3 (edit) |
| `src/components/ai-alert/CLAUDE.md` | E1 (create) |
| `src/components/avalanche-data/CLAUDE.md` | E1 (create) |
| `src/components/alerts/CLAUDE.md` | E1 (create) |
| `src/components/risk-assessment/CLAUDE.md` | E1 (create) |
| `package.json`, `bun.lock` | D1 |
| `PLAN.md` | Step 0 |

## Verification

1. `bun run check` passes after D1, D2, D3
2. Dashboard loads with zone grid (already working)
3. Click danger ≥ 3 zone → modal opens → "Generate Alert" → AI content appears
4. Alert content translates (not re-derives) forecaster judgment
5. `git push` → CI pipeline deploys → verify live URL
