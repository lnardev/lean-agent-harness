# Lean Agent Harness (`lah`)

> Zero-bloat, token-efficient, platform-agnostic harness for coding agents. Built for **Claude Code**, **Cursor**, **OpenCode**, **Pi**, **Codex / Copilot**, and **CommandCode**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Install: npx](https://img.shields.io/badge/install-npx-green.svg)](https://www.npmjs.com/package/lean-agent-harness)
[![Install: curl](https://img.shields.io/badge/install-curl-orange.svg)](install.sh)

---

## Philosophy

Most AI agent templates introduce bloated scripts, heavy local dependencies, and multi-thousand-token prompt files that exhaust context windows before any code is written.

**Lean Agent Harness** enforces:
* **Token Economy:** Micro-prompts, targeted context retrieval, and terse communication.
* **Organic Driven Development (ODD):** Complex tasks are partitioned into small, reviewable milestones (chained PR slices) instead of massive, unreviewable diffs.
* **Strict Typing & Hygiene:** Zero dead code, no commented-out code blocks, no lazy placeholders (`// ...`, `TODO`), and full type signatures (TypeScript, PHP, Go, Python).
* **Defensive Guardrails:** Strict bans on unconfirmed destructive commands (`rm -rf`, database drops, hard git resets) and surprise dependency injections (`npm i`, `composer require`, `go get`).
* **True Portability:** Agents target abstract capabilities (read files, write files, run checks, track tasks), not proprietary tool signatures.

---

## Supported Environments

| Environment | Primary Target File | Local Configuration Path |
| :--- | :--- | :--- |
| **Claude Code** | `CLAUDE.md` / `AGENTS.md` | `.claude/commands/`, `~/.claude/` |
| **Cursor** | `.cursor/rules/agents.mdc` | Project `.cursor/rules/` |
| **OpenCode** | `AGENTS.md` | `.opencode/`, `~/.config/opencode/` |
| **Pi / Gentle Shell** | `AGENTS.md` | `.pi/`, `~/.pi/` |
| **Codex / GitHub Copilot** | `.github/copilot-instructions.md` | `.codex/instructions.md` |
| **CommandCode** | `AGENTS.md` | `.commandcode/` |

---

## Installation

### Method 1: via `npx` (Node.js 18+)

Run directly in the root of an existing project:

```bash
npx lean-agent-harness
```

To install globally into your user home directory (`~/.claude`, `~/.pi`, `~/.config/opencode`, etc.):

```bash
npx lean-agent-harness --global
```

If installed globally via npm (`npm i -g lean-agent-harness`), you can use the built-in aliases:

```bash
lean
# or
lah
```

---

### Method 2: via `curl` (Zero Dependencies / Any Environment)

No Node.js runtime required. Downloads directly from GitHub and unpacks atomically:

```bash
# Local project installation
curl -fsSL [https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh](https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh) | bash
```

For global installation across all user directories:

```bash
curl -fsSL [https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh](https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh) | bash -s -- --global
```

---

## Repository Structure

```text
lean-agent-harness/
├── bin/
│   └── cli.js                  # Native Node.js CLI runner (npx)
├── install.sh                  # Standalone POSIX Bash installer (curl)
├── package.json                # npm package configuration and aliases
├── AGENTS.md                   # Single source of truth for all agents
├── CLAUDE.md                   # Entrypoint & rules for Claude Code
├── agents/
│   ├── planner.md              # Read-only architect agent (tony-stark)
│   └── orchestrator.md         # Sequential execution driver & DoD guardian
├── commands/
│   ├── plan-flow.md            # /plan-flow <task>
│   ├── orchestrate.md          # /orchestrate <task>
│   ├── review.md               # /review [target] (risk-based technical review)
│   └── audit-code.md           # /audit-code [path] (deep security audit)
└── skills/
    ├── caveman/                # Terse, direct communication mode
    ├── humanizer/              # Polished human-facing prose (docs, READMEs)
    ├── diagram-design/         # Architectural SVG/HTML diagrams
    ├── impeccable/             # Frontend UI/UX, 4px/8px layout grid & CSS polish
    ├── security-audit/         # Static analysis, OWASP, auth bypass & injection
    ├── code-review/            # SonarQube-aligned bug & code smell review
    ├── testing/                # Unit/integration suites, mocks & edge cases
    └── db-migration/           # Zero-downtime, expand/contract migrations
```

---

## Operational Workflow

```
          ┌─────────────┐
          │  User Task  │
          └──────┬──────┘
                 │
                 ▼
          /plan-flow <task>
     (Inspect codebase, check schemas,
     partition into ODD milestones)
                 │
                 ▼
        /orchestrate <task>
    (Sequential execution of [ ] -> [x],
    dynamic skill loading, lint/tests)
                 │
        ┌────────┴────────┐
        ▼                 ▼
   Low Risk          High Risk (Auth, DB, Payments)
(Standard DoD)       (Auto-loads skills/security-audit)
        │                 │
        └────────┬────────┘
                 ▼
          /review [target]
   (Inspect diff against SonarQube gates,
    prevent regressions, atomic commit)
```

### 1. Planning (`/plan-flow <task>`)
* **Role:** Handled by `agents/planner.md`.
* **Behavior:** Read-only exploration. Inspects signatures, configurations, and directory structures. Never writes code.
* **Output:** Produces an implementation plan split into **ODD slices** (max 4 core files per slice) ending with a clear, actionable `- [ ] ` checklist.

### 2. Execution (`/orchestrate <task>`)
* **Role:** Handled by `agents/orchestrator.md`.
* **Behavior:** Takes the planned checklist and executes tasks sequentially (`- [ ] ` $\rightarrow$ `- [x] `).
* **Skill Allocation:** Loads corresponding domain skills from `skills/<name>/SKILL.md` prior to editing files.
* **Definition of Done (DoD):** Verifies syntax, runs linters, and executes test suites before marking tasks as complete.

### 3. Verification & Auditing
* **`/review [target]`:** Focuses strictly on the active `git diff` (or specified file). Automatically assesses file risk: changes to Auth, DB schemas, or Payments auto-trigger `skills/security-audit/SKILL.md`.
* **`/audit-code [path]`:** Performs a deep static security analysis of entire directories in cold storage (OWASP Top 10, injection vectors, input validation flaws).

---

## Surgical Skills Directory

Skills are self-contained markdown definitions loaded on-demand to keep token consumption minimal:

| Skill | Trigger / Domain | Responsibility |
| :--- | :--- | :--- |
| **`caveman`** | Default conversational mode | Ultra-compressed status outputs, zero conversational padding. |
| **`humanizer`** | Documentation, READMEs, changelogs | Natural, professional, human-grade prose. |
| **`diagram-design`**| System architecture, ERDs, flows | Generates standalone HTML/SVG technical diagrams. |
| **`impeccable`** | Frontend, styles, UI layouts | Enforces 4px/8px design grids, typography scale, responsive CSS. |
| **`security-audit`**| Static application security (SAST) | Checks for SQLi, XSS, SSRF, broken access controls, IDOR. |
| **`code-review`** | PRs, active git diffs | Flags SonarQube Code Smells, cyclomatic complexity, memory leaks. |
| **`testing`** | Unit & integration test suites | Test-driven development, deterministic mocks, boundary conditions. |
| **`db-migration`** | Relational database schema changes | Zero-downtime expand/contract patterns, locking safeguards. |

---

## Core Execution Directives

1. **Strict Typing Across All Stacks:**
   * **TypeScript:** No `any`. Explicit interfaces, union types, and declared function return types.
   * **PHP:** Always enforce `declare(strict_types=1);`, typed properties, and explicit method returns.
   * **Go:** No empty `interface{}` or bypassed errors via `_`.
   * **Python:** Strict type hints using `typing` or Pydantic models.
2. **Zero Incomplete Code:**
   * Comments containing `// ...`, `TODO: implement later`, or dummy stubs are strictly forbidden. All logic must be fully implemented.
   * Commented-out dead code blocks must be deleted, not left behind.
3. **Dependency Lockdown:**
   * Agents may not run package installation commands (`npm install`, `composer require`, `go get`, `pip install`) unless explicitly specified in the `/plan-flow` checklist. Use the standard library whenever possible.
4. **Destructive Guardrails:**
   * Agents are barred from running recursive deletions (`rm -rf`), dropping database tables, truncating storage, or running destructive Git commands (`git reset --hard`, `git push --force`) without explicit confirmation.
5. **Atomic Commits:**
   * After each validated milestone slice, changes must remain isolated and clean for atomic Git commits using Conventional Commits (`feat:`, `fix:`, `refactor:`).

---

## License

MIT © [lnardev](https://github.com/lnardev)