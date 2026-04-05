# UX Design Spec: Scorecard — Assumption Audit, What They Heard, Decision Mirror

**Tool**: Forecast Usability Scorecard — UAC
**Audience**: Avalanche forecasters and snow safety managers
**Date**: 2026-04-05

---

## Part 1: UX Audit of Current UI

### Critical

**C1 — Tab bar has only 2 tabs but 3 new data types exist in the API response**
The API already returns `personaLens`, `decisionMirror`, and `assumptionAudit` but no UI renders them. Forecasters have no visibility into decision accuracy or knowledge assumption gaps. This is a feature gap masquerading as an audit issue.

**C2 — `renderAll()` calls only `renderReadability()` and `renderCoach()`, silently dropping 3 data structures**
Any future tab must be wired into `renderAll()` or its data will be fetched and discarded. The wiring point is a single code path — easy to fix but causes silent data loss until addressed.

### High

**H1 — No visible focus ring on tab buttons in dark header**
The tab nav sits on a `#1e2d3d` background. Tab buttons have no explicit `:focus-visible` ring, making keyboard navigation invisible. Forecasters who tab through controls will lose track of focus position.

**H2 — Summary table rows have `tabindex="0" role="button"` but no visible focus state**
The `.sc-summary-row` rows are keyboard-activatable but have no `:focus-visible` CSS. Keyboard-only users cannot see which row is focused.

**H3 — Chip tooltip uses `top - 8px` without checking viewport boundary**
`showChipTooltip()` positions the tooltip above the chip using `rect.top - 8px`. On small screens or when chips are near the top of the viewport, the tooltip renders off-screen. No clamping logic exists.

**H4 — Persona score chips in the Readability tab have no distinct visual state for "no flags" personas**
A persona with no readability flags renders as an unpressable chip with `aria-pressed="false"` but looks identical to a pressable chip. The `sc-metric-chip--clean` class exists but the visual treatment is too subtle — a forecaster cannot tell at a glance which personas had zero issues.

**H5 — Mobile layout: `sc-readability-layout` is a side-by-side flex with no responsive breakpoint**
On screens narrower than ~900px, the forecast column and sidebar collapse in an unusable way. The sidebar is not visible without horizontal scrolling.

### Medium

**M1 — Problem banner (`sc-problem-banner`) is empty on page load — no content is ever injected into it**
The HTML element exists and has `aria-live="polite"` but `renderAll()` never writes to it. Dead DOM that adds confusion during code review and takes up space.

**M2 — Demo mode nav label is only updated in `renderDemoActiveScenario()` but the label element is present on load showing "Loading…"**
Before the user clicks Demo Data, the `sc-demo-scenario-label` shows "Loading…" which is confusing since nothing is loading.

**M3 — Suggestion drawer (`sc-drawer`) is not scrollable when forecast text is long**
The drawer uses `position: fixed` with `overflow: auto` on the inner but no `max-height` constraint. On short viewport heights, the close button can scroll out of view.

**M4 — Forecaster Coach section has an `<h3>` "Coaching Suggestions" inside a `<section>` that has no `<h2>` — heading hierarchy skips a level**
The Forecaster Coach section has no visible heading — the hypothesis meta block has a label span, not a heading. Screen readers traversing by heading will encounter an orphaned `<h3>`.

### Low

**L1 — `sc-demo-bar` visible on load with no `hidden` attribute — requires `.active` class to become visible, but initial state shows the bar's placeholder text briefly**
The demo bar uses CSS `display: none` unless `.active`, but the initial "Loading…" label text is technically visible before CSS applies.

**L2 — Color-only comprehension indicators in sidebar score cards**
The gauge fill color is the only signal of score health. No icon or text label distinguishes a score of 45 from 55 at a glance. Adding a grade label or icon would help.

---

## Part 2: Information Architecture Recommendation

### Current IA (2 tabs)
- Readability Lens
- Forecaster Coach

### Proposed IA (4 tabs, post-implementation)

| # | Tab | Primary Question | Who Uses It |
|---|-----|-----------------|-------------|
| 1 | **Readability Lens** | "Which phrases confuse which readers?" | Forecasters during editing |
| 2 | **Assumption Audit** | "What background knowledge does my forecast require?" | Forecasters pre-publishing |
| 3 | **What They Heard** | "What decision will each persona actually make?" | Forecasters post-publishing review |
| 4 | **Decision Mirror** | "Did each persona get the right message?" | Safety managers, program leads |

### Rationale

