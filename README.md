# Your Team's App

## New Here? Start Here

<details>
<summary><strong>What is Coder?</strong></summary>

Coder is a platform that gives you a pre-configured computer in the cloud called a workspace. Instead of spending time installing tools and setting up your machine, your workspace comes ready to go with everything you need to start coding -- and it's the same setup for everyone on the team.
</details>

<details>
<summary><strong>What is Claude Code?</strong></summary>

Claude Code is an AI coding assistant that lives in your terminal. You give it instructions in plain English and it reads, writes, and edits code for you. It's the primary way you'll interact with your codebase in this workspace.
</details>

<details>
<summary><strong>What is a terminal?</strong></summary>

A terminal is a text-based interface where you type commands instead of clicking buttons. Think of it as a chat window between you and your computer. In this workspace, your terminal opens automatically and Claude Code is ready to go inside it.
</details>

## What You Get

- **AI coding helper** -- Claude Code starts automatically to help you write and understand code.
- **JavaScript engine** -- Bun runs your code, installs packages, and bundles your files.
- **Version control** -- Git and GitLab CLI come pre-connected, so you can save and share your work.
- **Command line** -- A full Linux terminal with all the standard developer tools.
- **Persistent files** -- Your `/workspaces` folder survives restarts, so you won't lose anything.

## What's Already Set Up

- **GitLab** -- Your account is connected, so `git clone` and `git push` work right away.
- **Team project** -- Your team's codebase is automatically downloaded to `~/workspaces/app` on first launch.
- **Claude Code** -- The AI helper is ready to go, no API key setup needed.
- **Auto-deploy** -- When you `git push`, it automatically builds and publishes to your team's URL.

## Get Started

Each team member creates their own workspace. Coordinate with your team --
each person picks a different number (1, 2, 3, etc.).

