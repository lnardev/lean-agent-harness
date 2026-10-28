# Agent Configuration

Single source of truth for all coding agents (Pi, OpenCode, Claude Code, Cursor, Codex, Copilot, Gemini CLI). Engineering rigor, deterministic execution, and zero-compromise delivery.

---

## 1. Core Operating Principles

* **Identity & Communication:** Direct and technically exhaustive. Explain the *why* behind design decisions and trade-offs. Zero filler, apologies, or robotic pleasantries.
* **Ubiquitous Language:** Consult `GLOSSARY.md` before naming any variable, model, endpoint, or entity. Keep business terms and code symbols 1:1. Register new domain entities or hard-to-explain invariants in `GLOSSARY.md` immediately.
* **Deep Modules:** High functional depth behind minimal, expressive interfaces. Reject shallow wrappers, anemic layers, and premature fragmentation.
* **Progressive Discovery (Zero Question-Bombing):** Never dump question lists. When scope is ambiguous, ask exactly ONE clarifying question per turn on the current decision slice, always bundled with a sensible default so a one-word answer advances the work. Lock the active slice before moving to the next.
* **Manifest Pre-flight (Anti-Hallucination):** Never assume signatures, versions, or test commands from memory. Read the active manifest (`package.json`, `go.mod`, `pyproject.toml`, `Cargo.toml`, `composer.json`, `Makefile`) first.
* **Test-First (RED-GREEN-REFACTOR):** Write/execute the test suite before implementation; document the RED failure, implement for GREEN, refactor for SOLID and low complexity. Never claim a passing test you did not run.
* **Diagnose Honestly:** For stubborn bugs, run the 6-phase loop in `skills/diagnosing-bugs/SKILL.md` instead of blind patching.
* **Evidence-Based Delivery:** To claim verification, cite the exact terminal summary line (e.g., `Tests: 28 passed, 28 total`). Success assertions without raw terminal evidence are prohibited.

---

## 2. Work Sizing (Inline vs. Tracked ODD)

* **Inline (no ceremony):** self-evident, low-risk tasks — ≤ 1 file, cosmetic or copy edits, < 30 lines — fully auditable through `git diff`. Execute immediately.
* **Tracked ODD (`/plan-flow`):** architectural uncertainty, auth/data-integrity risk, or multi-step work that must survive context compaction. Group cohesive feature-complete units (e.g., schema migration + model + service + full test suite), not fragmented micro-slices.
* **State Persistence:** Write plan, decisions, and `- [ ]` checklist to `.tasks/current.md` so a compacted/reloaded session resumes from the last uncompleted slice without re-asking. Delete it after a clean `/commit`.
* **Branch Sandboxing:** For tracked tasks, verify the branch is not `main`/`master` before editing. Work on `feature/<task-slug>`.

---

## 3. Hard Rules (Execution Guardrails)

* **Circuit Breaker:** After 2 consecutive failed fix attempts on one error, STOP. Roll back (`git checkout -- <files>`), re-read the full stack trace, state a new root-cause hypothesis before further edits.
* **Zero-Hang:** Never block on `stdin`. Use non-interactive flags (`-y`, `--no-interaction`, `-m "<msg>"`). No interactive editors (`vi`/`nano`), unflagged initializers, or interactive `sudo`.
* **Strict Typing — Zero Placeholders:**
  | Stack | Requirement |
  | :--- | :--- |
  | TypeScript | No `any`; explicit interfaces, unions, return types |
  | PHP | `declare(strict_types=1);`, typed properties and signatures |
  | Go | No bare `interface{}`; never discard errors with `_` |
  | Python | Full `typing`/Pydantic annotations |
  No stubs (`// ...`, `TODO: implement`), no dead/commented-out code, no synthetic AI attribution (`Co-Authored-By: Claude`).
* **Dependency Lockdown:** No installs (`npm i`, `pip install`, `go get`, `composer require`) unless explicitly designated in the approved plan.
* **Secrets Guard:** Never read, output, or commit `.env*` (only `.env.example` for key names), SSH keys, certificates, `*.pem`/`*.key`, `.git/*`. Define required env vars as typed validated config without exposing values.
* **Destructive Commands:** `rm -rf`, database drops/truncation, `git reset --hard`, `git push --force` require explicit human confirmation.
* **Atomic Slice Rollback:** If a slice fails its Definition of Done, revert its uncommitted changes to restore the last clean, passing state.

---

## 4. Subagents & Boundary Isolation

Delegate only when execution would saturate the context window (Named Reason Delegation).

| Role | Spec | Allowed | Restrictions |
| :--- | :--- | :--- | :--- |
| **Planner** (`tony-stark`) | `agents/planner.md` | Repo inspection, dependency mapping, ODD partitioning, architecture, `GLOSSARY.md` upkeep | **READ-ONLY** — no tree mutations or installs |
| **Orchestrator** | `agents/orchestrator.md` | Sequential `- [ ]` → `- [x]`, skill loading, RED-GREEN loop, DoD validation | No unplanned packages; no architecture changes outside the plan |

---

## 5. Chained Lifecycle (4-Phase Loop)

```text
/plan-flow <task>  ──►  /orchestrate <task>  ──►  /review [target]  ──►  /commit [hint]
  (Read-only ODD)         (Sequential DoD)       (Audit git diff)        (Atomic Commit)
```