**4 tabs, not 5**: The existing "Forecaster Coach" tab is retained as-is. Five tabs would push the nav into overflow on smaller viewports. Four tabs fit comfortably in the `sc-tabs` nav bar.

**Tab order follows the forecaster workflow**: Forecasters move from "phrase-level clarity" (Readability) → "knowledge assumptions" (Assumption Audit) → "what was heard" (What They Heard) → "was the decision correct" (Decision Mirror). This is a natural progression from drafting to reviewing outcomes.

**Do not merge Assumption Audit into Readability**: These answer different questions. Readability is phrase-level. Assumption Audit is concept-level. Combining them would create cognitive overload in the most complex tab.

**Do not merge What They Heard into Decision Mirror**: "What they heard" is descriptive (comprehension). "Decision Mirror" is evaluative (accuracy). Separating them matches the mental model — first understand, then judge.

---

## Part 3: Tab Design Specs

---

### Tab: Assumption Audit

**Primary question**: "What background knowledge does this forecast require, and who doesn't have it?"

**Mental model**: A forecaster proofreading not for grammar but for assumed expertise. The tool reveals the invisible contract between forecaster and reader — "I wrote this assuming you know X."

#### Layout

```
┌─────────────────────────────────────────────────────────┐
│ [CRITICAL GAP ALERT BANNER — most critical gap, if any] │
├────────────────────────────┬────────────────────────────┤
│  Concept Inventory         │  Gap Matrix                │
│  (left panel, 60%)         │  (right panel, 40%)        │
│                            │                            │
│  [domain badge] concept    │  persona row × concept col │
│  trigger phrases           │  ● known  ◐ partial  ✗ gap │
│  criticality indicator     │                            │
│  [click → highlight]       │  misread risk per persona  │
├────────────────────────────┴────────────────────────────┤
│  Assumption Density Score bar                           │
└─────────────────────────────────────────────────────────┘
```

#### Critical Gap Alert
- Displayed prominently at top if `mostCriticalGap` is set
- Background: amber (`#fef3c7`) with amber left border (`#d97706`)
- Text: "Most critical gap: [concept] — [N] personas may misread this"
- If no gaps exist: show a green "All personas understand this forecast" banner

#### Concept Inventory (left panel)
- Each concept is a card with:
  - Domain badge (pill): color-coded by domain (`snowpack` = blue, `terrain` = orange, `danger_scale` = red, `decision_framework` = purple, `avalanche_problem` = amber, `local_knowledge` = green)
  - Concept name (bold, 0.95rem)
  - Trigger phrases (comma-separated, italic, muted — these are the actual words in the forecast)
  - Criticality indicator: safety-critical concepts (weight ≥ 2.0) get a `⚠` icon
- Clicking a concept card sets it as "active" — the trigger phrases highlight in the forecast text shown in the right gap matrix
- Cards are sorted: unknown-by-most-personas first, then by criticalityWeight descending

#### Gap Matrix (right panel)
- Horizontal axis: personas (abbreviated name or first letter in colored circle)
- Vertical axis: concepts (same order as left panel)
- Cell states:
  - `●` Known — green (`#16a34a`)
  - `◐` Partial — amber (`#d97706`)
  - `✗` Unknown — red (`#dc2626`) with light red background
- Bottom row: "Misread Risk" per persona as a 0–100 bar
- Clicking a persona column header highlights that persona across the matrix

#### Assumption Density Score
- Horizontal progress bar at bottom: 0–100
- Label: "Assumption density: [score]/100"
- Low (< 30): green — "This forecast uses accessible language"
- Medium (30–60): amber — "This forecast requires moderate background knowledge"
- High (> 60): red — "This forecast assumes significant technical expertise"

#### Empty State
When no concepts are detected (very simple forecast): "No technical concepts detected — this forecast uses accessible, plain-language content."

#### Interactions
- Concept card click → sets active concept, cards scroll forecast text to first trigger phrase (future enhancement marker — no live forecast text in this tab, but trigger phrases listed on card are sufficient)
- Gap matrix cell hover → tooltip showing exact gap level and reason
- Keyboard: Tab between concept cards; Enter activates; Escape clears

---

### Tab: What They Heard

**Primary question**: "What decision does each persona form after reading this forecast?"

**Most important field**: `whatTheyWillDo` — this is the actionable output of the entire comprehension model. Everything else is supporting context.

#### Persona Selector Pattern: Horizontal Pill Strip

