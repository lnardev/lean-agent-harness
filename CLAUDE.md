# Agent Configuration

Single source of truth for all coding agents (Pi, OpenCode, Claude Code, Cursor, Gemini CLI).

## Skills

Domain skills live in `skills/<name>/SKILL.md`. Load the relevant skill(s) BEFORE writing code. Skills may combine.

- **caveman** — terse conversation mode (`/caveman ultra`); applied by default in chat.
- **humanizer** — human-facing prose (README, docs, guides, changelogs).
- **diagram-design** — publication-grade architecture, flow, sequence, ER diagrams (HTML/SVG).
- **impeccable** — frontend UI/UX design, 4px/8px layout grid, typography, CSS polish.
- **security-audit** — static vulnerability review, auth bypasses, injection points, threat modeling.
- **code-review** — fast multi-axis technical review (Bugs, Code Smells, SonarQube quality gates).
- **testing** — unit & integration tests, parameterized suites, deterministic mocks, edge cases.
- **db-migration** — zero-downtime migrations, expand/contract pattern, safe indexing, lock prevention.

## Subagents & Commands

- **`agents/planner.md`** — read-only analysis, trade-offs, ODD slices, planning (`tony-stark`).
- **`agents/orchestrator.md`** — task coordination, sequential execution, destructive guards, DoD validation.
- **`commands/plan-flow.md`** — `/plan-flow <task>`: explore architecture, design execution checklist (`- [ ] `).
- **`commands/orchestrate.md`** — `/orchestrate <task>`: step-by-step execution through checklists and DoD.
- **`commands/audit-code.md`** — `/audit-code [path]`: deep security audit via `security-audit`.
- **`commands/review.md`** — `/review [target]`: risk-based review (code-review + conditional security-audit).

## Execution Rules

1. **Communication:** Colombian coastal accent, direct, confident. Apply caveman for conversation.
2. **Skills first:** Load matching skill before writing or reviewing code.
3. **Surgical edits:** Minimal, focused changes. No churn, no premature abstractions.
4. **Code hygiene & strict typing:** Always declare complete types. Never leave commented-out legacy code, dead code, or lazy placeholders (`// ...`, `TODO`, stubs). Implement the logic completely.
5. **Definition of Done:** Validate syntax, lint, and tests before closing a task. Never commit AI attribution or `Co-Authored-By`. Never run builds unless explicitly ordered. Verify answers against real code.
6. **Terse answers:** Verified against real code first.

## Portability Rule

Prompts, commands, and subagents name capabilities (read files, edit files, run commands, track tasks, load skills), never tool names. Each agent resolves capabilities with its own harness tools.