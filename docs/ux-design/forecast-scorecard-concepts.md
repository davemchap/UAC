# Forecast Usability Scorecard — Design Concepts

**Project**: UAC Forecast Usability Score
**Primary Users**: Chad Bracken (UAC Director of Operations) and UAC Forecasters
**Purpose**: Help forecasters understand how readable and actionable their daily forecasts are across different user personas, so they can improve their writing.
**Date**: 2026-04-03

---

## Background

Avalanche forecasts serve a wide spectrum of readers — from weekend skiers making a go/no-go call to professional guides who need precise technical language. A forecast that reads well for one group may be opaque or misleading for another. This tool gives forecasters a structured lens to evaluate and improve their writing before it goes public.

The four synthetic personas — Casual Recreationist, Experienced Backcountry Traveler, Guide/Avalanche Educator, and Snow Safety Professional — represent distinct comprehension profiles. They do not use this tool; they are the subjects of analysis. Chad and the forecasters are the users.

---

## Solution 1 — "Readability Lens"

### Problem Statement

We have observed that avalanche forecasts contain technical language and uneven section clarity, which is causing some user segments to misread danger levels or skip sections that contain critical information.

### Outcome Target

Forecasters can identify, at a glance, which specific phrases and sections are readable for which personas — and revise problem areas before publishing. The measurable improvement is a reduction in cross-persona comprehension variance and an increase in average readability scores across all four personas.

### Improvement Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Average forecast reading grade level (Flesch-Kincaid) | Grade 11.2 | Grade 8.5 |
| % of forecasts with at least one "red" (inaccessible) section for the Casual Recreationist persona | 68% | 25% |
| Cross-persona comprehension variance score (std dev across 4 personas) | 3.4 | 1.8 |

### Solution Hypothesis

We believe surfacing a phrase-level readability breakdown by persona will reduce confusing technical language in published forecasts for all forecasters, because forecasters currently lack a per-audience signal and default to writing for technical peers — which we will know is true when the average Casual Recreationist persona score increases by at least 20 points within 30 publishing days.

### UI Design Concept

**What the user sees first:**
The hero is the forecast text itself — the full day's forecast rendered in a readable column — with inline color highlights overlaid on the text. Highlights are persona-keyed: each persona has a color, and phrases are underlined in that color when they score below threshold for that persona. A compact legend sits above the text column showing the four persona colors. No score numbers appear until the user hovers or taps a highlight.

**How persona scores are displayed:**
A fixed sidebar to the right of the forecast text shows four persona cards, stacked vertically. Each card shows:
- Persona name and a small icon/avatar
- A horizontal bar gauge (0–100) filled in the persona color
- Three sub-scores below the gauge: Clarity, Actionability, Jargon Load — each as a small pill with a number and up/down arrow vs. yesterday's score

The sidebar updates live as the forecaster edits the forecast text (if editing is in scope) or stays static for review mode.

**How historical trends are shown:**
Below the persona sidebar, a compact sparkline chart shows the last 14 days of overall readability score per persona as four overlapping lines (each in persona color). Hovering a point shows the forecast date and score. A 7-day rolling average line is shown in a neutral gray behind the persona lines.

**What actions the forecaster can take:**
- Hover any highlight in the forecast text → tooltip shows which persona is affected, why the phrase scored low (e.g., "Grade 14 sentence", "undefined jargon: 'PWL'"), and a "See suggestion" link
- Click "See suggestion" → a slide-in drawer shows the flagged phrase, a plain-language alternative, and a button to copy the suggestion to clipboard
- Toggle individual persona highlights on/off using the legend checkboxes
- Export a PDF report of the scored forecast for team review