**Justification**: Tabs create a navigation hierarchy that buries the comparison view. A dropdown works for many personas but hides the comparative dimension — forecasters want to scan across personas quickly. A horizontal pill strip (with color-coded dots matching persona colors) allows:
1. Quick switching with color identity preserved
2. All persona names visible simultaneously (up to 6–7 personas fit on one row)
3. Natural progression left-to-right (by comprehension level, worst → best)

If more than 6 personas exist, the strip scrolls horizontally (overflow-x: auto, no scrollbar visible, touch-scroll on mobile).

#### Layout

```
┌─────────────────────────────────────────────────────────┐
│  [● Jordan] [● Sam] [● River] [● Alex] ...             │  ← pill strip
├─────────────────────────────────────────────────────────┤
│  WHAT THEY WILL DO                                      │  ← hero block
│  ┌─────────────────────────────────────────────────┐   │
│  │  [comprehension badge]  Jordan                  │   │
│  │  "Jordan goes out without a clear hazard        │   │
│  │   picture. Route selection will be based on     │   │
│  │   feel, not forecast."                          │   │
│  │  Divergence: ████████░░  72                     │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  SECTION BREAKDOWN                                      │
│  [section card] [section card] [section card]          │
└─────────────────────────────────────────────────────────┘
```

#### Hero Block — "What They Will Do"
- Large serif-style font (1.1rem, `--sc-text`)
- Italic quote treatment — this is a simulated persona voice
- Left border color matches persona color
- Background: very light tint of persona color (`${personaColor}0D`)
- Comprehension badge sits above the quote:
  - `HIGH` → green pill, "HIGH comprehension"
  - `MEDIUM` → amber pill, "MEDIUM comprehension"
  - `LOW` → orange pill, "LOW comprehension"
  - `MISREAD` → red pill with `⚠` icon, "MISREAD — Safety Risk"

#### Divergence Score Visualization
- **Horizontal gauge bar**, 0–100 scale
- Not a pie chart (hard to read at small sizes), not a number alone (needs visual weight)
- The bar fills with persona color, turning to red as it passes 60
- Label: "Message divergence from forecaster intent"
- Tooltip on hover: "How far this persona's understanding deviates from the forecast's intended message"
- Score bracket labels: 0–20 "Aligned", 21–50 "Partial", 51–75 "Significant gap", 76–100 "Critical divergence"

#### Section Breakdown Cards
- One card per `sectionHearing` (Bottom Line, Danger Rating, Avalanche Problems, etc.)
- Card shows:
  - Section label (bold)
  - Comprehension badge (color-coded)
  - `heardAs` text (the most useful content — what the persona understood)
  - Missed terms (if any): small red chips for each term
- Cards use a 2-column grid on desktop, single column on mobile
- Card border-top color = comprehension level color

#### Comprehension Badge Color Semantics
```
HIGH     → #16a34a  (green)
MEDIUM   → #ca8a04  (amber)
LOW      → #ea580c  (orange)
MISREAD  → #dc2626  (red) + ⚠ prefix
```

#### Empty / No-zone State
"Select a zone to see what each persona heard in today's forecast."

---

### Tab: Decision Mirror

**Primary question**: "Did each persona form the RIGHT decision from this forecast?"

**Most critical insight**: INVERTED personas — people who got the WRONG message. These are safety-critical. They must be visually alarming.

#### Layout Choice: Card Grid (not table)

**Justification**: The "find the INVERTED ones fast" use case is a visual scan task. A table makes users read across rows. A card grid allows:
1. INVERTED cards to visually stand out (red border, warning icon) — impossible in a table without heavy styling
2. Natural grouping: INVERTED cards sorted first
3. Each card is self-contained — the 3 signal pass/fail indicators read as a unit

#### Sort Order
Cards are sorted: INVERTED → UNCERTAIN → HIGH (worst → best). Within each group, sort by `accuracyScore` ascending.

#### Card Anatomy

```
┌─────────────────────────────────────────────┐
│  ⚠ INVERTED  ●────────────────────  48/100  │  ← confidence badge + accuracy
│  Jordan                                      │  ← persona name (persona color)
│  Casual Recreationist                        │  ← persona role
│  ─────────────────────────────────────────  │
│  "Jordan is likely to make a terrain         │  ← behavioral conclusion
│   decision that contradicts the              │    (italic, medium weight)
│   forecaster's intent..."                   │
│  ─────────────────────────────────────────  │
│  [signal grid]                               │
│  Danger Level    ✓ Parsed                   │
│  Hazard Type     ✓ Parsed                   │
│  Terrain Excl.   ✗ NOT PARSED              │
└─────────────────────────────────────────────┘
```

