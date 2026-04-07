# UAC Avalanche Dashboard

A fullstack avalanche forecasting dashboard built with Bun, Hono, TypeScript, and PostgreSQL. Pulls data from the Utah Avalanche Center (UAC), National Weather Service (NWS), and SNOTEL APIs and presents it as an operational situational awareness tool.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Setup Options](#setup-options)
  - [Option A — Local (native)](#option-a--local-native)
  - [Option B — Dev container with Podman or Docker](#option-b--dev-container-with-podman-or-docker)
  - [Option C — Coder workspace](#option-c--coder-workspace)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Architecture](#architecture)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Quality Gates](#quality-gates)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh/) v1.3+ |
| Framework | [Hono](https://hono.dev/) |
| Database | PostgreSQL 15+ via [Drizzle ORM](https://orm.drizzle.team/) |
| Language | TypeScript (strict mode) |
| Frontend | Vanilla JS / HTML / CSS |
| Tests | bun:test |

---

## Setup Options

### Option A — Local (native)

Install the required tools directly on your machine.

**Prerequisites**

- [Bun](https://bun.sh/docs/installation) v1.3+
- PostgreSQL 15+ running locally

**Steps**

```bash
# 1. Clone the repo
git clone https://github.com/davemchap/UAC.git
cd UAC

# 2. Install dependencies
bun install

# 3. Create your local database
createdb uac_dev

# 4. Copy and configure environment
cp .env.example .env
# Edit .env and set:
#   DATABASE_URL=postgresql://<your-user>@localhost:5432/uac_dev

# 5. Run database migrations
bun run db:migrate

# 6. (Optional) Seed reference data
bun run db:seed

# 7. Start the dev server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

### Option B — Dev container with Podman or Docker

The repo includes a `Dockerfile` you can use to run the app in a container alongside a PostgreSQL container.

> **Note:** The `Dockerfile` currently references a private base image (`cgr.dev/shipsummit/bun`). Replace the `FROM` lines with the public equivalent before building:
>
> ```dockerfile
> FROM oven/bun:1.3.10 AS dependencies
> FROM oven/bun:1.3.10 AS builder
> FROM oven/bun:1.3.10 AS production
> ```

**Using Podman Compose**

Create a `compose.yaml` in the project root:

```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: uac
      POSTGRES_PASSWORD: uac
      POSTGRES_DB: uac_dev
    ports:
      - "5432:5432"

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://uac:uac@db:5432/uac_dev
      NODE_ENV: development
    depends_on:
      - db
```

Then run:

```bash
podman compose up --build
# or: docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

**Run migrations inside the container**

```bash
podman compose exec app bun run db:migrate
# or: docker compose exec app bun run db:migrate
```

---

### Option C — Coder workspace

If your team has access to a [Coder](https://coder.com/) deployment, you can run this project in a managed cloud workspace.

**Prerequisites**

- A Coder deployment with the `ai-assistant` template installed
- A PostgreSQL service or sidecar available to the workspace
- An Anthropic API key (for Claude Code integration, optional)

**Steps**

1. Create a new workspace from the `ai-assistant` template in your Coder instance.
2. Set the following workspace parameters:
   - **Git repo URL**: `https://github.com/davemchap/UAC.git`
   - **Anthropic API Key**: your key (optional — only needed for AI assistant features)
3. Once the workspace starts, open a terminal.
4. The repo will be cloned to `~/workspaces/app`. Run:

```bash
cd ~/workspaces/app
bun install
cp .env.example .env
# Edit .env with your DATABASE_URL
bun run db:migrate
bun run dev
```

5. Use Coder's port-forwarding to access the app at port `3000`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values.

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/uac_dev`) | Yes |
| `PORT` | Server port | No (default: `3000`) |
| `NODE_ENV` | `development` or `production` | No (default: `development`) |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI briefing features | Only for AI features |

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server with hot reload |
| `bun run start` | Start production server |
| `bun run check` | Run all quality gates (lint + typecheck + tests) |
| `bun run lint` | ESLint with strict TypeScript rules |
| `bun run lint:fix` | Auto-fix lint issues |
| `bun run typecheck` | TypeScript strict mode check |
| `bun run circular` | Check for circular dependencies |
| `bun run test` | Run unit tests |
| `bun run db:migrate` | Run database migrations |
| `bun run db:seed` | Seed reference data |

---

## Architecture

```
+---------------------------------------------------------+
|                     Hono Server (Bun)                   |
|                                                         |
|  +------------------+    +--------------------------+   |
|  |   Static Files   |    |       API Routes         |   |
|  | (src/projects/)  |    |        (/api/*)          |   |
|  |                  |    |                          |   |
|  |  - index.html    |    |  - GET /health           |   |
|  |  - styles.css    |    |  - GET /api              |   |
|  |  - app.js        |    |  - /api/forecasts        |   |
|  |                  |    |  - /api/notifications    |   |
|  +------------------+    +--------------------------+   |
|           |                          |                  |
|           +----------+---------------+                  |
|                      |                                  |
|                      v                                  |
|              +---------------+                          |
|              |   PostgreSQL  |                          |
|              |   (Drizzle)   |                          |
|              +---------------+                          |
+---------------------------------------------------------+
```

### Key Components

| Path | Purpose |
|------|---------|
| `src/components/db/` | Drizzle schema, migrations, query helpers |
| `src/components/ingestion/` | UAC, NWS, and SNOTEL data ingestion |
| `src/components/notifications/` | Alert and notification logic |
| `src/bases/http/` | Hono server entry point and route wiring |
| `src/projects/` | Static frontend dashboards |
| `data/black-diamond/` | Pre-seeded zone config, snapshots, alert rules |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Main dashboard (static HTML) |
| GET | `/health` | Health check |
| GET | `/api` | API documentation |
| GET | `/api/forecasts` | Avalanche forecasts |
| GET | `/api/notifications` | Active alerts and notifications |
| POST | `/api/notifications/:id/acknowledge` | Acknowledge a notification |

---

## Project Structure

```
.
├── src/
│   ├── index.ts                  # Entry point
│   ├── bases/http/               # Hono server setup
│   ├── components/
│   │   ├── db/                   # Schema, migrations, query helpers
│   │   ├── ingestion/            # UAC / NWS / SNOTEL data fetchers
│   │   └── notifications/        # Alert logic
│   ├── projects/                 # Static frontend dashboards
│   └── __tests__/                # Unit tests
├── data/
│   ├── black-diamond/            # Zone config, snapshots, alert rules
│   ├── shared/                   # Danger scale, SNOTEL reference data
│   └── apis/                     # External API documentation
├── Dockerfile
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## Quality Gates

```bash
bun run check
```

All gates must pass with zero errors and zero warnings before committing.

| Gate | What it checks |
|------|---------------|
| `bun run lint:biome` | Formatting and fast lint |
| `bun run lint` | ESLint strict TypeScript + SonarJS |
| `bun run typecheck` | TypeScript strict mode |
| `bun run circular` | No circular dependencies |
| `bun run test` | Unit tests |

Auto-fix formatting:

```bash
bun x --bun @biomejs/biome@1.9.4 format --write .
bun run lint:fix
```

---

## License

MIT
