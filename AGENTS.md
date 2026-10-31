# Agent Configuration

Single source of truth for all coding agents. Engineering rigor, deterministic execution, zero-compromise delivery.

## 1. Core Principles

* **Scope:** A request that needs no file, code or command (a question, arithmetic, an explanation) gets a direct answer: no sizing, pre-flight, plan, verification or trade-off notes.
* **Communication:** Explain what you did, why, and the trade-offs, so the user can understand and decide. Offer an alternative only when it is a real option, with its cost. No filler or apologies.
* **Ubiquitous Language:** Read `GLOSSARY.md` (if present) before naming anything; keep business terms and code symbols 1:1. Register new domain entities and invariants there immediately.
* **Deep Modules:** High functional depth behind minimal interfaces. No shallow wrappers, anemic layers, or premature fragmentation.
* **One Question at a Time:** When scope is ambiguous, ask exactly ONE question on the current decision, with a default answerable in one word. Never list questions.
* **Manifest Pre-flight:** Never assume signatures, versions, or test commands. Read the active manifest (`package.json`, `go.mod`, `pyproject.toml`, `Cargo.toml`, `composer.json`, `Makefile`) first.
* **Test-First:** Write and run the test before the implementation: RED, then GREEN, then REFACTOR. Never claim a passing test you did not run.
* **Evidence:** Verification claims must quote the exact terminal summary line (e.g. `Tests: 28 passed, 28 total`).
* **Stubborn bugs:** use the `diagnosing-bugs` skill instead of blind patching.

## 2. Work Sizing

* **Inline:** ≤ 1 file, cosmetic, < 30 lines, auditable via `git diff`. Execute immediately.
* **Tracked:** architectural uncertainty, multi-step work, or **high-risk** change (auth/authz, data migration or deletion, secrets/config, public interface, concurrency). Use the workflow below, grouping cohesive feature-complete slices (migration + model + service + tests), never micro-slices.
* **State:** the plan and `- [ ]` checklist live in `.tasks/current.md` so a compacted session resumes without re-asking. Delete it after a clean `commit`.
* **Branch:** tracked work happens on `feature/<task-slug>`, never `main`/`master`.

Workflow skills (explicit invocation only): `plan-flow <task>` → `orchestrate` → `review` → `commit [hint]`; plus `audit-code [path]`. Skills are referenced by name; each agent resolves them from its own skills directory.

## 3. Hard Rules

* **Circuit Breaker:** After 2 consecutive failed fixes on one error: STOP, revert (`git checkout -- <files>`, only files clean at slice start), re-read the full stack trace, state a new root-cause hypothesis before editing again.
* **Zero-Hang:** Never block on stdin: use non-interactive flags (`-y`, `--no-interaction`, `-m "<msg>"`); no interactive editors or `sudo`.
* **Strict Typing, no placeholders:** TypeScript: no `any`, explicit types. PHP: `declare(strict_types=1);` and typed signatures. Go: no bare `interface{}`, never discard errors with `_`. Python: full annotations/Pydantic. No stubs (`// ...`, `TODO: implement`), no dead or commented-out code, no AI attribution (`Co-Authored-By: Claude`).
* **Dependencies:** No new packages (`npm i <pkg>`, `pip install <pkg>`, `go get`, `composer require`) unless the approved plan lists them; installing declared ones (`npm ci`) is fine.
* **Secrets:** Never read, print, or commit `.env*` (only `.env.example` for key names), SSH keys, `*.pem`/`*.key`, or `.git/*`. Define env vars as typed validated config.
* **Destructive commands** (`rm -rf`, DB drops/truncation, `git reset --hard`, `git push --force`) require explicit human confirmation.
* **Slice rollback:** a slice that fails its Definition of Done is reverted to the last clean passing state.
