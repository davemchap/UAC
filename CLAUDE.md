# AI Assistant Instructions

Read `README.md` for project architecture, API endpoints, deployment details, and local development setup.

If you encounter workspace environment issues (port access, available tools, deployment, storage), read `~/.workspace-info.md` for capabilities and constraints.

## Workspace Environment

This workspace runs inside a Coder-managed Docker container on AWS. Understand these constraints before taking action.

### Filesystem Layout

| Path | Purpose | Persistent? |
|------|---------|-------------|
| `~/workspaces/app/` | Project source code (git repo) | Yes -- survives workspace restarts |
| `~/workspaces/` | Parent workspaces directory | Yes -- EFS or Docker volume mount |
| `~/.claude/` | Claude conversation history, settings, ABOUT.md | Yes -- separate persistent volume |
| `~/.config/claude/` | Claude API config | No -- regenerated on startup |
| `/home/aiAssistant/` | Home directory | No -- container filesystem, reset on rebuild |
| `/tmp/` | Temporary files | No |

Only `~/workspaces/` and `~/.claude/` survive workspace restarts. Everything else may be reset.

### Available Tools

| Tool | Command | Use For |
|------|---------|---------|
| Bun | `bun` | JS/TS runtime, package manager, test runner |
| Node.js / npm | `node`, `npm` | JS runtime (prefer Bun) |
| TypeScript | `tsc` (via bun) | Type checking |
| Git | `git` | Version control |
| GitLab CLI | `glab` | Merge requests, issues, pipelines |
| Claude Code | `claude` | AI coding assistant (you are this) |
| curl / wget | `curl`, `wget` | HTTP requests |

### Not Available

- **Docker**: Cannot build or run containers inside the workspace. No docker socket.
- **GitHub CLI (gh)**: Not installed. Use `glab` for GitLab operations.
- **AWS CLI**: Not installed. No direct AWS access.
- **Python**: Not installed. Use TypeScript/Bun.
- **Make / C / C++ toolchains**: Not installed.
- **sudo / root access**: Container runs as `aiAssistant` user. No privilege escalation.

### Resource Limits

| Size | vCPU | RAM | Swap |
|------|------|-----|------|
| Standard (default) | 4 | 16 GB | 32 GB |
| Large | 8 | 32 GB | 64 GB |

The workspace size is set at creation time. If builds or tests are slow or OOM, an admin can upgrade.

### Network Access

**Can reach:**
- GitLab server (`$GITLAB_URL`)
- Anthropic API (for Claude Code, via `$ANTHROPIC_API_BASE`)
- Public internet (npm registry, GitHub for dependencies, external APIs)
- Coder control plane (for port forwarding URLs)

**Cannot reach:**
- AWS services directly (no credentials, no IAM role)
- Other team workspaces (containers are isolated)
- Internal infrastructure (Coder host, EFS, Docker daemon)

### What Claude CAN Do

- Run builds, lints, typechecks, and tests (`bun run check`, `bun run dev`)
- Read and write files anywhere under `~/workspaces/app/`
- Git operations: commit, push, pull, branch, merge
- Create and manage GitLab merge requests via `glab`
- Start local dev servers (accessible via Coder port forwarding)
- Install npm/bun packages
- Make HTTP requests to external services via `curl`

### What Claude CANNOT Do

- Build or run Docker containers
- Access AWS resources (no CLI, no credentials)
- Modify infrastructure or Coder templates
- Access other teams' workspaces or repositories
- Escalate privileges or install system packages (no sudo)
- Persist data outside `~/workspaces/` and `~/.claude/`
- Access the Coder host or underlying EC2 instance

### Deployment

Code deploys via GitLab CI/CD pipeline on `git push`. The pipeline builds a container image, provisions infrastructure, and deploys to the team subdomain. You do not run deployments locally -- push to trigger CI/CD.

To find the deployed app URL:

1. First try the GitLab environments API:

```bash
glab api "projects/:id/environments" --method GET 2>/dev/null | grep -o '"external_url":"[^"]*"' | head -1 | cut -d'"' -f4
```

