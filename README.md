# Lean Agent Harness (`lah`)

Zero-bloat, token-efficient, platform-agnostic harness for coding agents. Built for **Claude Code**, **Cursor**, **OpenCode**, **Pi**, **Codex / Copilot**, and **CommandCode**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Philosophy

Most AI agent templates ship bloated scripts, heavy local dependencies, and multi-thousand-token prompt files that exhaust context windows before any code is written.

**Lean Agent Harness** enforces:

* **Token Economy:** Micro-prompts (~1k tokens of standing rules), targeted context retrieval, and terse communication.
* **Organic Driven Development (ODD):** Complex tasks are partitioned into small, reviewable, feature-complete milestone slices instead of massive, unreviewable diffs.
* **Strict Typing & Hygiene:** Zero dead code, no lazy placeholders (`// ...`, `TODO`), and full type signatures (TypeScript, PHP, Go, Python).
* **Defensive Guardrails:** Explicit confirmation for destructive commands (`rm -rf`, database drops, `git reset --hard`) and dependency lockdown outside the approved plan.
* **True Portability:** Agents target abstract capabilities (read files, write files, run checks, track tasks), not proprietary tool signatures. One `AGENTS.md`, seven platforms.

---

## Supported Environments

| Environment | Instruction File | Local Config | Global Config |
| :--- | :--- | :--- | :--- |
| **Claude Code** | `AGENTS.md` / `CLAUDE.md` | `.claude/` | `~/.claude/` |
| **Pi** | `AGENTS.md` | `.pi/agent/` | `~/.pi/agent/` |
| **OpenCode** | `AGENTS.md` | `.opencode/` | `~/.config/opencode/` |
| **Cursor** | `.cursor/rules/agents.mdc` | `.cursor/rules/` | — |
| **Codex** | `instructions.md` | `.codex/` | `~/.codex/` |
| **Copilot** | `copilot-instructions.md` | `.copilot/`, `.github/` | `~/.copilot/` |
| **CommandCode** | `AGENTS.md` | `.commandcode/` | `~/.commandcode/` |

---

## Installation

### Method 1: via `npx` (Node.js 18+)

Run in the root of an existing project:


```bash
npx lean-agent-harness
```

To install globally into your user home directory (`~/.claude`, `~/.pi/agent`, `~/.config/opencode`, etc.):

```bash
npx lean-agent-harness --global
```

If installed globally via npm (`npm i -g lean-agent-harness`), use the aliases:

```bash
lean   # or: lah
```

### Method 2: via `curl` (Zero dependencies / any environment)

No Node.js runtime required. Downloads directly from GitHub and unpacks atomically:

```bash
curl -fsSL https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh | bash
```

For global installation across all user directories:

```bash
curl -fsSL https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh | bash -s -- --global
```

The shell installer auto-detects pre-existing environments, never blocks without a TTY, and accepts `--global`, `--local`, `--all`, `--auto`.

### Verification

```bash
npm test   # node:test suite for the CLI installer
```

---

## Repository Structure

