---
name: beads
description: Use this skill for all task and requirement management using the beads (bd) CLI. Trigger when the user wants to create epics, stories, tasks, or bugs; view or claim work; track progress; or plan features. All agent implementation work must originate from a beads story — never start coding without a linked story ID.
version: 0.1.0
---

# Beads (bd) Workflow

This project uses **bd (beads)** as the single source of truth for all work.
All implementation must trace back to a beads story with user story format and acceptance criteria.

---

## Step 1 — Ensure bd is installed and configured

Check for `bd` before doing anything else:

```bash
which bd 2>/dev/null || echo "not found"
```

If not found, install it using the platform-agnostic install script:

```bash
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
```

This installs to `~/.local/bin/bd` (no sudo required). If `~/.local/bin` is not on PATH, add it:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Verify: `bd version`

### Configure GitLab integration

Check the current GitLab config and verify connectivity:

```bash
bd gitlab status
```

If configured, you're done. If not:

**Step 1 — Find your project ID**

`$GITLAB_URL` and `$GITLAB_TOKEN` are already set in the workspace environment.
Use them to look up the numeric project ID from the git remote path:

```bash
# Get the namespace/path from git remote (e.g. shipsummit/black-3/app)
git remote get-url origin | sed 's|.*/\(.*/.*/.*\)\.git|\1|'

# Look up the numeric project ID
curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_URL/api/v4/projects/<namespace%2Fpath>" | grep -o '"id":[0-9]*' | head -1
# URL-encode slashes as %2F: shipsummit/black-3/app → shipsummit%2Fblack-3%2Fapp
```

**Step 2 — Persist the config**

```bash
bd config set gitlab.url "$GITLAB_URL"
bd config set gitlab.token "$GITLAB_TOKEN"
bd config set gitlab.project_id <numeric-id>   # e.g. 152
```

> **Note**: The `glab` CLI stores an OAuth bearer token that can expire.
> Always use `$GITLAB_TOKEN` (a PAT) for beads — do not copy the token value from `~/.config/glab-cli/config.yml`.

Verify the connection is working before proceeding:

```bash
bd gitlab status
```

---

## Step 2 — Understand what the user wants to do

Determine the goal:

| User intent | Action |
|---|---|
| Plan a new feature | Create an epic with stories |
| Add a single task/bug | Create a standalone issue |
| Start work | Find ready issues (`bd ready`) |
| Review status | List open issues (`bd list`) |
| Implement something | Verify a story exists first |

---

## Step 3 — Creating Epics with Stories

### Create an epic (feature)

```bash
bd create "Feature Name" --type epic --priority 2
# Returns: app-<hash>  (the epic ID)
```

### Create stories under the epic

Each story must follow user story format:

```
As a <type of user>,
I want <some goal>,
so that <some reason/benefit>.

Acceptance Criteria:
- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>
```

Create each story:

```bash
bd create "Story title" --type feature --priority 2 --parent <epic-id> --body "$(cat <<'EOF'
As a <user type>,
I want <goal>,
so that <benefit>.

Acceptance Criteria:
- [ ] <criterion 1>
- [ ] <criterion 2>
EOF
)"
```

### Link dependencies between stories (if needed)

```bash
bd dep add <story-id> <depends-on-story-id>
```

---

## Step 4 — Starting implementation work

**Never write code without a linked story.**

1. Find ready work (unblocked, open):
   ```bash
   bd ready
   ```

2. Claim the story atomically before starting:
   ```bash
   bd update <story-id> --claim
   ```

3. Show the full story (read acceptance criteria before coding):
   ```bash
   bd show <story-id>
   ```

4. Implement against the acceptance criteria. Reference the story ID in commit messages:
   ```
   git commit -m "feat: implement zone danger aggregation (app-a3f2)"
   ```

5. Mark complete when all acceptance criteria are met:
   ```bash
   bd close <story-id>
   ```

---

## Step 5 — Sync with GitLab

Sync issues bidirectionally with GitLab. Run this after creating/updating issues and at the end of each session:

```bash
bd gitlab sync
```

This pulls new/updated issues from GitLab into beads and pushes local beads issues to GitLab.

To sync in one direction only:

```bash
bd gitlab sync --pull-only   # pull from GitLab only
bd gitlab sync --push-only   # push to GitLab only
```

To preview what would change without making edits:

```bash
bd gitlab sync --dry-run
```

---

## Issue Types

| Type | Use for |
|---|---|
| `epic` | Large feature containing multiple stories |
| `feature` | A user story (use user story format) |
| `task` | Technical work not user-facing |
| `bug` | Something broken |
| `chore` | Maintenance, tooling, dependencies |

## Priorities

| Value | Meaning |
|---|---|
| `0` | Critical — broken builds, data loss, security |
| `1` | High — major features, important bugs |
| `2` | Medium — default |
| `3` | Low — polish, optimization |
| `4` | Backlog — future ideas |

---

## Quick Reference

```bash
bd ready                              # Unblocked work ready to claim
bd list --status=open                 # All open issues
bd show <id>                          # Full issue detail + acceptance criteria
bd create "title" -t feature -p 2    # Create a story
bd epic create "name"                 # Create an epic
bd update <id> --claim                # Claim work atomically
bd close <id>                         # Mark complete
bd graph                              # Visualize dependency tree
bd gitlab sync                        # Sync issues with GitLab (bidirectional)
bd gitlab sync --pull-only            # Pull from GitLab only
bd gitlab sync --push-only            # Push to GitLab only
bd gitlab sync --dry-run              # Preview sync without changes
bd gitlab status                      # Show GitLab config and sync status
bd prime                              # Full AI-optimized workflow context
```
