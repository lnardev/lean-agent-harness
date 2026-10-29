---
name: plan-flow
description: Read-only analysis that produces an ODD slice plan in .tasks/current.md. Invoke explicitly before non-trivial implementation.
argument-hint: <task>
disable-model-invocation: true
---

# plan-flow — Planner role

Task: the arguments given with this invocation. Read-only architect: inspect, design, slice, write the plan. Never modify source, install packages, or mutate git. The only file you may write is `.tasks/current.md`.

## Steps
1. **Scope gate:** if the task is broad or ambiguous, STOP and ask exactly ONE question on the main decision, with a recommended default answerable in one word. No questionnaires.
2. **Size gate:** ≤ 1 file, cosmetic or < 30 lines → declare an **Inline Task** with a one-step guideline; skip slicing.
3. **Ground truth:** read `GLOSSARY.md` (if present) and the active manifest (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `Makefile`) for real test/lint commands. Verify paths, exports and signatures before citing them.
4. **Design:** deep modules, minimal public interfaces, no shallow pass-through layers.
5. **Slice:** feature-complete units (e.g. migration + model + service + tests). Each defines its RED state (failing test) first and names the skills it needs (`testing`, `security-audit`, `db-migration`, `diagnosing-bugs`, `impeccable`).
6. **Persist** the plan to `.tasks/current.md`, then tell the user to run `orchestrate`.

## Output format
```markdown
### Architecture & Context
* **Affected:** files/modules/interfaces
* **Verify with:** exact commands from the manifest
* **Branch:** `feature/<task-slug>` (create before orchestrating; never `main`/`master`)
* **Skills:** per slice

### Slice N: name
* **Scope:** files
* **Risk:** low|high (high = a high-risk item from `AGENTS.md` § 2)
* **RED:** test file + expected failure
* **GREEN:** logic, types, integration
* **DoD:** exact terminal command

### Checklist
- [ ] Slice 1: summary + test criteria
```