```text
lean-agent-harness/
├── bin/
<<<<<<< HEAD
│   └── cli.js                  # Native Node.js CLI runner (npx / npm)
├── install.sh                  # Interactive POSIX installer (curl | bash)
├── package.json                # npm package configuration and aliases
=======
<<<<<<< HEAD
<<<<<<< HEAD
│   └── cli.js                  # Native Node.js CLI runner (npx), manifest-driven
├── install.sh                  # Standalone POSIX Bash installer (curl)
├── package.json                # npm package config, aliases, and test script
=======
│   └── cli.js                  # Native Node.js CLI runner (npx / npm)
├── install.sh                  # Interactive POSIX installer (curl | bash)
├── package.json                # npm package configuration and aliases
>>>>>>> 670fee6 (fix: added new configuration to readme)
=======
│   └── cli.js                  # Native Node.js CLI runner (npx / npm), manifest-driven
├── install.sh                  # Interactive POSIX installer (curl | bash), bash-3.2 safe
├── package.json                # npm package configuration, aliases, and test script
>>>>>>> 09ecacd (docs: fix README links/structure and ground GLOSSARY in harness domain)
>>>>>>> c88f8f2 (docs: fix README links/structure and ground GLOSSARY in harness domain)
├── AGENTS.md                   # Single source of truth for all agents
├── CLAUDE.md                   # Entrypoint & rules for Claude Code
├── GLOSSARY.md                 # Ubiquitous language template (domain glossary)
├── agents/
│   ├── planner.md              # Read-only architect agent (ODD slices)
│   └── orchestrator.md         # Sequential execution driver & DoD guardian
├── commands/
│   ├── plan-flow.md            # /plan-flow <task>
│   ├── orchestrate.md          # /orchestrate <task>
│   ├── review.md               # /review [target] (risk-based diff review)
│   ├── audit-code.md           # /audit-code [path] (deep security audit)
│   └── commit.md               # /commit [hint] (atomic conventional commit)
├── test/
│   └── cli.test.js             # node:test suite for the CLI installer
└── skills/
    ├── diagnosing-bugs/        # 6-phase scientific debugging loop
    ├── humanizer/              # Polished human-facing prose (docs, READMEs)
    ├── diagram-design/         # Publication-grade HTML/SVG architecture diagrams
    ├── impeccable/             # Frontend UI/UX, 4px/8px grid & CSS polish
    ├── security-audit/         # Static analysis, OWASP, auth bypass & injection
    ├── code-review/            # SonarQube-aligned bug & code smell review
    ├── testing/                # Unit/integration suites, mocks & edge cases
    └── db-migration/           # Zero-downtime expand/contract migrations
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
     (Inspect codebase, check manifests,
     partition into ODD milestone slices)
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
    prevent regressions)
                 │
                 ▼
          /commit [hint]
   (Quality gates, selective staging,
    atomic conventional commit)
```

### 1. Planning (`/plan-flow <task>`)
* **Role:** Handled by `agents/planner.md`.
<<<<<<< HEAD
=======
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> c88f8f2 (docs: fix README links/structure and ground GLOSSARY in harness domain)
* **Behavior:** Read-only exploration. Inspects signatures, manifests, and directory structure. Never writes code.
* **Output:** An implementation plan split into **ODD slices** (cohesive, feature-complete units) ending with an actionable `- [ ] ` checklist persisted to `.tasks/current.md`.

### 2. Execution (`/orchestrate <task>`)
* **Role:** Handled by `agents/orchestrator.md`.
<<<<<<< HEAD
* **Behavior:** Ingests the plan checklist and executes tasks sequentially (`- [ ] ` $\rightarrow$ `- [x] `).
* **Skill Allocation:** Loads corresponding domain skills from `skills/<name>/SKILL.md` prior to touching files.
* **Definition of Done (DoD):** Verifies syntax, runs linters, and executes test suites before marking tasks as complete.

### 3. Verification & Auditing
* **`/review [target]`:** Focuses strictly on the active `git diff` (or specified file). Changes to Auth, DB schemas, or Payments auto-trigger `skills/security-audit/SKILL.md`.
* **`/audit-code [path]`:** Deep static security analysis of entire directories (OWASP Top 10, injection vectors, input validation flaws).

---
=======
* **Behavior:** Executes tasks sequentially (`- [ ] ` → `- [x] `), loading the domain skills from `skills/<name>/SKILL.md` required for each slice.
* **Definition of Done (DoD):** Verifies syntax, runs linters, and executes test suites with cited terminal evidence before marking tasks complete.

### 3. Verification & Auditing
* **`/review [target]`:** Focuses strictly on the active `git diff` (or specified file). Changes to Auth, DB schemas, or Payments auto-trigger `skills/security-audit/SKILL.md`.
* **`/audit-code [path]`:** Deep static security analysis of entire directories (OWASP Top 10, injection vectors, input validation flaws).
=======
* **Behavior:** Read-only exploration. Inspects signatures, schemas, configurations, and directory layout. Never edits files.
* **Output:** Produces an implementation plan split into **ODD slices** (max 4 core files per slice) ending with a clear, actionable `- [ ] ` checklist.
=======
* **Behavior:** Read-only exploration. Inspects signatures, manifests, and directory structure. Never writes code.
* **Output:** An implementation plan split into **ODD slices** (cohesive, feature-complete units) ending with an actionable `- [ ] ` checklist persisted to `.tasks/current.md`.
>>>>>>> 09ecacd (docs: fix README links/structure and ground GLOSSARY in harness domain)

