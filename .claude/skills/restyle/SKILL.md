# Restyle Skill — Demographic-Aware UI Redesign

This skill redesigns the dashboard UI to better appeal to the app's target users: backcountry adventurers aged ~18–55 who ski, snowboard, splitboard, or ski tour in avalanche terrain.

## User Demographics (from COM-B analysis)

**Core personas:**
- **Backcountry Recreationist** (18–45): Skiers, snowboarders, splitboarders. Visually oriented, mobile-first, trust peer reports, adrenaline-aware but safety-conscious. Respond to bold visuals, clear hierarchy, and concise action-oriented language.
- **Ops Staff** (25–55): Avalanche professionals, patrol, SAR. Need dense information at a glance, efficient workflows, no visual noise.
- **Field Observer** (18–55): Anyone outdoors reporting conditions. Mobile-first, minimal friction, reward-driven.

**Key design preferences:**
- Bold, high-contrast typography (outdoor brands: Patagonia, Black Diamond, Arc'teryx aesthetic)
- Clean information hierarchy — most critical info first
- Mobile-responsive (many users check on phone at the trailhead)
- Trust signals — data sources, timestamps, AI confidence visible
- Action-oriented language ("Stay out", "Check before you go", "Conditions: Dangerous")

## When to invoke this skill

Use this skill when the user asks to:
- Redesign or restyle the dashboard
- Make the UI feel more "outdoorsy" or better match the user base
- Improve visual hierarchy or readability
- Apply a specific theme to match a brand or aesthetic

## Redesign Process

### Step 1 — Audit the current UI

Read the current `src/projects/dashboard/styles.css` and `index.html` to understand:
- What CSS variables are already defined (`--app-*` in `:root`)
- Which hardcoded hex colors exist (candidates for variable migration)
- Which components exist (header, zone cards, modal, panels)

### Step 2 — Identify the target aesthetic

Choose or confirm the theme target from these archetypes:

| Archetype | Colors | Feel | Best for |
|---|---|---|---|
| **Summit** (default) | Deep navy, electric blue | Technical ops dashboard | Ops staff |
| **Powder** | Clean white, blue | Crisp mountain morning | Recreationists who prefer light UI |
| **Storm** | Near-black, cyan | High-alert drama | High-stakes monitoring |
| **Topo** | Warm earth, gold | Map-room, adventure | Mixed audience, warmth |

### Step 3 — Apply changes

**CSS approach:**
1. All new color/spacing values go through `--app-*` CSS custom properties in `:root`
2. Theme overrides use `[data-theme="name"]` attribute selectors on `body`
3. For broad redesigns: migrate hardcoded hex colors to CSS variables
4. Typography: use `font-size` steps (0.75/0.8/0.85/0.9/1/1.1/1.25/1.5/2rem)

**Typography for outdoor brand feel:**
```css
/* Bold, tracked headings */
.zone-name { font-weight: 800; letter-spacing: -0.5px; }
/* Danger labels: all-caps, tracked */
.danger-badge { text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
/* Data: monospace or tabular nums */
.stat-value { font-variant-numeric: tabular-nums; font-weight: 600; }
```

**Card design for outdoor feel:**
```css
/* Thick accent bars, bold borders */
.zone-card-accent { height: 4px; border-radius: 4px 4px 0 0; }
/* Subtle texture on cards */
.zone-card { background: var(--app-card); border-top: none; }
/* Hover: lift effect */
.zone-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
```

**Mobile-first breakpoints:**
```css
@media (max-width: 600px) {
  .zones-grid { grid-template-columns: 1fr; }
  body { padding: 1rem; }
  h1 { font-size: 1.4rem; }
}
```

### Step 4 — Validate

After changes:
```bash
bun run check
```

Static files in `src/projects/dashboard/` are excluded from lint — focus on TypeScript files only for the check.

## Quick Redesign Recipes

### "Make it feel more like an outdoor app"
1. Increase font-weight on headings to 800
2. Add `letter-spacing: -0.5px` to zone names
3. Increase danger badge contrast and padding
4. Add hover lift to zone cards
5. Increase accent bar thickness from 4px to 6px

### "Better mobile experience"
1. Add `@media (max-width: 600px)` breakpoints
2. Make zone cards single-column on mobile
3. Increase tap target sizes (min 44px height for buttons)
4. Sticky header on mobile

### "Improve data readability"
1. Use tabular-nums for all numeric values
2. Increase contrast ratio for muted text (target 4.5:1 for WCAG AA)
3. Add visual separators between data groups
4. Use consistent icon sizing (20px base)

### "Apply a new color theme"
Update the `[data-theme="name"]` block in styles.css with new `--app-*` values.
See `:root` for the full list of variables to override.
