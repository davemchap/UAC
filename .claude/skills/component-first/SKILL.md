# Component-First Architecture Skill

Enforces the Polylith-inspired architecture rule: all logic lives in `src/components/`, thin wiring lives in `src/projects/` and `src/bases/`.

## Where Code Belongs

| Type | Location | Rule |
|------|----------|------|
| Business logic, data transformation, pure functions | `src/components/<name>/index.ts` | No framework imports, fully testable in isolation |
| HTTP route handlers | `src/bases/http/routes/<name>.ts` | Thin — call component functions, return responses. No logic. |
| Static front-end | `src/projects/dashboard/` | Vanilla JS/HTML/CSS only. Fetch from API, render. No logic. |
| Server entry point | `src/bases/http/app.ts` | Wire routes. One line per route. No logic. |

## What Counts as "Logic" vs "Wiring"

**Logic** (→ component):
- Data transformation (mapping, filtering, merging data structures)
- Business rules (thresholds, escalation, scoring)
- Calculations (danger levels, averages, aggregations)
- Type definitions used across multiple callers

**Wiring** (→ base or project):
- `app.route("/api/foo", fooRoutes)` — one-line route registration
- `c.json(component.getData())` — call component, return result
- DOM manipulation and fetch calls in front-end JS
- Importing and composing components together

## Checklist Before Completing Any Coding Task

- [ ] All new pure functions are in `src/components/`
- [ ] No business logic in `src/bases/http/routes/` — routes call components, not implement logic
- [ ] No logic in `src/projects/dashboard/*.js` — only fetch + render
- [ ] New components export only what external callers need
- [ ] No circular dependencies (`bun run circular` passes)
- [ ] `bun run check` passes with zero errors and zero warnings

## Example: Correct Pattern

```typescript
// src/components/zone-map/index.ts — logic lives here
export function getMapZoneData(config: ZoneConfig[]): MapZoneData[] {
  return config.map(zone => ({ ...zone, alert: generateAlert(assessZone(getZoneData(zone.slug))) }))
}

// src/bases/http/routes/map.ts — thin wiring
map.get("/map-data", (c) => c.json({ zones: getMapZoneData() }))
```

## Example: Wrong Pattern (Don't Do This)

```typescript
// ❌ Logic inside a route handler
map.get("/map-data", (c) => {
  const zones = loadZoneConfig().map(zone => {
    const data = getZoneData(zone.slug)
    const assessment = assessZone(data)  // business logic in route!
    return { ...zone, alert: generateAlert(assessment) }
  })
  return c.json({ zones })
})
```
