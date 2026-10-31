# Lean Agent Harness (`lah`)

One rule file and one skill format for **Claude Code**, **Pi**, **OpenCode**, **Codex**, **Cursor**, **Copilot** and **CommandCode**. Standing context is `AGENTS.md` (about 0.9k tokens) plus one line per skill.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## How it works

Everything ships as [Agent Skills](https://agentskills.io) (`skills/<name>/SKILL.md`, with `name` and `description` frontmatter) plus a single `AGENTS.md`. There are no separate command or subagent files, so there is nothing to translate per tool.

* **Domain skills** (`testing`, `security-audit`, `db-migration`, `diagnosing-bugs`, `code-review`, `impeccable`, `humanizer`, `diagram-design`) load on demand when the task matches their description.
* **Workflow skills** (`plan-flow`, `orchestrate`, `review`, `audit-code`, `commit`) set `disable-model-invocation: true` (plus `agents/openai.yaml` for Codex). Claude Code, Pi, Cursor and Codex never offer them to the model, so their descriptions cost no tokens until you call them. OpenCode and Copilot ignore the flag and list them (one short line each). The Planner and Orchestrator roles live inside `plan-flow` and `orchestrate`. Slices tagged `Risk: high` are verified and reviewed in a fresh context; every `SKILL.md` stays under 3000 bytes and long detail loads from `references/`.

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

`install.sh` accepts `--global`, `--local`, `--all`, `--auto`, `--profile core|full`, auto-detects existing environments and never blocks without a TTY. An existing `AGENTS.md`/`CLAUDE.md` that differs is saved as `.bak` before it is replaced; if a `.bak` already exists, the next one is `.bak.1`, `.bak.2`, and so on, so no version is lost. An existing `GLOSSARY.md` is never touched; a missing one is seeded from `templates/GLOSSARY.md`.

**Pinning and verifying the `curl` install.** The one-liner runs the `main` branch unless you pin it:

```bash
curl -fsSL https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh | LAH_VERSION=1.3.1 LAH_SHA256=<sha256-of-the-archive> bash -s -- --global --auto
```

`LAH_VERSION` downloads that release tag. `LAH_SHA256` makes the installer abort, before deploying anything, if the archive does not match. Without it the installer says that the checksum is not verified. GitHub does not publish archive checksums, so compute the value once from a copy you trust, for example `shasum -a 256` on the archive of that tag. GitHub's generated archives are not guaranteed to stay byte-identical over time, so if a previously valid checksum stops matching, recompute it from a trusted copy before assuming tampering.

**Profiles.** `--profile core` skips the skills listed in `profile-extras.txt` (`impeccable`, `humanizer`, `diagram-design`, `db-migration`), whose descriptions cost standing tokens in every project. `full` is the default. Both installers read the same file.

```bash
npx lean-agent-harness --global --profile core
```

**Guard (opt-in).** `AGENTS.md` is advice the model may ignore. `--global --guard` adds enforcement where the tool supports it, all generated from `guard/policy.json`: a `PreToolUse` hook for Claude Code (registered in `~/.claude/settings.json` by merge, with a `.bak` of the previous file), an extension for Pi and command rules for Codex. Secret files (`.env*`, `*.pem`, `*.key`, `.ssh/`) are denied; `rm -r`, `git reset --hard`, `git push --force` and `sudo` ask first. Best effort, not a sandbox: commands built through an interpreter (`python -c`) are not seen, and a `Grep` aimed at a whole directory can still reach a secret file inside it. Cursor, OpenCode, Copilot and CommandCode have no guard. `install.sh --guard` needs `node`.

```bash
npx lean-agent-harness --global --guard
```

```bash
npm test   # installs with both installers and asserts identical output trees
```

## Repository layout

```text
AGENTS.md          Single source of rules
CLAUDE.md          Imports AGENTS.md for Claude Code
GLOSSARY.md        Harness vocabulary (this repo only)
templates/         GLOSSARY.md seed deployed to client projects when missing
manifest.tsv       Destinations per target and scope (read by both installers)
profile-extras.txt Skills omitted by --profile core (read by both installers)
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
