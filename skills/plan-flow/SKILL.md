---
name: plan-flow
description: Read-only analysis that produces an ODD slice plan in .tasks/current.md. Invoke explicitly before non-trivial implementation.
argument-hint: <task>
disable-model-invocation: true
---

# plan-flow — Planner role

Task: the arguments given with this invocation. Read-only architect: inspect, design, slice, write the plan. Never modify source, install packages, or mutate git. The only file you may write is `.tasks/current.md`.

## Steps
1. **Active plan gate:** if `.tasks/current.md` exists and still has a `- [ ]` item, STOP and ask exactly ONE question: replace or continue it? Default: continue (tell the user to run `orchestrate`). Replace only on an explicit answer.
2. **Scope gate:** if the task is broad or ambiguous, STOP and ask exactly ONE question on the main decision, with a recommended default answerable in one word. No questionnaires.
3. **Size gate:** ≤ 1 file, cosmetic or < 30 lines → declare an **Inline Task** with a one-step guideline; skip slicing.
4. **Ground truth:** read `GLOSSARY.md` (if present) and the active manifest (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `Makefile`) for real test/lint commands. Verify paths, exports and signatures before citing them. Run the verify command once on the clean tree and record its summary line as the **Baseline** (running tests never edits source or git).
5. **Design:** deep modules, minimal public interfaces, no shallow pass-through layers.
6. **Slice:** feature-complete units (e.g. migration + model + service + tests). Each defines its RED state (failing test) first and names the skills it needs (`testing`, `security-audit`, `diagnosing-bugs`; `db-migration`, `impeccable` if installed). List at most five edge cases the requirement implies and no RED covers (inputs, states, environments); each gets its own test in RED.
7. **Persist** the plan to `.tasks/current.md`, then tell the user to run `orchestrate`.

## Output format
```markdown
### Architecture & Context
* **Affected:** files/modules/interfaces
* **Verify with:** exact commands from the manifest
* **Baseline:** summary line of the test run on the clean tree
* **Branch:** `feature/<task-slug>` (create before orchestrating; never `main`/`master`)
* **Skills:** per slice

### Slice N: name
* **Scope:** files
* **Risk:** low|high (high = a high-risk item from `AGENTS.md` § 2)
* **Edge cases (≤ 5):** inputs or states the requirement implies and no RED covers, with the expected result; each has a test in RED
* **RED:** test file + expected failure
* **GREEN:** logic, types, integration
* **DoD:** exact terminal command

### Checklist
- [ ] Slice 1: summary + test criteria
```