1. **Create a GitLab personal access token** -- you'll need this for your workspace to clone and push code
   - Go to [**GitLab -> Access Tokens**](https://gitlab.shipsummit.rise8.us/-/user_settings/personal_access_tokens)
   - Name: anything (e.g. `shipsummit`)
   - Scopes: check **`read_repository`** and **`write_repository`**
   - Click **Create token** and copy it
2. **[Launch your workspace ->](https://coder.shipsummit.rise8.us/templates/ai-assistant/workspace?param.team_name=black-3)**
3. Pick a workspace number (1, 2, 3) -- one per person, coordinate with your team
4. Paste your **GitLab Token** from step 1
5. Enter the **Anthropic API Key** provided by event staff
6. Click **Create Workspace** and wait for it to start
7. Your code is already cloned -- open a terminal and say hello to Claude!

Your app deploys automatically when you push to main:
**https://black-3.shipsummit.rise8.us**

---

## Architecture

```
+---------------------------------------------------------+
|                     Hono Server (Bun)                   |
|                                                         |
|  +------------------+    +--------------------------+   |
|  |   Static Files   |    |       API Routes         |   |
|  |   (src/public/)  |    |        (/api/*)          |   |
|  |                  |    |                          |   |
|  |  - index.html    |    |  - GET /health           |   |
|  |  - styles.css    |    |  - GET /api              |   |
|  |  - app.js        |    |  - /api/proxy/*          |   |
|  |                  |    |    (CORS proxy routes)   |   |
|  +------------------+    +--------------------------+   |
|           |                          |                  |
|           +----------+---------------+                  |
|                      |                                  |
|                      v                                  |
|              +---------------+                          |
|              |   PostgreSQL  |                          |
|              |   Database    |                          |
|              +---------------+                          |
+---------------------------------------------------------+
```

## Local Development

PostgreSQL is pre-installed in your workspace and starts automatically when the workspace launches. You don't need Docker or any manual setup.

```bash
# Install dependencies
bun install

# Copy environment file (done automatically on first launch, but run manually if needed)
cp .env.example .env

# Run the development server (with hot reload)
bun run dev
```

Open http://localhost:3000 to see your app!

> **Note**: `DATABASE_URL` is set automatically in your workspace. If the dev server can't connect to the database, check that `.env` exists (`cp .env.example .env`) and that PostgreSQL is running (`pg_isready -h localhost`).

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server with hot reload |
| `bun run start` | Start production server |
| `bun run build` | Build for production (optional) |
| `bun run check` | Run all quality gates |
| `bun run lint` | Run ESLint |
| `bun run lint:fix` | Run ESLint with auto-fix |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run circular` | Check for circular dependencies |
| `bun run test` | Run unit tests |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Frontend (static HTML) |
| GET | `/health` | Health check (required for deployment) |
| GET | `/api` | API documentation |
| GET | `/api/proxy/avalanche/forecast?zone=<id>` | Avalanche forecast proxy |
| GET | `/api/proxy/avalanche/zones` | Avalanche zones proxy |
| GET | `/api/proxy/snotel/station/:triplet` | SNOTEL station proxy |

## Project Structure

```
.
├── src/
│   ├── index.ts          # Main entry point, server setup
│   ├── db.ts             # Database connection and utilities
│   ├── api/
│   │   └── proxy.ts      # CORS proxy routes for external APIs
│   ├── __tests__/
│   │   └── app.test.ts   # Unit tests for app routes
│   └── public/           # Static frontend files
│       ├── index.html    # Main HTML page
│       ├── styles.css    # CSS styles
│       └── app.js        # Frontend JavaScript
├── eslint.config.mjs     # ESLint 9 flat config
├── .gitlab-ci.yml        # CI/CD pipeline configuration
├── Dockerfile            # Container build instructions
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── data/                 # Pre-seeded avalanche data by track — see data/README.md
├── CLAUDE.md             # AI assistant instructions
├── .env.example          # Environment variable template
└── README.md             # This file
```

## Adding a New API Resource

1. Create a new file in `src/api/`:

```typescript
// src/api/items.ts
import { Hono } from "hono";
import { getSql } from "../db";

const items = new Hono();

items.get("/", async (c) => {
  const sql = getSql();
  const result = await sql`SELECT * FROM items`;
  return c.json({ success: true, data: result });
});

// Add more routes...

export default items;
```

2. Add the table to `src/db.ts` inside `initializeDatabase()`.

3. Mount the route in `src/index.ts`:

```typescript
import items from "./api/items";
app.route("/api/items", items);
```

4. Update the frontend in `src/public/` to use the new API.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Set automatically in workspace; required for deployment |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |

## Quality Gates

Run all checks with a single command:

```bash
bun run check
```

This runs lint, typecheck, circular dependency detection, and tests in sequence. All gates must pass with zero errors and zero warnings.

| Command | What it checks |
|---------|---------------|
| `bun run lint` | ESLint with strict TypeScript rules, SonarJS, unused imports |
| `bun run lint:fix` | Auto-fix lint issues where possible |
| `bun run typecheck` | TypeScript strict mode |
| `bun run circular` | No circular dependencies between modules |
| `bun run test` | Unit tests via bun:test |
| `bun run check` | All of the above in sequence |

## Deployment

### How It Works

1. **Push to GitLab** - Pipeline triggers automatically on the main branch
2. **Database Provisioning** - Creates your database in shared PostgreSQL
3. **Docker Build** - Builds and pushes image to Amazon ECR
4. **ECS Deployment** - Deploys to Fargate via CloudFormation

### Troubleshooting

**Pipeline fails at "provision-database"**
- Check that `APP_NAME` is set and unique
- Ensure the format is lowercase with hyphens (e.g., `jsmith-app`)

**Pipeline fails at "build"**
- Check your Dockerfile for syntax errors
- Ensure all required files are committed

**App not accessible after deploy**
- Wait 2-3 minutes for ECS to start the container
- Check the health endpoint by appending `/health` to your deployed app URL

**Frontend not loading**
- Ensure `src/public/` directory contains your frontend files
- Check that file paths in HTML use absolute paths (e.g., `/styles.css`)

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/) - Fast JavaScript runtime
- **Framework**: [Hono](https://hono.dev/) - Lightweight web framework
- **Database**: [PostgreSQL](https://www.postgresql.org/) via [postgres](https://github.com/porsager/postgres)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Frontend**: Vanilla JavaScript (easily replaceable)
- **Container**: Docker with multi-stage builds
- **CI/CD**: GitLab CI with AWS CodeBuild
- **Hosting**: AWS ECS Fargate

## Need Help?

Start with Claude. If you're stuck or unsure about something, ask Claude first -- that's what it's here for. You don't need to use technical language. Describe what you're trying to do like you're explaining it to a five-year-old, and Claude will figure out the rest.

If you've gone back and forth with Claude a few times and you're still not making progress, reach out to [event staff / Slack channel / point of contact]. They're here to help you get unstuck.

## Support

- **Infrastructure Issues**: Contact the Ship Summit platform team
- **Template Questions**: See the workshop documentation
- **Bug Reports**: Open an issue in the Ship Summit repository

## License

MIT
