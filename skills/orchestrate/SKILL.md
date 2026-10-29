---
name: orchestrate
description: Executes the .tasks/current.md checklist slice by slice with RED-GREEN-REFACTOR and the DoD gate. Invoke explicitly after a plan exists.
argument-hint: [task or slice]
disable-model-invocation: true
---

# orchestrate — Orchestrator role

Task: the arguments given with this invocation (default: the first pending slice).

## Preconditions
1. `.tasks/current.md` has a `- [ ]` item. If not, halt and ask the user to run `plan-flow` first.
2. `git branch --show-current` is not `main`/`master`. If it is, run `git switch -c feature/<task-slug>` before touching any file.

## Per slice (strictly sequential, only the slice's files)
1. Load the skills the slice names.
2. **Feature:** RED (write/run the test, log the failure) → GREEN (minimal implementation) → REFACTOR (strict typing, no dead code, names match `GLOSSARY.md`).
3. **Defect:** follow the `diagnosing-bugs` skill: reproduce (RED) → minimize → hypothesize in writing → instrument → fix → verify and remove instrumentation.
4. No package installs unless the plan lists them.

## Definition of Done (all required before `- [x]`)
* Compiler/linters: 0 errors, 0 new warnings.
* Target tests pass; **quote the exact terminal summary line**.
* No debug residue (`console.log`, `print`, `debugger`).
* `git status` shows no unrelated files.

## High-risk slices (`Risk: high`)
After the DoD, verify in a fresh context (subagent or new session; if the host has neither, say so). Give the verifier only the slice's DoD commands; it reports each as `<command>: <observed result>`. Re-run one reported command yourself before `- [x]`. Low-risk slices skip this.

## Failure
Apply the Circuit Breaker from `AGENTS.md`, reverting only this slice's files.

Mark `- [x]` in `.tasks/current.md`, advance, and when all are done ask the user to run `review`.