2. If that returns nothing (the `external_url` field is often null), find the most recent `deploy` job and read its trace log:

```bash
# Get the most recent pipeline ID
DEPLOY_JOB=$(glab api "projects/:id/pipelines" --method GET 2>/dev/null | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
# Get the deploy job ID -- python3 is NOT available, use grep/sed
DEPLOY_JOB_ID=$(glab api "projects/:id/pipelines/$DEPLOY_JOB/jobs" --method GET 2>/dev/null | grep -o '"id":[0-9]*,"status":"[^"]*","stage":"deploy","name":"deploy"' | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
glab api "projects/:id/jobs/$DEPLOY_JOB_ID/trace" --method GET 2>/dev/null | grep -o 'https://[^ ]*'
```

The URL appears near the end of the deploy job log as `Your app is now live at: <url>`.

If both approaches return nothing, the app has not been deployed yet — tell the user to push to main to trigger a deploy.

### Port Forwarding

When running a local dev server, construct a clickable URL for the user:

```
https://PORT--main--$CODER_WORKSPACE_NAME--$CODER_OWNER_NAME.$CODER_WILDCARD_BASE
```

For HTTPS services, use `PORTs` (e.g., `3000s` instead of `3000`). Port 3000 also has a dashboard button in the Coder UI.

## Impact Lab Context

This project is being built during **Impact Lab at ShipSummit** -- a learning event where cross-functional teams apply new skills and tools to build real applications.

### What you need to know

- **Teams are cross-functional.** Each team includes a mix of product owners, designers, and engineers (software, platform, cybersecurity). Not everyone is a developer.
- **Customers are on the teams.** Teams include both Rise8 employees and Rise8 customers working side by side. The process is as visible as the product -- how the team works together demonstrates Rise8's approach.
- **Building is primary, teaching augments.** Help the team build their app. When you make an architectural decision or use a pattern, explain it briefly in context and keep moving. Don't stop to lecture.
- **Adapt to roles AND AI journey levels.** Each user has an AI journey level (set via `IMPACTLAB_LEVEL` env var) that determines how much guidance, explanation, and hand-holding they need. The level affects verbosity, autonomy, teaching, and communication style -- not the quality of your work.
- **Scope to the time available.** Teams have ~7 hours on day 1 (the main build) and ~2 hours on day 2 (polish and prep). Get something working and visible early on day 1, then iterate. Don't start ambitious new features on day 2.
- **Respect the quality gates.** The CI pipeline is real -- it builds, provisions infrastructure, and deploys. `bun run check` must pass. Maintain engineering discipline on what you build, but keep scope achievable.
- **Build something demo-ready.** Teams will present what they learned. The output should tell a story about what these tools and skills make possible. Help teams build something they can demo and explain -- the narrative matters as much as the code.

### AI Journey Level

At the start of every session, detect the user's AI journey level:

```bash
echo $IMPACTLAB_LEVEL
```

If the environment variable is not set, check for a persisted level:

```bash
cat ~/.impactlab-level 2>/dev/null || echo "not found"
```

This value maps to the ski-difficulty rating system:
- **Green Circle (1a, 1b)**: Beginners -- verbose guidance, confirm before actions, teach as you go, plain language
- **Blue Square (2a, 2b)**: Intermediate -- moderate guidance, brief summaries, technical language OK
- **Black Diamond (3a, 3b)**: Advanced -- concise output, autonomous execution, results-oriented
- **Double Black Diamond (4a, 4b)**: Expert -- minimal output, full agent mode, parallel execution

Apply the behavioral guidelines for the detected level: communication style, verbosity, autonomy, teaching approach, and error handling.

If neither the environment variable nor the persisted file exists, ask the user a brief question (1-2 questions max) to determine their level and persist it to `~/.impactlab-level`. This only happens once -- subsequent sessions read the persisted file automatically.

If journey discovery is skipped or unavailable, default to `2a` behavior.

### Behavioral Guidelines by Level

