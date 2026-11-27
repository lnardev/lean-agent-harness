# Lean Agent Harness (`lah`)

**One rule file and one skill format for your coding agents.**

`lah` installs a single `AGENTS.md` and a set of [Agent Skills](https://agentskills.io) into Claude Code, Pi, OpenCode, Codex, Cursor, Copilot and CommandCode. Standing context is `AGENTS.md` (about 0.9k tokens) plus one line per skill. Cursor reads `AGENTS.md` from a project install only.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/lean-agent-harness)](https://www.npmjs.com/package/lean-agent-harness)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-339933)](package.json)

```text
    PLAN             BUILD              REVIEW             COMMIT
 ┌───────────┐     ┌───────────┐     ┌────────────┐     ┌──────────┐
 │  Slices   │ ──▶ │ RED→GREEN │ ──▶ │  Git diff  │ ──▶ │  Atomic  │
 │ read-only │     │ DoD gate  │     │   audit    │     │  commit  │
 └───────────┘     └───────────┘     └────────────┘     └──────────┘
  /plan-flow        /orchestrate      /review-audit      /commit
```

## Commands

Four workflow commands, one per step. You start each one yourself.

| What you're doing | Command | Key rule |
| :--- | :--- | :--- |
| Plan a change | `/plan-flow <task>` | Read-only; writes slices to `.tasks/current.md` |
| Build it | `/orchestrate` | Test first; a slice closes when its Definition of Done passes |
| Review the diff | `/review-audit [low\|medium\|high] [target]` | Reports only; Blocker and Critical findings block the commit |
| Commit | `/commit [hint]` | Quality gates first, then a Conventional Commit |

The spelling depends on the tool: `/plan-flow` in Claude Code, Cursor and OpenCode, `/skill:plan-flow` in Pi, `$plan-flow` in Codex.

After `commit`, ask for a pull request (for example "create the PR"). The `pull-request` skill checks the branch with a script (Node.js 24+), writes the pull request, pushes the branch and creates or updates it. It never merges.

<details>
<summary><b>What the review levels report</b></summary>

**`review-audit` levels.** The first argument sets how much the review reports; it is not a quality score and no metric is computed. `low` reports only Blocker and Critical findings the reviewer is certain of; `medium` (the default) adds WARNING findings verified in the code; `high` adds SUGGESTION and uncertain findings, marked PLAUSIBLE. A Blocker or Critical finding blocks `commit`; WARNING and SUGGESTION are listed once and never trigger fixes. Separately, a slice tagged `Risk: high` in the plan makes the review run in a fresh context (a subagent or a new session). Example: `/review-audit low`.

</details>

## Quick start

Requires Node.js 24 or later for `npx` and `--guard` (24.22.2 or the latest 24.x recommended). Older versions are past or near end of life and get an `EBADENGINE` warning.

```bash
npx lean-agent-harness            # into the current project
npx lean-agent-harness --global   # into your home directory
```

Without Node.js:

```bash
curl -fsSL https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh | bash
curl -fsSL https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh | bash -s -- --global --auto
```

A project install writes `AGENTS.md`, `CLAUDE.md` (imports `@AGENTS.md`) and, only if missing, `GLOSSARY.md` at the root, plus the skill folders listed below. `.agents/skills` is read natively by Pi, OpenCode, Codex, Copilot and Cursor; Claude Code reads `.claude/skills`. Every destination is a row in `manifest.tsv`, which both installers read.

### Your tool

<details>
<summary><b>Claude Code</b></summary>

| Scope | Files |
| :--- | :--- |
| Project | `.claude/skills/` |
| User (`--global`) | `~/.claude/CLAUDE.md`, `~/.claude/AGENTS.md`, `~/.claude/skills/` |

Run `/plan-flow`. `--global --guard` adds a `PreToolUse` hook, and `--global --memory-hook` is available for this tool only.

</details>

<details>
<summary><b>Pi</b></summary>

| Scope | Files |
| :--- | :--- |
| Project | `.agents/skills/` |
| User (`--global`) | `~/.pi/agent/AGENTS.md`, `~/.agents/skills/` |

Run `/skill:plan-flow`. `--global --guard` adds a Pi extension.

</details>

<details>
<summary><b>OpenCode</b></summary>

| Scope | Files |
| :--- | :--- |
| Project | `.agents/skills/`, `.opencode/commands/` |
| User (`--global`) | `~/.config/opencode/AGENTS.md`, `~/.config/opencode/commands/`, `~/.agents/skills/` |

Run `/plan-flow`, a command stub from `adapters/`. OpenCode ignores `disable-model-invocation` and lists the workflow skills (one short line each). `--global --guard` adds permission rules.

</details>

<details>
<summary><b>Codex</b></summary>

| Scope | Files |
| :--- | :--- |
| Project | `.agents/skills/` |
| User (`--global`) | `~/.codex/AGENTS.md`, `~/.agents/skills/` |

Run `$plan-flow`. `agents/openai.yaml` keeps workflow skills explicit. `--global --guard` adds command rules.

</details>

<details>
<summary><b>Cursor</b></summary>

| Scope | Files |
| :--- | :--- |
| Project | `.agents/skills/` |
| User (`--global`) | `~/.agents/skills/` |

Run `/plan-flow`. Cursor has no guard.

A global install adds no rule file for Cursor; a project install gives it `AGENTS.md`. `install.sh --auto` does not detect `~/.cursor` in a global install, so use `npx lean-agent-harness --global` or `install.sh --global --all`.

</details>

<details>
<summary><b>Copilot</b></summary>

| Scope | Files |
| :--- | :--- |
| Project | `.agents/skills/` |
| User (`--global`) | `~/.copilot/copilot-instructions.md`, `~/.agents/skills/` |

Copilot ignores `disable-model-invocation` and lists the workflow skills (one short line each). It has no guard.

</details>

<details>
<summary><b>CommandCode</b></summary>

| Scope | Files |
| :--- | :--- |
| Project | `.commandcode/skills/` |
| User (`--global`) | `~/.commandcode/AGENTS.md`, `~/.commandcode/skills/` |

CommandCode has no guard.

</details>

### Options

<details>
<summary><b>Existing files and installer flags</b></summary>

`install.sh` accepts `--global`, `--local`, `--all`, `--auto`, `--guard`, `--memory-hook` and `--profile core|full` (`npx` takes the same flags except `--all` and `--auto`). It auto-detects existing environments and never blocks without a TTY. An existing `AGENTS.md`/`CLAUDE.md` that differs is never lost: the original is saved as `.bak` (then `.bak.1`, `.bak.2`, ...), and its rules are merged into the deployed file under a `## Project Rules` section delimited by `lah:project-rules` comments, so they stay in the agent's context. Reinstalls change nothing over a merged file; upgrades replace only the harness part and keep the section. A file the harness itself deployed (the `lean-agent-harness` marker, the 1.x `Single source of truth` line or the 1.x `# Claude Code Project Configuration` heading) is replaced without absorbing the old harness text. An existing `GLOSSARY.md` is never touched; a missing one is seeded from `templates/GLOSSARY.md`.

</details>

<details>
<summary><b>Pin and verify the curl install</b></summary>

The one-liner runs the `main` branch unless you pin it:

```bash
curl -fsSL https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh | LAH_VERSION=3.5.0 LAH_SHA256=<sha256-of-the-archive> bash -s -- --global --auto
```

`LAH_VERSION` downloads that release tag. `LAH_SHA256` makes the installer abort, before deploying anything, if the archive does not match. Without it the installer says that the checksum is not verified. GitHub does not publish archive checksums, so compute the value once from a copy you trust, for example `shasum -a 256` on the archive of that tag. GitHub's generated archives are not guaranteed to stay byte-identical over time, so if a previously valid checksum stops matching, recompute it from a trusted copy before assuming tampering.

</details>

<details>
<summary><b>Profiles</b></summary>

`--profile core` skips the skills listed in `profile-extras.txt` (`impeccable`, `humanizer`, `diagram-design`, `db-migration`, `memory`), whose descriptions cost standing tokens in every project. `full` is the default. Both installers read the same file.

```bash
npx lean-agent-harness --global --profile core
```

</details>

<details>
<summary><b>Guard (opt-in)</b></summary>

`AGENTS.md` is advice the model may ignore. `--global --guard` adds enforcement where the tool supports it, all generated from `guard/policy.json`: a `PreToolUse` hook for Claude Code (registered in `~/.claude/settings.json` by merge, with a `.bak` of the previous file), permission rules for OpenCode (merged into `~/.config/opencode/opencode.json`, your own rules kept), an extension for Pi and command rules for Codex.

Secret files are `.env`, `.env.*` (except `.env.example`), `*.pem`, `*.key`, `id_rsa`, `id_ed25519` and anything under `.ssh/`; `.envrc` is not matched. The Claude Code and Pi guards deny them to the file tools and to shell commands from a fixed list of readers such as `cat` or `grep`. OpenCode denies reading and editing them, but not a shell command that opens them. The Codex rules do not protect secrets.

`rm -r`, `git reset --hard`, `git push --force` and `sudo` ask first. Commands are matched by listed spellings, so variants such as `rm -rvf`, `git -C repo reset --hard` or `git push origin +main` are not seen, and Codex matches command prefixes only.

Best effort, not a sandbox: commands built through an interpreter (`python -c`) are not seen, and a `Grep` aimed at a whole directory can still reach a secret file inside it. The OpenCode rules follow its documented permission format but have not been run against a live OpenCode. Cursor, Copilot and CommandCode have no guard. `install.sh --guard` needs `node`.

```bash
npx lean-agent-harness --global --guard
```

</details>

<details>
<summary><b>Memory hooks (opt-in, Claude Code)</b></summary>

`--global --memory-hook` makes the `memory` skill run without being asked: a `SessionStart` hook prints `context`, and a `Stop` hook asks the agent to save a `session-summary` when the repository changed since the last request, at most once every 30 minutes unless there is a new commit (`LAH_MEMORY_INTERVAL_MS` changes the interval) (state kept under `~/.claude/hooks/lah-memory/state/`, never inside your project). A hook has no model, so the agent writes the summary; it never runs outside a git repository. Requires `--global` and the full profile, and merges into `~/.claude/settings.json` like the guard.

```bash
npx lean-agent-harness --global --memory-hook
```

</details>

## Skills

Every skill is a folder with a `SKILL.md`. Skills marked `(extra)` are skipped by `--profile core` (see [Quick start](#quick-start)).

### Workflow

Meant to be called by you, in this order.

| Skill | What it does | Use when |
| :--- | :--- | :--- |
| [`plan-flow`](skills/plan-flow/SKILL.md) | Reads the code and writes a slice plan to `.tasks/current.md` | A change needs a plan before any code |
| [`orchestrate`](skills/orchestrate/SKILL.md) | Builds the plan slice by slice with RED, GREEN, REFACTOR and a Definition of Done | A plan has pending slices |
| [`review-audit`](skills/review-audit/SKILL.md) | Audits the uncommitted diff and records the hash it judged | The slices are done and nothing is committed |
| [`commit`](skills/commit/SKILL.md) | Runs the quality gates and creates a Conventional Commit | The review approved the diff |

### Domain

The agent loads these when the task matches their description.

| Skill | What it does | Use when |
| :--- | :--- | :--- |
| [`testing`](skills/testing/SKILL.md) | Testing standards for PHP, Go, Python, TS/JS and Rust | Writing or fixing tests, fixtures, mocks or flaky tests |
| [`diagnosing-bugs`](skills/diagnosing-bugs/SKILL.md) | Six-phase scientific debugging loop | A defect, race or regression survives a first fix |
| [`security-audit`](skills/security-audit/SKILL.md) | Static and architectural security review | Code handles input, authentication or secrets |
| [`db-migration`](skills/db-migration/SKILL.md) (extra) | Zero-downtime migrations and index tuning for PostgreSQL, MySQL and SQLite | Adding, changing or dropping tables, columns or indexes |
| [`pull-request`](skills/pull-request/SKILL.md) | Opens or updates a structured pull request | You ask to create or update a PR after committing |
| [`memory`](skills/memory/SKILL.md) (extra) | SQLite memory with a Markdown mirror | A session starts or compacts, or a decision must be saved |
| [`impeccable`](skills/impeccable/SKILL.md) (extra) | UI layout, spacing, typography and visual polish | Building or reviewing a user interface |
| [`diagram-design`](skills/diagram-design/SKILL.md) (extra) | Architecture, flow and sequence diagrams as standalone HTML with SVG | Drawing or visualizing a system |
| [`humanizer`](skills/humanizer/SKILL.md) (extra) | Removes filler and AI writing habits from prose | Writing READMEs, docs, changelogs or PR text |

## How it works

Everything ships as [Agent Skills](https://agentskills.io) plus a single `AGENTS.md`. There are no subagent files. The files specific to one tool are `CLAUDE.md`, the OpenCode command stubs, `agents/openai.yaml` for Codex, and the optional guard and memory hooks.

```text
skills/<name>/
├── SKILL.md      name and description frontmatter, then the steps
├── references/   detail that loads only when the skill needs it
├── scripts/      helpers the skill runs
└── agents/       openai.yaml, which keeps a skill explicit in Codex
```

Only `SKILL.md` is required.

* Each `SKILL.md` stays within 3000 bytes, and longer detail moves to `references/`.
* Workflow skills set `disable-model-invocation: true`. Claude Code, Pi, Cursor and Codex never offer them to the model, so their descriptions cost no tokens until you call them. OpenCode and Copilot ignore the flag and list them, one short line each.
* The Planner and Orchestrator roles live inside `plan-flow` and `orchestrate`.
* Slices tagged `Risk: high` are verified and reviewed in a fresh context.

### Memory

The `memory` skill (an extra, omitted by `--profile core`) keeps project context in a SQLite database (`.memory/memory.db`, via `node:sqlite` and FTS5, Node 24+) with a Markdown mirror beside it, found from any subdirectory of the project: `context` gives a capped recall at session start (the checkpoint and session summary in full, one line for the rest), `search` finds entries, `forget` drops a stale one, and `save` refuses entries without evidence or with obvious secrets. A checkpoint covers long conversations. Add `.memory/` to `.gitignore`; it is personal and never holds secrets.

## Project structure

| Path | Purpose |
| :--- | :--- |
| `AGENTS.md` | Single source of rules |
| `CLAUDE.md` | Imports `AGENTS.md` for Claude Code |
| `GLOSSARY.md` | Harness vocabulary |
| `templates/` | `GLOSSARY.md` seed for projects that have none |
| `skills/` | Workflow and domain skills |
| `adapters/` | OpenCode command stubs that point at skills |
| `guard/` | Guard policy, the generated guard files and the memory hooks |
| `manifest.tsv` | Destinations per tool and scope, read by both installers |
| `profile-extras.txt` | Skills that `--profile core` omits |
| `retired.tsv` | Removed skills and commands whose deployed copies the installers delete |
| `bin/` | The `npx` installer |
| `install.sh` | The `curl` installer |
| `test/` | `node:test` suite |

## Why a lean harness

* Standing context stays small: short rules, and skills that load on demand.
* Work is cut into feature-complete slices tracked in `.tasks/current.md`. Each starts with a failing test and closes on its Definition of Done.
* `AGENTS.md` sets hard rules: strict typing, no placeholders, no unplanned dependencies, and your confirmation before destructive commands.
* Mechanical enforcement is opt-in through the guard.

## Development

```bash
npm test   # installs with both installers and asserts identical output trees
```

## Releasing

Releases are manual. A pushed tag alone publishes neither a GitHub release nor the npm package.

1. On a branch: bump `version` in `package.json` and the `LAH_VERSION` example above, move the `[Unreleased]` entries of `CHANGELOG.md` under `[X.Y.Z] - YYYY-MM-DD`, and merge the pull request.
2. Tag the merge commit and publish the release with that version's changelog section as notes:

   ```bash
   git switch main && git pull --ff-only
   V=X.Y.Z
   git tag "v$V" && git push origin "v$V"
   awk -v v="$V" 'index($0,"## ["v"]")==1{f=1;next} /^## \[/{if(f)exit} f' CHANGELOG.md > "/tmp/notes-$V.md"
   gh release create "v$V" --verify-tag --title "v$V" --notes-file "/tmp/notes-$V.md" --latest
   ```

3. `npm publish` from `main` (`prepack` runs the tests).
4. Check both: `gh release list --limit 1` and `npm view lean-agent-harness version` (the registry can take a few minutes).

## License

MIT © [lnardev](https://github.com/lnardev)