**Visual Design Direction:**
- Color system: Each persona has a distinct, accessible color — Casual Recreationist: amber (#F59E0B), Experienced Traveler: teal (#0D9488), Guide/Educator: indigo (#6366F1), Snow Safety Pro: slate (#64748B). Red is reserved for "critical" threshold violations only, not persona identity.
- Typography: The forecast text renders in a large, comfortable serif (e.g., Georgia or a humanist serif) to match reading context. UI chrome (sidebar, labels, scores) uses a clean sans-serif (Inter or equivalent).
- Data viz style: Flat, minimal. Bar gauges use the persona color at full saturation. Sparklines are thin strokes, no fill, with subtle grid lines. No drop shadows or decorative gradients.
- Density: The forecast text column takes ~60% of the viewport. The sidebar takes ~30%. 10% is margin. Mobile collapses to a tab switcher between "Forecast" and "Scores".

### Key User Flows

**Flow 1 — Daily Morning Review**
1. Chad opens the Forecast Usability Scorecard dashboard for today's date.
2. The system has automatically scored overnight's published forecast.
3. Chad sees the forecast text with highlights already applied and the sidebar showing today's four persona scores.
4. He notices the Casual Recreationist score dropped 12 points vs. yesterday. He scans the amber highlights in the forecast text.
5. He hovers the largest amber highlight ("persistent weak layer below 9,000 feet with a large natural cycle possible") and sees the tooltip: Grade 16 sentence, undefined term "PWL", "natural cycle" not explained.
6. He clicks "See suggestion" and reads the plain-language alternative. He forwards it to the forecaster who wrote today's forecast via a "Share note" button.

**Flow 2 — Pre-Publish Check**
1. A forecaster finishes writing today's forecast in the UAC CMS.
2. Before publishing, they paste the draft text into the Readability Lens scorecard input.
3. The scorecard scores the draft and shows highlights inline.
4. The forecaster sees a red threshold violation for the Casual Recreationist in the "What to do" section — the action guidance is buried in the fourth sentence of a long paragraph.
5. They revise the section, re-paste, and see the Casual Recreationist score move from 41 to 67.
6. They publish with confidence.

**Flow 3 — Team Weekly Trend Review**
1. Chad opens the 14-day trend view for the prior week's forecasts.
2. He filters to show only the Casual Recreationist and Experienced Traveler persona lines.
3. He sees a dip in both scores midweek, correlating to a complex storm cycle with multiple avalanche problems.
4. He uses this as a discussion point in the Friday forecaster debrief — "our clarity drops when we have 4+ problems to communicate."
5. He exports the trend chart as a PNG for the team slide deck.

---

## Solution 2 — "Persona Journey"

### Problem Statement

We have observed that forecasters write forecasts as documents rather than as decision support tools, which is causing different user types to reach different (and sometimes wrong) go/no-go conclusions from the same forecast.

### Outcome Target

Forecasters can simulate how each persona navigates the forecast and where they make incorrect or uninformed decisions — enabling structural and sequencing improvements that lead to better decision alignment across personas.

### Improvement Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| % of persona simulations ending in a "correct" go/no-go decision (aligned with forecaster intent) | 54% | 80% |
| Average number of forecast sections a Casual Recreationist persona reaches before abandoning (scroll depth proxy) | 1.8 of 5 sections | 3.5 of 5 sections |
| % of forecasts where all 4 persona journeys agree on the correct go/no-go outcome | 22% | 55% |

### Solution Hypothesis

We believe showing a simulated step-by-step decision path for each persona through the forecast will improve structural clarity and decision alignment for forecasters, because seeing where a persona "goes wrong" is a more visceral and actionable signal than a readability score — which we will know is true when the % of persona journeys ending in a correct decision increases by 20 percentage points within 60 days.

### UI Design Concept

**What the user sees first:**
The hero is a four-column journey map — one column per persona — displayed side by side like a user story map. Each column shows the forecast sections as rows (e.g., Danger Rating → Avalanche Problems → Mountain Weather → Planning & Travel → What to Do). At each cell intersection, a decision state icon shows what the persona "does" at that section: reads and understands (green check), reads and misunderstands (orange warning), skips (gray dash), or makes a wrong call (red X).

**How persona scores are displayed:**
Each persona column has a header card showing:
- Persona name and avatar
- Final decision outcome: "Correct go/no-go", "Wrong call", or "Abandoned forecast" — shown as a large pill with color (green, red, gray)
- A confidence score (0–100) representing how certain the simulated persona is in their decision
- An "attention span" indicator showing how far into the forecast the persona read before deciding

**How historical trends are shown:**
A toggle at the top switches between "Today's Journey" and "30-Day Journey Trends". In trend view, the four columns collapse into a stacked area chart showing the percentage of days each persona reached a correct decision. A second chart below shows average scroll depth per persona per day. Both charts use the same persona color system.

**What actions the forecaster can take:**
- Click any cell in the journey map → a detail drawer opens showing the exact forecast text for that section, the simulated persona interpretation, and the reasoning behind the decision state (e.g., "Casual Recreationist encountered the phrase 'dangerous avalanche conditions on steep slopes' and categorized this as a warning but did not connect it to their planned terrain")
- Click "Rewrite this section" → opens a side-by-side editor showing the original text and a text area for a revision; the journey map cell updates its state when the revision is pasted in
- Pin a specific journey map to a date for comparison (e.g., compare today's forecast to a similar past storm day)
- Share a specific persona's journey as a link to send to the forecaster who wrote that section

**Visual Design Direction:**
- Color system: Decision states use a universal signal set — green (#16A34A) for correct, amber (#D97706) for uncertain/misunderstood, red (#DC2626) for wrong call, gray (#9CA3AF) for abandoned/skipped. Persona identity uses subtle header tinting (not the full column).
- Typography: Column headers use a bold, condensed sans-serif to maximize horizontal density. Section labels use a medium-weight sans. Decision state labels use small caps.
- Data viz style: The journey map is the primary visualization — a table-like grid with icon-based states rather than numeric scores. Charts in trend view use filled area with 20% opacity fills and solid 2px strokes. Grid lines are minimal.
- Density: The four-column layout is dense by design — it needs to show all four personas and all five forecast sections simultaneously. Horizontal scrolling is avoided; columns compress on smaller screens. A "focus mode" expands a single persona column to full width for deeper analysis.

### Key User Flows

**Flow 1 — Identifying a Structural Problem**
1. A forecaster opens today's Persona Journey scorecard after publishing.
2. They see all four persona columns. Three show "Correct" final decisions, but the Casual Recreationist column shows "Wrong call" — the persona decided conditions were safe enough to ski their planned terrain.
3. They click the red X cell in the Casual Recreationist column at the "Danger Rating" row.
4. The drawer shows: "The Casual Recreationist read 'Considerable (3)' but has no frame of reference for what Considerable means in practice. They treated it as a moderate warning, not a high-risk signal."
5. The forecaster realizes the danger rating section needs a plain-language consequence sentence. They note this for tomorrow's forecast.

**Flow 2 — Comparing Two Similar Storm Days**
1. Chad pins today's forecast journey map.
2. He searches for a similar storm day from the previous season using the date picker.
3. A split-screen comparison shows both journey maps side by side.
4. He notices the Guide/Educator persona made a wrong call on both days in the "Avalanche Problems" section — both days featured a buried weak layer with poor description.
5. He identifies a recurring structural gap and adds it to the forecaster training agenda.

**Flow 3 — Pre-Publish Structural Check**
1. A forecaster drafts tomorrow's forecast.
2. They run it through the Persona Journey tool before publishing.
3. The tool shows the Experienced Traveler persona abandons the forecast at section 3 (Mountain Weather) — the section is too long and the key hazard information is buried.
4. The forecaster moves the key hazard sentence to the top of the section and re-runs the simulation.
5. The Experienced Traveler now reaches section 5 and makes a correct decision. The forecaster publishes.

---

## Solution 3 — "Forecaster Coach"

### Problem Statement

We have observed that forecasters receive no structured feedback on their writing quality after publishing, which is causing the same clarity and accessibility issues to recur across forecasters and across storm types without a path to improvement.

### Outcome Target

Forecasters receive specific, actionable coaching on their writing — not just a score — and can see measurable improvement in their own forecasts over time. The result is a continuous improvement loop that raises average readability and decision accuracy across the entire forecaster team.

### Improvement Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| % of forecasters who receive and act on at least one writing suggestion per week | 0% (no system exists) | 70% |
| Average improvement in overall usability score after a forecaster applies a suggested rewrite (within same session) | N/A | +18 points |
| 90-day trend: average team forecast usability score | Baseline TBD at launch | +15 points above baseline |

### Solution Hypothesis

We believe a coaching interface that pairs each low-scoring forecast section with a specific suggested rewrite — and shows the before/after score impact — will drive sustained forecast quality improvement for individual forecasters, because seeing a concrete suggestion is more actionable than seeing a low score alone — which we will know is true when 70% of forecasters apply at least one coaching suggestion per week within 60 days of launch.

### UI Design Concept

**What the user sees first:**
The hero is a "Today's Coaching Report" card — a personalized summary addressed to the forecaster who wrote that day's forecast. It shows:
- An overall usability grade (A–F letter grade, color-coded) in large type
- A one-sentence summary: "Today's forecast is strong for technical readers but loses Casual Recreationists in the first 60 words."
- A "3 things to improve" list — the top three coaching suggestions for today, each with a persona icon, section label, and one-line preview of the suggestion.

Below the hero, the full forecast is rendered with coach annotations — a margin annotation system like a tracked-changes view in a document editor.

**How persona scores are displayed:**
A score panel sits above the annotated forecast. It shows four persona tiles in a horizontal row, each with:
- Persona name and icon
- Letter grade (A–F) in a large colored circle
- A trend arrow vs. the forecaster's own 30-day average for that persona (not the team average — this is personal feedback)
- A "biggest issue" label (e.g., "Jargon overload", "Buried action", "Section too long")

**How historical trends are shown:**
A "Your Progress" section below the forecast shows a personal improvement dashboard:
- A 30-day line chart of the forecaster's overall usability score
- A "personal best" callout (e.g., "Your best forecast: March 14 — score 91")
- A "coach's eye" summary of recurring patterns: "You consistently score lower when there are 3+ avalanche problems. Consider a bulleted problem list instead of prose."
- A team comparison percentile bar (anonymous): "You are in the 72nd percentile for Casual Recreationist clarity across the forecaster team."

**What actions the forecaster can take:**
- Click any margin annotation → expand a coaching card showing: original text, problem diagnosis, suggested rewrite, and a score preview ("Applying this suggestion would raise your Casual Recreationist score from 44 to 71")
- Click "Apply suggestion" → the suggested text is copied to clipboard and the annotation is marked as "reviewed"
- Click "Not helpful" on any suggestion → the suggestion is dismissed and logged (used to improve the coaching model over time)
- Click "Share with Chad" → sends the coaching report to Chad's daily digest
- Click "See team patterns" → opens a read-only view of anonymized team-level coaching patterns (Chad's view, available to all forecasters for context)

**Visual Design Direction:**
- Color system: The letter grade color scale runs from green (A: #16A34A) through yellow (B: #CA8A04), orange (C: #EA580C), red (D/F: #DC2626). Persona tiles use their identity colors (matching Solution 1's palette) for persona association. Coaching annotation markers in the margin use a soft gold (#F59E0B) to signal "attention here" without alarm.
- Typography: The coaching report header uses a bold, editorial sans-serif at large size — this should feel like a report card, not a dashboard. Annotation text uses a slightly smaller, lighter weight of the same family. The forecast text renders in a comfortable reading font (serif or legible sans).
- Data viz style: The personal progress chart is the emotional centerpiece — it should feel motivating, not punitive. Use a smooth line with a subtle gradient fill below it. Mark the personal best with a gold star. Keep the chart clean — one line, no grid clutter.
- Tone: This is a coaching tool, not a grading tool. All labels and suggestion copy should use coaching language: "Consider...", "This phrase may confuse...", "A stronger version might be..." — never "Wrong" or "Error."

### Key User Flows

**Flow 1 — Forecaster Reviews Their Own Coaching Report**
1. A forecaster publishes today's forecast and opens the Forecaster Coach scorecard.
2. The hero card greets them: "Nice work today — your Guide/Educator score hit a personal best. Here are 3 ways to bring the other personas up."
3. They read the three suggestions in the hero list. Two look relevant, one doesn't apply (it flagged a term they intentionally used for precision).
4. They click the first suggestion — it covers the "Avalanche Problems" section. The coaching card shows the original paragraph and a bulleted rewrite. The score preview shows +22 points for Casual Recreationist.
5. They copy the suggestion, mark it "Applied", and note it for tomorrow's draft.
6. They click "Not helpful" on the third suggestion and add a note: "Technical term required here."

**Flow 2 — Chad's Weekly Team Review**
1. Chad opens the Team Patterns view on Friday morning.
2. He sees an anonymized heatmap of which forecast sections triggered the most coaching suggestions across the team for the week.
3. "Mountain Weather" and "Travel Advice" are the hottest cells for Casual Recreationist.
4. He drills into Mountain Weather and sees the top recurring pattern: "Weather section leads with synoptic overview before stating hazard implications — Casual Recreationist loses context."
5. He prepares a 5-minute discussion for the team debrief with a specific example from the week (names removed).

**Flow 3 — New Forecaster Onboarding**
1. A new forecaster joins the UAC team and is introduced to the Forecaster Coach tool.
2. They write their first solo forecast draft and run it through the coach before publishing.
3. The tool shows an overall grade of C+ with 6 coaching suggestions.
4. They work through the suggestions one by one, applying 4 of them. Their live score updates after each application.
5. The final score is a B+. They publish feeling more confident about readability.
6. Over their first 30 days, the personal progress chart shows steady improvement — a visible record of their writing development.

---

## Appendix: Design Principles Across All Three Solutions

1. **Scores serve writing, not judgment.** Numeric scores and grades are tools for improvement, not performance evaluations. All solutions should present scores in a context of "here's how to get better" rather than "here's what you did wrong."

2. **Forecasters are experts.** The tool should respect that forecasters are domain experts writing under time pressure. Suggestions are offers, not mandates. Any "apply" action should copy text rather than auto-edit.

3. **Persona simulation is synthetic.** The personas are models, not real users. The tool should never overstate certainty — "this phrase may confuse" is more appropriate than "this phrase is wrong."

4. **Historical context is motivating.** Showing trends over time — especially personal improvement — is a key engagement mechanism. Progress charts should be visible and positive in framing.

5. **Mobile is a secondary surface.** Forecasters primarily use this tool on desktop in the morning workflow. Mobile views should exist but can collapse to summary-only.

6. **Performance matters.** Forecast scoring should complete in under 3 seconds. If AI-assisted suggestions are used, they should be pre-generated (overnight or at publish time), not on-demand.