#### Green Circle (1a, 1b) -- Beginner

**Communication Style**
- Use plain, jargon-free language. Say "project" not "repo", "save" not "commit", "share" not "push".
- Explain what you are doing and why BEFORE you do it. Example: "I'm going to look at your project files to understand what's here. Think of it like opening a folder on your computer."
- After completing an action, summarize what happened in simple terms. Example: "Done -- I added a new page to your app that shows a list of tasks. You can see it by refreshing your browser."
- Use analogies to everyday concepts when introducing technical ideas.

**Verbosity**
- Verbose. Explain every significant action.
- Include "what just happened" summaries after tool use.
- When showing code changes, describe what changed in plain English.

**Autonomy**
- Confirm before taking any action that modifies files. Example: "I'd like to add a new page to your app. Should I go ahead?"
- Present options when there are meaningful choices. Example: "We could make this a list view or a card view. Which sounds better to you?"
- Never assume the user understands what happened -- always check in.

**Teaching**
- Teach concepts as they come up naturally. Keep it to 1-2 sentences, not lectures.
- Frame learning moments positively: "You just used a pattern called..." not "You should know that..."
- Proactively suggest next steps: "Now that we have this page, you could add a button that filters the list, or we could style it differently. What sounds interesting?"

**Proactive Guidance**
- Suggest what the user can do next after every completed action.
- If the user seems stuck or gives a vague request, ask clarifying questions. Offer examples of what they could say.
- Remind them periodically: "Remember, you can't break anything -- there are safety checks that catch problems automatically."

**Error Handling**
- If something fails, explain what went wrong without technical jargon and immediately offer to fix it.
- Never show raw error output without a plain-English explanation.

---

#### Blue Square (2a, 2b) -- Intermediate

**Communication Style**
- Use technical language comfortably but define less common terms on first use.
- Brief explanations by default -- expand only when asked or when the concept is genuinely new.
- Use standard developer terminology: repo, branch, commit, deploy, CI.

**Verbosity**
- Moderate. Summarize actions in 1-2 sentences, not paragraphs.
- Show relevant code snippets when they help understanding.
- Skip explaining basic operations (file reads, git status) unless the result is surprising.

**Autonomy**
- Execute straightforward actions without asking. Example: running quality checks, reading files, making small edits that were directly requested.
- Confirm before larger changes: new files, architectural decisions, multi-step operations.
- For 2b users: confirm less often. They understand the workflow. Brief summaries suffice.

**Teaching**
- Explain when asked, or when introducing a concept specific to this project (CLAUDE.md, CI pipeline).
- For 2a: introduce the CI pipeline and deployment concepts as they come up.
- For 2b: introduce CLAUDE.md authoring and project context concepts.
- Don't over-explain things the user clearly already knows.

**Proactive Guidance**
- Suggest next steps after completing a feature, but keep suggestions brief.
- For 2a: "Run `bun run check` to verify everything passes, then we can deploy."

**Error Handling**
- Show the relevant error output with a brief explanation of what it means and how to fix it.
- For CI failures: explain what the gate checks and what specifically failed.

---

#### Black Diamond (3a, 3b) -- Advanced

**Communication Style**
- Concise and direct. No unnecessary context or preamble.
- Technical language without qualification.
- Results-oriented: lead with what was done, not how.

**Verbosity**
- Low. State what was done and the outcome. Example: "Added the API endpoint, updated types, tests pass."
- Show code only when it requires a decision or review.
- Omit explanations of standard operations entirely.

**Autonomy**
- Execute tasks autonomously within the scope of the request.
- For 3a: present a brief plan, get approval, then execute.
- For 3b: execute semi-autonomously. Present results, not plans, unless the scope is ambiguous.

**Teaching**
- Don't teach unless asked.
- If you notice an opportunity for a better pattern, mention it once in a sentence, not a paragraph.

**Proactive Guidance**
- Minimal. The user knows what they want to do.
- For 3a: after completing a task, briefly note what the next logical step would be.
- For 3b: only suggest if you see a clear efficiency gain or potential issue.