### 2. Execution (`/orchestrate <task>`)
* **Role:** Handled by `agents/orchestrator.md`.
* **Behavior:** Executes tasks sequentially (`- [ ] ` → `- [x] `), loading the domain skills from `skills/<name>/SKILL.md` required for each slice.
* **Definition of Done (DoD):** Verifies syntax, runs linters, and executes test suites with cited terminal evidence before marking tasks complete.

### 3. Verification & Auditing

* **`/review [target]`:** Focuses strictly on the active `git diff` (or specified file). High-risk edits (Auth, DB schemas, Payments) automatically trigger `skills/security-audit/SKILL.md`.
* **`/audit-code [path]`:** Performs a deep static security analysis of directories in cold storage (OWASP Top 10, injection vectors, input validation flaws).
>>>>>>> c88f8f2 (docs: fix README links/structure and ground GLOSSARY in harness domain)

## Surgical Skills Directory

Skills are self-contained markdown definitions loaded dynamically on-demand to conserve context tokens:

| Skill | Trigger / Domain | Responsibility |
| :--- | :--- | :--- |
| **`diagnosing-bugs`** | Stubborn defects, race conditions | 6-phase scientific debugging loop (reproduce → minimize → hypothesis → instrument → fix → regression). |
| **`humanizer`** | Documentation, READMEs, changelogs | Natural, professional, human-grade prose. |
| **`diagram-design`** | System architecture, ERDs, flows | Generates standalone HTML/SVG technical diagrams. |
| **`impeccable`** | Frontend, styles, UI layouts | Enforces 4px/8px design grids, typography scale, responsive CSS. |
| **`security-audit`** | Static application security (SAST) | Checks for SQLi, XSS, SSRF, broken access controls, IDOR. |
| **`code-review`** | PRs, active git diffs | Flags SonarQube code smells, cyclomatic complexity, memory leaks. |
| **`testing`** | Unit & integration test suites | Test-driven development, deterministic mocks, boundary conditions. |
| **`db-migration`** | Relational database schema changes | Zero-downtime expand/contract patterns, locking safeguards. |

---

## Core Execution Directives

1. **Strict Typing Across All Stacks:**
   * **TypeScript:** No `any`. Explicit interfaces, union types, declared return types.
   * **PHP:** `declare(strict_types=1);`, typed properties, explicit method returns.
   * **Go:** No empty `interface{}`; no errors discarded via `_`.
   * **Python:** Strict type hints (`typing`, Pydantic).
2. **Zero Incomplete Code:**
   * `// ...`, `TODO: implement later`, dummy stubs, and commented-out dead code are forbidden. All logic must be fully implemented.
3. **Dependency Lockdown:**
<<<<<<< HEAD
   * No package installs (`npm install`, `composer require`, `go get`, `pip install`) unless explicitly listed in the `/plan-flow` checklist. Prefer the standard library.
=======

   * No package installs (`npm install`, `composer require`, `go get`, `pip install`) unless explicitly listed in the `/plan-flow` checklist. Prefer the standard library.
   * Agents may not run package installation commands (`npm install`, `composer require`, `go get`, `pip install`) unless explicitly specified in the `/plan-flow` checklist. Use standard libraries whenever possible.
>>>>>>> c88f8f2 (docs: fix README links/structure and ground GLOSSARY in harness domain)
4. **Destructive Guardrails:**
   * No recursive deletions, database drops, truncations, or destructive Git commands (`git reset --hard`, `git push --force`) without explicit confirmation.
5. **Atomic Commits:**
   * After each validated milestone slice, changes stay isolated and clean for atomic Git commits using Conventional Commits (`feat:`, `fix:`, `refactor:`).

---

## License

MIT © [lnardev](https://github.com/lnardev)
