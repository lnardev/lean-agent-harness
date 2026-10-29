# Lean Agent Harness (`lah`)

One rule file and one skill format for **Claude Code**, **Pi**, **OpenCode**, **Codex**, **Cursor**, **Copilot** and **CommandCode**. Standing context is `AGENTS.md` (about 0.8k tokens) plus one line per skill.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## How it works

Everything ships as [Agent Skills](https://agentskills.io) (`skills/<name>/SKILL.md`, with `name` and `description` frontmatter) plus a single `AGENTS.md`. There are no separate command or subagent files, so there is nothing to translate per tool.

* **Domain skills** (`testing`, `security-audit`, `db-migration`, `diagnosing-bugs`, `code-review`, `impeccable`, `humanizer`, `diagram-design`) load on demand when the task matches their description.
* **Workflow skills** (`plan-flow`, `orchestrate`, `review`, `audit-code`, `commit`) set `disable-model-invocation: true` (plus `agents/openai.yaml` for Codex). Claude Code, Pi, Cursor and Codex never offer them to the model, so their descriptions cost no tokens until you call them. OpenCode and Copilot ignore the flag and list them (one short line each). The Planner and Orchestrator roles live inside `plan-flow` and `orchestrate`.

```text
plan-flow <task> → orchestrate → review [target] → commit [hint]      audit-code [path]
 (read-only plan)   (RED-GREEN, DoD)  (audit git diff)   (atomic commit)   (security scan)
```

How you invoke a workflow skill depends on the tool: `/plan-flow` in Claude Code, Cursor and OpenCode (through a command stub in `adapters/`), `/skill:plan-flow` in Pi, `$plan-flow` in Codex.

## Where files go

| Scope | Files |
| :--- | :--- |
| Project | `AGENTS.md`, `CLAUDE.md` (imports `@AGENTS.md`), `GLOSSARY.md` (only if missing) at the root; skills in `.claude/skills/` and `.agents/skills/`; OpenCode command stubs in `.opencode/commands/` |
| User (`--global`) | `~/.claude/{CLAUDE.md,AGENTS.md,skills}`, `~/.agents/skills`, `~/.pi/agent/AGENTS.md`, `~/.config/opencode/{AGENTS.md,commands}`, `~/.codex/AGENTS.md`, `~/.copilot/copilot-instructions.md`, `~/.commandcode/{AGENTS.md,skills}` |

`.agents/skills` is read natively by Pi, OpenCode, Codex, Copilot and Cursor. Claude Code reads `.claude/skills`. Every destination is a row in `manifest.tsv`, which both installers read.

## Install

```bash
npx lean-agent-harness            # into the current project
npx lean-agent-harness --global   # into your home directory
```

Without Node.js:

```bash
curl -fsSL https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh | bash
curl -fsSL https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh | bash -s -- --global --auto
```

`install.sh` accepts `--global`, `--local`, `--all`, `--auto`, auto-detects existing environments and never blocks without a TTY. An existing `AGENTS.md`/`CLAUDE.md` that differs is saved as `.bak` before it is replaced. An existing `GLOSSARY.md` is never touched.

```bash
npm test   # installs with both installers and asserts identical output trees
```

## Repository layout

```text
AGENTS.md          Single source of rules
CLAUDE.md          Imports AGENTS.md for Claude Code
GLOSSARY.md        Harness vocabulary; replace it with your domain terms in client projects
manifest.tsv       Destinations per target and scope (read by both installers)
skills/            Domain and workflow skills
adapters/opencode/ Command stubs that point OpenCode slash commands at skills
bin/cli.js         npx installer
install.sh         curl installer
```

## Principles

* **Token economy:** short standing rules, on-demand skills, explicit-only workflows.
* **Slices (ODD):** complex work becomes small, feature-complete, reviewable slices tracked in `.tasks/current.md`.
* **Strict typing, no placeholders, dependency lockdown, confirmation before destructive commands.** Full text in `AGENTS.md`.

## License

MIT © [lnardev](https://github.com/lnardev)