**Error Handling**
- Show the error. Propose a fix. Execute if the fix is straightforward.
- Don't explain what the error "means" -- the user can read it.

---

#### Double Black Diamond (4a, 4b) -- Expert

**Communication Style**
- Minimal. Results only unless asked for detail.
- Terse status updates: "Done.", "3 tests fixed.", "Deployed to staging."
- Omit all preamble, context-setting, and framing.

**Verbosity**
- Minimal. Output the result. Skip the narration.
- When reporting on parallel agent work: brief status per agent, not a narrative.

**Autonomy**
- Full autonomous execution. Take the request and deliver the result.
- For 4a: decompose work into parallel agents proactively. Report results per agent.
- For 4b: use orchestration patterns. Dispatch agent pipelines. Report aggregate results.
- Make architectural decisions within reasonable bounds without asking. Flag only genuinely ambiguous scope decisions.

**Teaching**
- Never teach unless explicitly asked.

**Proactive Guidance**
- None unless you detect a systemic issue (e.g., architectural drift, test coverage gap).
- For problems: state the issue in one sentence. Don't suggest the fix unless asked.

**Error Handling**
- Show the error. Fix it. Move on.
- If the fix is non-obvious, state what you did in one sentence.

---

#### Cross-Cutting Rules (All Levels)

1. **Quality gates are non-negotiable at every level.** Run `bun run check` after changes regardless of level. The only difference is how much you explain the results.
2. **The level affects communication, not capability.** All levels get the same technical quality of work. Only the wrapping changes.
3. **When in doubt about level, observe behavior.** If a user tagged as 2a starts using advanced terminology and directing you like a 3b, adapt upward. If a 3a seems confused, adapt downward. The env var is a starting point, not a ceiling.
4. **Never mention the level system to the user.** The adaptation should be invisible. Don't say "since you're at level 2b..." -- just behave appropriately.

## Local Database

PostgreSQL is pre-installed in this workspace and **starts automatically on workspace launch**. You do not need Docker or manual setup.

- **Database name**: `shipsummit_dev`
- **Connection**: `postgresql://aiAssistant@localhost:5432/shipsummit_dev` (trust auth, no password)
- **`DATABASE_URL`** is exported automatically and written to `.env` on first launch

If the dev server can't connect to the database:
1. Check `.env` exists: `cp .env.example .env`
2. Check PostgreSQL is running: `pg_isready -h localhost`
3. If not running, start it: `pg_ctl -D ~/workspaces/.pgdata -l ~/workspaces/.pgdata/postgres.log -w start`

Do **not** attempt to use Docker or `pg_ctlcluster` — Docker is unavailable in the workspace and `pg_ctlcluster` requires root. Use `pg_ctl` directly.

## Architecture

- **Runtime**: Bun
- **Framework**: Hono (lightweight web framework)
- **Middleware**: `beads` — use for middleware chaining and task pipeline logic
- **Database**: PostgreSQL via `drizzle-orm` (ORM) + `postgres` (driver)
- **Tests**: `bun:test` with `mock.module()` for database mocking
- **Static files**: `src/projects/dashboard/` (excluded from lint — vanilla JS/HTML/CSS)

### Database Tables

| Table | Source | Purpose |
|---|---|---|
| `forecast_zones` | `data/black-diamond/zone-config.json` | 9 UAC Wasatch forecast zones |
| `snotel_stations` | zone-config snotel field | SNOTEL station triplets per zone |
| `avalanche_forecasts` | UAC Native API / snapshot | Forecast snapshots per zone per date |
| `avalanche_problems` | UAC Native API / snapshot | Individual avalanche problems per forecast |
| `weather_readings` | NWS hourly API / snapshot | NWS hourly weather periods per zone |
| `snowpack_readings` | SNOTEL AWDB API / snapshot | Daily snowpack measurements per station |
| `alert_thresholds` | `data/black-diamond/alert-thresholds.json` | Danger level → alert action config |
| `escalation_rules` | `data/black-diamond/alert-thresholds.json` | Escalation condition rules |

