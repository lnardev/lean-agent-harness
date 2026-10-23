# Lean Agent Harness (`lah`)

> Zero-bloat, token-efficient, platform-agnostic harness for coding agents. Built for **Claude Code**, **Cursor**, **OpenCode**, **Pi**, **Codex**, **Copilot**, and **CommandCode**.

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

## Supported Environments & Target Paths

The installer detects existing tool configurations automatically and routes assets to their exact runtime paths:

| Environment | Mode | Target Directory / Configuration Path |
| :--- | :--- | :--- |
| **Claude Code** | Global / Local | `~/.claude/` or `.claude/` (commands, skills, `AGENTS.md`, `CLAUDE.md`) |
| **Pi / Gentle Shell** | Global / Local | `~/.pi/agent/` or `.pi/agent/` (agent runtime, skills, commands, `AGENTS.md`) |
| **CommandCode** | Global / Local | `~/.commandcode/` or `.commandcode/` (agents, skills, commands, `AGENTS.md`) |
| **OpenCode** | Global / Local | `~/.config/opencode/` or `.opencode/` (agents, skills, commands, `AGENTS.md`) |
| **Codex** | Global / Local | `~/.codex/` or `.codex/` (`instructions.md`, `AGENTS.md`) |
| **GitHub Copilot** | Global / Local | `~/.copilot/` or `.copilot/` & `.github/copilot-instructions.md` |
| **Cursor** | Local | `.cursor/rules/agents.mdc` |

---

## Installation

### Method 1: via `curl` (Zero Dependencies — Recommended)

No Node.js runtime required. Executes directly in your terminal with interactive detection:

```bash
curl -fsSL [https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh | bash
```

#### Interactive Wizard Features
When executed in an interactive terminal, the script:
1. Asks whether to install in **Global** (`~/`) or **Local** (`./`) mode.
2. Scans your system and reports which assistants are already present (e.g., `claude`, `pi`).
3. Offers three deployment strategies:
   * `[1]` **Auto:** Install only into detected environments.
   * `[2]` **Manual:** Prompt with `[S/n]` for each individual harness.
   * `[3]` **All:** Deploy to every supported assistant.

#### Automated Execution (CI / CD / Scripting Flags)
Skip prompts by passing flags via `bash -s --`:

```bash
# Deploy globally only to tools already detected on your machine
curl -fsSL [https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh](https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh) | bash -s -- --global --auto

# Force global installation across all supported assistants
curl -fsSL [https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh](https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh) | bash -s -- --global --all

# Force local installation in current repository across all harnesses
curl -fsSL [https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh](https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh) | bash -s -- --local --all
```

---

### Method 2: via `npx` (Node.js 18+)

Run inside any project directory:

```bash
npx lean-agent-harness
```

To install globally into your home directory:

```bash
npx lean-agent-harness --global
```

If installed globally via npm (`npm i -g lean-agent-harness`), you can execute it anytime with short aliases:

```bash
lean
# or
lah
```

---

## Repository Structure

```text
lean-agent-harness/
├── bin/
│   └── cli.js                  # Native Node.js CLI runner (npx / npm)
├── install.sh                  # Interactive POSIX installer (curl | bash)
├── package.json                # npm package configuration and aliases
├── AGENTS.md                   # Single source of truth for all agents
├── CLAUDE.md                   # Entrypoint & rules for Claude Code
├── agents/
│   ├── planner.md              # Read-only architect agent (ODD slices)
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

```text
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
* **Behavior:** Read-only exploration. Inspects signatures, schemas, configurations, and directory layout. Never edits files.
* **Output:** Produces an implementation plan split into **ODD slices** (max 4 core files per slice) ending with a clear, actionable `- [ ] ` checklist.

### 2. Execution (`/orchestrate <task>`)
* **Role:** Handled by `agents/orchestrator.md`.
* **Behavior:** Ingests the plan checklist and executes tasks sequentially (`- [ ] ` $\rightarrow$ `- [x] `).
* **Skill Allocation:** Loads corresponding domain skills from `skills/<name>/SKILL.md` prior to touching files.
* **Definition of Done (DoD):** Verifies syntax, runs linters, and executes test suites before marking tasks as complete.

### 3. Verification & Auditing
* **`/review [target]`:** Focuses strictly on the active `git diff` (or specified file). High-risk edits (Auth, DB schemas, Payments) automatically trigger `skills/security-audit/SKILL.md`.
* **`/audit-code [path]`:** Performs a deep static security analysis of directories in cold storage (OWASP Top 10, injection vectors, input validation flaws).

---

## Surgical Skills Directory

Skills are self-contained markdown definitions loaded dynamically on-demand to conserve context tokens:

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
   * Agents may not run package installation commands (`npm install`, `composer require`, `go get`, `pip install`) unless explicitly specified in the `/plan-flow` checklist. Use standard libraries whenever possible.
4. **Destructive Guardrails:**
   * Agents are barred from running recursive deletions (`rm -rf`), dropping database tables, truncating storage, or running destructive Git commands (`git reset --hard`, `git push --force`) without explicit confirmation.
5. **Atomic Commits:**
   * After each validated milestone slice, changes must remain isolated and clean for atomic Git commits using Conventional Commits (`feat:`, `fix:`, `refactor:`).

---

## License

MIT © [lnardev](https://github.com/lnardev)
