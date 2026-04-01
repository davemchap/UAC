---
name: pm
description: Product management skill for researching problem domains, identifying personas and scenarios, auditing existing GitLab issues for quality, and creating well-formed user stories. Trigger when the user provides a URL, document, or description to analyze; asks to review or improve existing issues; wants to create issues from research; or asks to identify users, personas, or scenarios.
version: 0.1.0
---

# PM Workflow

This skill turns raw inputs (URLs, documents, descriptions) into prioritized, well-formed GitLab issues — and audits existing issues for quality.

Work through each phase in order. Do not skip phases.

---

## Phase 1 — Read the Current Board

Before researching anything, understand what already exists.

Pull all open issues:

```bash
glab issue list --per-page 100
```

For each issue, fetch the full body to evaluate quality:

```bash
glab issue view <id>
```

Evaluate every issue against this rubric and build an **audit table** in memory:

| Check | Criteria |
|---|---|
| **User story format** | Title or body contains `As a <persona>, I want <goal>, so that <benefit>` |
| **Correct persona** | The persona named is a real, specific user type — not "user", "admin", or a system |
| **Acceptance criteria present** | Issue body contains acceptance criteria section |
| **Given/When/Then format** | Each acceptance criterion follows: `Given <context>, When <action>, Then <outcome>` |
| **Scenario specificity** | Criteria describe observable behavior, not implementation details |
| **Priority set** | Issue has a priority label (`P0`–`P4` or equivalent) |
| **Linked to epic** | Issue references a parent epic (if applicable) |

Note which issues fail which checks — you will use this in Phase 4.

---

## Phase 2 — Research the Problem Domain

Accept any combination of inputs from the user:
- URLs (fetch and read the content)
- Pasted document text
- Verbal descriptions
- Uploaded files

### For URLs

Fetch and read each URL provided:

```
WebFetch the URL with prompt: "Extract: 1) the core problem being solved, 2) who the users are and their goals, 3) key scenarios or workflows described, 4) any pain points or unmet needs mentioned."
```

Repeat for each URL. Synthesize across all sources.

### For documents or descriptions

Read the content directly. Apply the same extraction lens:
1. Core problem
2. Users and their goals
3. Key scenarios and workflows
4. Pain points and unmet needs

### Build a Research Summary

After consuming all inputs, produce a structured summary:

```
## Research Summary

### Problem Statement
<1-3 sentences describing the core problem>

### Personas Identified
For each persona:
- **Name**: <specific role, e.g. "Avalanche Forecaster", not "user">
- **Goal**: <what they are trying to accomplish>
- **Context**: <when/where/why they use this>
- **Pain Points**: <what frustrates or blocks them today>

### Scenarios Identified
For each scenario:
- **Scenario**: <name>
- **Persona**: <who>
- **Trigger**: <what starts this scenario>
- **Steps**: <what they do>
- **Success**: <what done looks like>
- **Priority**: P0–P4 (based on frequency, impact, and risk)
```

Present this summary to the user and ask for corrections before proceeding:
- "Does this capture the right personas?"
- "Are there scenarios missing or that should be deprioritized?"
- "Is the problem statement accurate?"

Wait for confirmation or corrections before moving to Phase 3.

---

## Phase 3 — Gap Analysis

Compare the Research Summary against the existing board audit from Phase 1.

Identify:

1. **Missing coverage** — scenarios from research with no corresponding issue
2. **Wrong persona** — issues that exist but are framed around the wrong user type
3. **Malformed stories** — issues missing user story format or Given/When/Then criteria
4. **Misaligned priority** — issues whose priority doesn't match the scenario's importance
5. **Missing epics** — groups of related stories with no parent epic

Produce a **Gap Report**:

```
## Gap Report

### Issues Needing Repair
| Issue | Problem | Recommended Fix |
|---|---|---|
| #3 | Persona is "admin" — should be "Avalanche Forecaster" | Rewrite story from forecaster perspective |
| #5 | No acceptance criteria | Add Given/When/Then for each scenario |

### Missing Stories
| Scenario | Priority | Suggested Epic |
|---|---|---|
| Forecaster views multi-zone danger map | P1 | Zone Awareness |
| System sends alert when danger threshold crossed | P0 | Alert Engine |

### Missing Epics
| Epic Name | Stories it would contain |
|---|---|
| Zone Awareness | #4, #6, + 2 new stories |
```

Present the Gap Report to the user. Ask:
- "Should I repair the existing issues?"
- "Should I create the missing stories?"
- "Do you want to adjust any priorities before I create issues?"

Wait for confirmation.

---

## Phase 4 — Create and Repair Issues

Act on what the user approved in Phase 3.

### Repairing existing issues

For each issue flagged for repair, update it:

```bash
glab issue update <id> --description "$(cat <<'EOF'
As a <specific persona>,
I want <specific goal>,
so that <specific benefit>.

## Acceptance Criteria

- [ ] Given <context>, When <action>, Then <outcome>
- [ ] Given <context>, When <action>, Then <outcome>
- [ ] Given <context>, When <action>, Then <outcome>
EOF
)"
```

### Creating new epics

```bash
glab issue create \
  --title "[EPIC] <Feature Name>" \
  --label "epic,P<priority>" \
  --description "$(cat <<'EOF'
## Goal
<What this epic achieves and for whom>

## Personas
- <Persona 1>
- <Persona 2>

## Stories
_Issues will be linked as they are created._
EOF
)"
```

### Creating new stories

Each story must pass the full rubric from Phase 1 before being created.

```bash
glab issue create \
  --title "<Action> <object> for <persona context>" \
  --label "feature,P<priority>" \
  --description "$(cat <<'EOF'
As a <specific persona>,
I want <specific goal>,
so that <specific benefit>.

## Acceptance Criteria

- [ ] Given <context>, When <action>, Then <outcome>
- [ ] Given <context>, When <action>, Then <outcome>
- [ ] Given <context>, When <action>, Then <outcome>

## Out of Scope
- <explicit exclusion if helpful>

Closes epic #<epic-id>
EOF
)"
```

### Linking to epics

After creating stories, add a reference to the parent epic in both directions:
- Add `Closes epic #<id>` or `Part of #<id>` in the story body
- Update the epic description to list the new story IDs

---

## Phase 5 — Summary Report

After all creates and repairs are complete, produce a final summary:

```
## PM Session Summary

### Issues Repaired
- #3: Updated persona to "Avalanche Forecaster", added Given/When/Then criteria
- #5: Added 3 acceptance criteria

### Issues Created
- #7: [EPIC] Zone Awareness (P1)
- #8: Forecaster views multi-zone danger map (P1, under #7)
- #9: System triggers alert at danger threshold (P0, under #1)

### Board Health
| Check | Before | After |
|---|---|---|
| User story format | 3/6 | 6/6 |
| Correct persona | 4/6 | 6/6 |
| Given/When/Then criteria | 1/6 | 6/6 |
| Priority set | 6/6 | 8/8 |
```

---

## User Story Quality Rules

Every issue created or repaired by this skill must meet all of these:

1. **Persona is specific** — "Avalanche Forecaster", "Field Observer", "Emergency Manager" — never "user", "admin", "system", or "stakeholder"
2. **Goal is user-centered** — describes what the *person* wants, not what the system does
3. **Benefit is real** — explains why this matters to the persona, not just "so that it works"
4. **Each acceptance criterion is testable** — a QA engineer can verify it by observation alone
5. **Given/When/Then is complete** — all three parts present for every criterion
6. **No implementation details in criteria** — criteria describe behavior, not code

---

## Priority Guide

| Priority | Label | Use for |
|---|---|---|
| P0 | Critical | Safety-critical, data loss, broken core flows |
| P1 | High | Primary user scenarios, demo-critical features |
| P2 | Medium | Supporting scenarios, quality of life |
| P3 | Low | Polish, edge cases |
| P4 | Backlog | Future ideas, not committed |