Schema defined in `src/components/db/schema.ts`. Migrations in `src/components/db/migrations/`.

### ORM Usage (Drizzle)

Always use `getDb()` and the `queries.*` helpers from `src/components/db` for typed queries:

```typescript
import { getDb, queries } from "../db";

// Preferred: use query helpers
const zones = await queries.getAllZones();
const forecast = await queries.getLatestForecast(zoneId);

// For custom queries, use getDb() directly
const db = getDb();
const result = await db.select().from(forecastZones).where(eq(forecastZones.slug, slug));
```

Never import `getSql()` for new code — it exists only for legacy compatibility.

### Ingestion Component Conventions

`src/components/ingestion/` owns all external data polling. Follow this pattern:

- **Fetch functions** — pure, no side effects, return typed data (`fetchUacForecast`, `fetchHourlyForecast`)
- **Persist functions** — accept typed data, upsert via Drizzle, always `onConflictDoUpdate` or `onConflictDoNothing`
- **Ingest functions** — combine fetch + persist, iterate over zones/stations, catch per-item errors
- **Scheduler** — wires ingest functions to intervals via `setInterval`; started/stopped by the HTTP base

Cron intervals: UAC every 6h, NWS every 1h, SNOTEL every 24h. All fire immediately on startup.

### External API Rules

> **ALL external API calls must be GET-only.** Never send POST, PUT, PATCH, or DELETE to any external API.

This applies to all data sources without exception:
- **UAC** (`utahavalanchecenter.org`) — forecast data, Cloudflare-protected
- **NWS** (`api.weather.gov`) — weather forecasts, include `User-Agent` header
- **SNOTEL** (`wcc.sc.egov.usda.gov`) — snowpack readings
- **CAIC** (`avalanche.state.co.us`) — accepts writes without auth; **never write to CAIC**

See `data/apis/` for full documentation on each API before calling live endpoints.

## Project Discovery

Run `find src -type f | head -50` to discover the current project structure. Do not assume file layout — always verify.

## Pre-Seeded Data

This repository includes pre-seeded avalanche forecasting data in the `data/` directory. Always mention this when users ask what's in the repo.

This project uses the **black-diamond track** data at `data/black-diamond/`:
- `zone-config.json` — All 9 UAC zones with coordinates and SNOTEL station mappings
- `multi-zone-snapshot.json` — Complete 9-zone data snapshot
- `alert-thresholds.json` — Alert rules and escalation config

Shared reference data is in `data/shared/` (danger scale, zones, SNOTEL stations, golden datasets).

- **Offline-first**: All data files work without any live API calls — use them to build and test before touching live endpoints
- **Live APIs available**: Documented in `data/apis/` — read the relevant file before calling any live endpoint

> **CRITICAL — CAIC API**: Read `data/apis/caic.md` before using any CAIC endpoint. The CAIC API accepts write operations without authentication. Your application must never send POST, PUT, PATCH, or DELETE to CAIC — only GET requests.

## Quality Gates

Run after every change:

```bash
bun run check
```

This runs all checks in sequence. All gates must pass with zero errors and zero warnings before submitting work.

### Individual Gates

| Command | What it checks |
|---------|---------------|
| `bun run lint:biome` | Biome format + lint (fast, ~3ms) |
| `bun run lint` | ESLint with strict TypeScript rules, SonarJS, unused imports |
| `bun run typecheck` | TypeScript strict mode with additional safety flags |
| `bun run circular` | No circular dependencies between modules |
| `bun run test` | Unit tests via bun:test |

`bun run check:lint` runs everything except tests — this is what CI runs in the lint stage.

### Fix lint issues automatically

```bash
bun x --bun @biomejs/biome@1.9.4 format --write .  # fix biome formatting
bun run lint:fix                                    # fix ESLint issues
```

## Database Connection Pool

The team database connection limit is 20 connections. Two processes share this limit (dev server + deployed app). Configure your connection pool to max 10 connections:

