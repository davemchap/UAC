---
name: deploy
description: Use this skill before closing any beads story that involves code changes. Runs the full deploy workflow: lint locally, commit, push, watch the GitLab CI pipeline, and only close the story once the pipeline passes. If the pipeline fails, diagnose and fix the issue before closing.
version: 0.1.0
---

# Deploy Workflow

**Every code change must pass CI before the story is closed.** Always run this workflow after committing work.

---

## Step 1 — Lint locally

```bash
bun run check
```

All gates must pass with zero errors and zero warnings. Fix everything before proceeding.

**Auto-fix formatting first:**
```bash
bun x --bun @biomejs/biome@1.9.4 format --write .
bun run lint:fix
bun run check   # must be clean
```

---

## Step 2 — Commit and push

Stage only relevant files (never `git add -A` or `git add .` blindly):

```bash
git add <specific files>
git status      # verify staged set is correct — no .env, no secrets
git commit -m "type: description (story-id)"
git push origin main
```

**Always include the beads story ID in the commit message** (e.g. `feat: add zone alerts (app-a3f2)`).

If push is rejected, rebase first:
```bash
git pull --rebase origin main
git push origin main
```

---

## Step 3 — Watch the pipeline

Get the latest pipeline ID and poll until it resolves:

```bash
# Get latest pipeline
curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_URL/api/v4/projects/152/pipelines?per_page=1" \
  | grep -o '"id":[0-9]*,"iid":[0-9]*,"status":"[^"]*"'
```

Poll every 30 seconds until status is `success` or `failed`:

```bash
# Poll for status
curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_URL/api/v4/projects/152/pipelines/<pipeline_id>" \
  | grep -o '"status":"[^"]*"'
```

Pipeline stages in order: `provision-db` → `lint` → `test` → `build-and-push` → `sign` → `gatecheck` → `scan` → `deploy` → `evidence` → `release`

---

## Step 4 — If pipeline fails: diagnose

Find the failing job:

```bash
curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_URL/api/v4/projects/152/pipelines/<pipeline_id>/jobs" \
  | grep -o '"id":[0-9]*,"status":"failed","stage":"[^"]*","name":"[^"]*"'
```

Get the job log:

```bash
curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_URL/api/v4/projects/152/jobs/<job_id>/trace" \
  | tail -50
```

### Common failures and fixes

| Symptom | Cause | Fix |
|---|---|---|
| `lockfile had changes, but lockfile is frozen` | `bun.lock` not committed after `bun add` | Run `bun install`, commit `package.json` + `bun.lock` |
| Lint or type errors in CI that pass locally | Different bun/node versions | Run `bun run check` again; check tsconfig |
| `build-and-push` fails | Docker build error | Check Dockerfile and build args |
| `deploy` fails | Infrastructure or config issue | Check deploy job log for Terraform/ECS errors |

---

## Step 5 — Story closure gate

A story **may only be closed once the pipeline status is `success`**. A passing pipeline is a prerequisite — it is not a trigger. Closing the story is a separate decision made by the team or agent doing the work.

A story must **not** be closed while the pipeline is `pending`, `running`, or `failed`.

---

## Quick status check

```bash
# One-liner: latest pipeline status
curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_URL/api/v4/projects/152/pipelines?per_page=1" \
  | grep -o '"status":"[^"]*"'
```