#### INVERTED card visual treatment
- Red left border (4px, `#dc2626`)
- Background: `#fef2f2` (very light red)
- Confidence badge: red pill with `⚠` icon
- Card is sorted first in the grid

#### HIGH confidence card visual treatment
- Green left border (4px, `#16a34a`)
- Background: `#f0fdf4`
- Confidence badge: green pill with `✓` icon

#### UNCERTAIN card visual treatment
- Amber left border (4px, `#d97706`)
- Background: `#fffbeb`
- Confidence badge: amber pill with `~` indicator

#### Signal Grid — 3 pass/fail indicators per persona

Three rows, not columns. Each row:
- Signal label (left-aligned, 0.8rem, muted)
- Pass indicator: `✓ Parsed` in green, or `✗ NOT PARSED` in red
- Collapsed by default — no verbose conclusion text shown inline
- On hover/focus, tooltip shows the full `personaConclusion` text from the signal

**Justification for row layout vs. column layout**: Three columns per card creates a cramped layout on any reasonable card width. Three rows allow each signal to be read clearly, and the pass/fail verdict is binary — users don't need the conclusion text unless they want detail.

#### Empty State (all HIGH confidence)
When all personas have `HIGH` confidence: Show a green confirmation banner:
"All personas formed the correct decision from this forecast. No INVERTED signals detected."
Below it, still render the cards so the forecaster can see the signal breakdown.

#### Accuracy Score
- Small horizontal bar inside each card header: `●────────────────────  48/100`
- Width proportional to `accuracyScore`
- Color: green if ≥ 75, amber if 50–74, red if < 50

---

## Part 4: CSS / Layout Recommendations

Using existing CSS variable naming conventions from `scorecard.css`:

### New variables to add to `:root`

```css
--sc-comprehension-high: #16a34a;
--sc-comprehension-medium: #ca8a04;
--sc-comprehension-low: #ea580c;
--sc-comprehension-misread: #dc2626;
--sc-confidence-high: #16a34a;
--sc-confidence-uncertain: #d97706;
--sc-confidence-inverted: #dc2626;
```

### Existing patterns to reuse

- `.sc-persona-card` pattern → reuse for Decision Mirror persona cards
- `.sc-gauge-bar` / `.sc-gauge-fill` → reuse for divergence score and accuracy score bars
- `.sc-suggestion-persona-pill` pattern → reuse for missed terms chips
- `.sc-dist-row` pattern → reuse for signal grid rows
- `.trainer-filter-chip` pattern → reuse for persona pill strip selector

### Responsive breakpoints

```css
@media (max-width: 768px) {
  .sc-readability-layout { flex-direction: column; }  /* HIGH: fix existing */
  .sc-audit-layout { flex-direction: column; }
  .sc-mirror-grid { grid-template-columns: 1fr; }
  .sc-lens-persona-strip { flex-wrap: nowrap; overflow-x: auto; }
}
```

### Focus states (fix HIGH audit finding H1, H2)

```css
.sc-tab:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}
.sc-summary-row:focus-visible {
  outline: 2px solid var(--sc-accent);
  outline-offset: -2px;
}
```

---

## Part 5: Accessibility Requirements

1. **Tab roles**: All new tab panels must have `role="tabpanel"` and `aria-labelledby` pointing to their tab button.
2. **Live regions**: Status changes (persona switch in What They Heard, concept activation in Assumption Audit) should use `aria-live="polite"` on the content region.
3. **Comprehension badges**: Must not rely on color alone. Include text label inside the badge (HIGH / MEDIUM / LOW / MISREAD) — never just a colored dot.
4. **Signal pass/fail**: Must not rely on color alone. Use `✓` / `✗` symbols alongside green/red color.
5. **Card grid**: Cards must have a logical heading structure. Each persona card should contain an `<h3>` with the persona name.
6. **Keyboard navigation in pill strip**: Arrow keys should move between persona pills (roving tabindex pattern), matching ARIA Tabs pattern.
7. **Contrast**: All comprehension/confidence badge text must meet WCAG AA (4.5:1) contrast against their background. The amber `#ca8a04` on white passes; verify amber-on-amber-tint backgrounds.
8. **Tooltip content**: The `title` attribute used on signal cells is not keyboard-accessible. Signal detail text should also be accessible via a focusable `<details>` or button pattern.