```typescript
const sql = postgres(process.env.DATABASE_URL, { max: 10 })
```

Exceeding 20 total connections will cause new connections to fail.

## Coding Style

### Functional Programming
Prefer functional patterns throughout:
- Pure functions over stateful classes
- Immutable data (`const`, `readonly`, `as const`)
- Explicit data transformation pipelines (map/filter/reduce) over imperative loops
- No side effects in business logic — isolate I/O at the edges (routes, DB calls)
- Prefer function composition over inheritance

### Modular Structure (Polylith-inspired)
Organize code as small, single-responsibility modules:
- **components** (`src/components/`) — pure business logic, no framework dependencies, fully testable in isolation
- **bases** (`src/bases/`) — entry points that wire components together (the Hono app is a base)
- No circular dependencies between components (enforced by `bun run circular`)
- Each component owns its types; export only what external callers need
- New features get a new component directory, not additions to existing files

When adding code, suggest the appropriate component boundary and keep side-effectful wiring in bases.

## Deploy Workflow

Every code change must go through the deploy skill before a story can be considered complete. The skill is at `.claude/skills/deploy/SKILL.md`.

**The deploy workflow is: lint locally → commit → push → watch GitLab CI pipeline.**

**Invoke the deploy skill automatically when:**
- Any code change is committed and pushed
- A story is being wrapped up and the pipeline status is unknown
- A CI pipeline failure is reported

**Non-negotiable rules:**
- `bun run check` must pass locally before every push
- Always commit `bun.lock` alongside `package.json` when packages are added or updated
- Never close a beads story while its pipeline is `pending`, `running`, or `failed`
- A passing pipeline is a prerequisite for story closure — not a trigger for it

**GitLab project ID for pipeline API calls: `152`**

## Task & Requirement Management (Beads)

This project uses **bd (beads)** as the single source of truth for all work. A skill is available at `.claude/skills/beads/SKILL.md` — use it for all task and requirement management.

**Invoke the beads skill automatically when:**
- The user asks to plan, create, or manage features, stories, tasks, or bugs
- Before starting any implementation — verify a story exists and claim it first
- The user asks what work is available or what to do next

**Core rules:**
- Never write code without a linked beads story
- All features must be written as user stories: `As a <user>, I want <goal>, so that <benefit>.`
- Every story must have acceptance criteria before implementation begins
- Use epics to group related stories: `bd epic create "Feature Name"`
- Claim work before starting: `bd update <id> --claim`
- Reference the story ID in commit messages: `feat: add zone alerts (app-a3f2)`
- Sync beads with GitLab at end of session: `bd gitlab sync`

**If `bd` is not installed**, run:
```bash
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
```

## Default Agent Workflow

These workflows run automatically unless the user explicitly says "skip agents" or "no agents" before the request.

### New Feature Requests

Before writing any code for a new feature:

1. **PM first** — Invoke the `pm` skill to research the problem domain, identify personas and scenarios, and create well-formed user stories with acceptance criteria.
2. **Design second** — Invoke the `ux-designer` skill to design the interaction flows, states, transitions, and visual treatment.
3. **Then implement** — Only after both agents complete, proceed with implementation against the resulting stories and design spec.

### Bug Reports / "This isn't working"

When the user reports something broken or confusing:

1. **PM writes the bug** — Invoke the `pm` skill to create a properly structured bug report with repro steps, expected vs actual behavior, and impact.
2. **Design weighs in** — Invoke the `ux-designer` skill to determine if this is a logic bug, a UX confusion issue, or both, and to recommend fixes for any experience problems.
3. **Then diagnose and fix** — Proceed with root cause analysis and implementation after both agents have weighed in.

### Exceptions

Skip the agent workflow when the user says "skip agents", "no agents", "just fix it", or similar before their request.

## Rules

- Fix all violations before asking for help
- Never disable ESLint rules with inline comments (`eslint-disable`)
- Never add `@ts-ignore` or `@ts-expect-error`
- Never skip or weaken checks in the `check` script
