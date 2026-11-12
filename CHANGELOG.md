# Changelog

All notable changes to this project are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `--global --memory-hook` (opt-in, Claude Code only, refused with `--profile core`) registers two hooks in `~/.claude/settings.json`: `SessionStart` runs `mem.js context`, and `Stop` runs `guard/claude/lah-memory/memory-stop.js`. When the repository changed since the session was last asked (HEAD plus path, size and mtime of every changed file, ignoring `.memory/`), `Stop` blocks once and tells the agent to save a `session-summary`. It skips `stop_hook_active`, directories outside git and unreadable input, and keeps its state outside the repository, in `~/.claude/hooks/lah-memory/state/<sha256 of the git root>.json` (`LAH_MEMORY_STATE_DIR` relocates it), so it never writes into a project. `--memory-hook` also deploys the Claude Code target, whose skills hold `mem.js` the hooks call. A hook has no model, so the agent still writes the summary. Known limit: a session whose first response already committed all its work has no baseline and is not asked.

- `mem.js forget <topic-key>` deletes an entry, its search row and its mirror file, so a stale entry stops showing up in `context`.

### Changed

- The `Stop` memory hook asks at most once per `LAH_MEMORY_INTERVAL_MS` (default 30 minutes) unless HEAD moved: `Stop` fires after every response and each request costs a full model turn. Work held back by the interval is asked for on the first stop after it passes. State from the previous format is still read.
- `mem.js context` prints the `checkpoint` and `session-summary` bodies in full (up to 8 lines of 200 characters), not just their first line, so resuming needs no extra read.
- `mem.js search` with several terms falls back to entries that match any of them when none matches all.
- `AGENTS.md` gains a Memory rule: when the `memory` skill is installed, run `context` at session start and after a compaction unless a hook already printed it, and `save` settled decisions.

### Fixed

- The `Stop` memory hook read the source path of a rename or copy in `git status -z` as a new entry with its first three characters cut, so a rename inside `.memory/` counted as new work. Wording elsewhere was tightened to stay under the 3800-byte cap.

## [3.1.0] - 2026-11-08

### Changed

- `plan-flow` now records a clean test **Baseline** before the first RED and lists up to five **Edge cases** per slice, each pinned by a test in RED. Running the test command once keeps the skill read-only.

## [3.0.0] - 2026-11-08

### Added

- The `memory` skill now stores entries in SQLite (`.memory/memory.db`, `node:sqlite` with FTS5) through `skills/memory/scripts/mem.js` (`save`, `search`, `context`, `rebuild`), keeping a Markdown mirror. `save` rejects a missing `--evidence`, a malformed topic key and obvious secrets; `context` returns a capped recall instead of a growing index. Opt-in: `--profile core` still omits the skill. **BREAKING (memory skill):** entries saved by the previous Markdown-only skill (`.memory/*.md`) are not imported: `context` ignores them, so save again whatever is still worth keeping. The script finds the project's `.memory/` from any subdirectory, keeps the store private (`0700`/`0600`), refuses symlinks and hard links, and rejects bodies above 64 KiB. Known limits: every `save` rewrites all mirror files, `context` reads every row, and a stdin pipe that is never closed blocks the command. A `.memory/` tracked in a cloned repository is read as-is, so its text reaches the agent unfiltered; the secret filter is best effort (JSON-quoted names, values without digits and other key armor can pass); and a corrupt `memory.db` ends in a stack trace.

### Changed

- **BREAKING:** the minimum is now Node.js 24 (`engines.node` `>=24.0.0`, was `>=18.0.0`). Node 18 and 20 no longer receive security fixes and 22 ends on 2027-04-30. Users on older versions get an `EBADENGINE` warning from `npx` (a hard block with `engine-strict`); `install.sh` does not need Node unless you pass `--guard`.

## [2.1.0] - 2026-11-06

### Fixed

- Upgrading no longer leaves the skills and commands removed from the package: after each directory is copied, both installers delete the deployed `review`, `audit-code` and `code-review` skills and the OpenCode `review` and `audit-code` commands, listed in the new `retired.tsv`. A copy is deleted only if it carries the marker line it shipped with, so a skill of your own with the same name is kept, and never if the package ships that path again. This applies to every profile, local and global. Reinstalling over an install made before this release cleans them, so the by-hand removal described under 2.0.0 is no longer needed.

### Changed

- `plan-flow` stops and asks once (replace or continue) when `.tasks/current.md` still has a `- [ ]` item, instead of silently overwriting the unfinished plan. Default: continue.
- `orchestrate` ends every slice with a fixed report table: files, RED and GREEN (exact test summary line), deviations from the plan and the diff hash.

## [2.0.0] - 2026-11-06

### Changed

- **Breaking:** the `review` workflow skill is now `review-audit` (command `/review-audit`), and `code-audit` and `code-review` are removed (see Removed). The workflow goes from five skills to four.
- `review-audit` no longer collides with the review commands built into the agents. It takes an optional effort level (`low|medium|high`), runs one reviewer per axis (Correctness, Readability & Bloat, Architecture & Boundaries, Safety & Performance), verifies each finding before reporting it, and lists security hotspots as WARNINGs for human review. It only reports; fixes stay in `orchestrate`.
- `security-audit` owns the scan scope (a path, else the whole workspace), verifies findings with a confidence threshold of 8 out of 10, reports an exploit scenario per finding, adds a data-exposure vector, and keeps its exclusions in `references/exclusions.md`.

### Removed

- The `code-audit` skill and its OpenCode command: a thin wrapper over `security-audit`, whose scope section now covers it. Use `security-audit` on a path instead of `/audit-code`.
- The `code-review` skill: its axes now live inside `review-audit`. Directories left over from an older install (`skills/review`, `skills/audit-code`, `skills/code-review`) are not deleted by the installer; remove them by hand.

## [1.4.0] - 2026-11-04

### Added

- A divergent user `AGENTS.md`/`CLAUDE.md` is now merged instead of only backed up: the original is still saved as `.bak` (`.bak.1`, ...), and its rules survive in the agent's context as a `## Project Rules` section delimited by `lah:project-rules` comments. Reinstalls over a merged file are a no-op; payload upgrades replace only the harness part and keep the section. Files the harness itself deployed (the `lean-agent-harness` marker or the 1.x signature lines — `Single source of truth for all coding agents`, `# Claude Code Project Configuration`) are replaced without absorbing the old harness text. The affected `manifest.tsv` rows carry the new `merge` mode, and installer parity now runs the merge through both installers.

## [1.3.2] - 2026-10-31

### Added

- OpenCode guard: `--global --guard` also merges permission rules into `~/.config/opencode/opencode.json`, generated from `guard/policy.json`: secret files denied for `read` and `edit` (`.env.example` allowed), destructive commands set to `ask` with the flag before or after other arguments. Your own rules are kept; ours are moved last because OpenCode applies the last matching rule. A previous file is saved as `.bak`, a second run changes nothing, and an `opencode.json` that is not a JSON object is never touched. Follows the documented format; not yet run against a live OpenCode.

### Changed

- The read, validate and backup logic for user JSON files moved to `guard/json-config.js`, shared by the Claude Code and OpenCode merges.

## [1.3.1] - 2026-10-31

### Fixed

- Guard: the executable is matched without case or path (`CAT .ENV`, `/bin/cat .env`, `/bin/rm -rf` no longer slip through), and brace patterns (`*.{env,pem}`, `cat {.env,x}`) are expanded before checking, up to 256 variants: a pattern that would expand further is refused instead of hanging the hook.
- `--guard` now says `settings.json is not a JSON object` for a `settings.json` holding `null`, an array or a number, instead of a raw `TypeError`. It is still left untouched.

## [1.3.0] - 2026-10-30

### Added

- Claude Code guard: `--global --guard` also installs a `PreToolUse` hook in `~/.claude/hooks/lah-guard/` and registers it in `~/.claude/settings.json` by merge (invalid JSON is never touched, the previous file is kept as `.bak`, a second run changes nothing). Secret files are denied; destructive commands go to Claude Code's own permission prompt. Input the hook cannot read blocks the call. `install.sh --guard` now requires `node`.
- Opt-in guard: `--global --guard` installs a Pi extension and Codex command rules that block secret files (`.env*`, `*.pem`, `*.key`, `.ssh/`) and ask before `rm -r`, `git reset --hard`, `git push --force` and `sudo`; without a UI to answer, those commands are blocked. Rules come from `guard/policy.json`. `--guard` without `--global` is rejected.
- `Scope` rule in `AGENTS.md`: a request that needs no file, code or command gets a direct answer, without the engineering workflow.

### Changed

- The guard matcher moved to `guard/core.js`, copied by `guard/build.js` beside the Pi and Claude Code guards so both apply the same rules.
- `plan-flow` and `orchestrate` treat `db-migration` and `impeccable` as optional, so `--profile core` installs no longer reference missing skills.
- `GLOSSARY.md` registers `LAH_VERSION`, `LAH_SHA256`, `LAH_ARCHIVE_URL` and the `.bak.N` backup naming.
- Standing-context estimate updated to about 0.9k tokens; the `AGENTS.md` size cap in the test is now 3800 bytes.

### Fixed

- The Circuit Breaker revert can no longer discard the user's uncommitted edits: it only touches files that were clean when the slice began, and `orchestrate` asks the user to commit or stash otherwise.
- `review` no longer records a meaningless hash for committed work: `git diff HEAD` is empty there, so it hashes `git diff <base>...HEAD`.
- The dependency rule blocks new packages but no longer blocks installing the ones already declared (`npm ci`).

## [1.2.0]

### Added

- `--profile core|full` in both installers. `core` skips the skills listed in `profile-extras.txt`.
- Risk tiers (`low` | `high`) on every planned slice, with a fresh-context verifier for high-risk slices.
- 400 changed-lines budget per slice, defined in `orchestrate` and enforced at `commit`.
- Verification evidence bound to a hash of the working diff, so it goes stale after any edit.
- `install.sh` env vars: `LAH_VERSION` pins a release tag, `LAH_SHA256` verifies the downloaded archive and aborts on mismatch.

### Changed

- Standing token cost reduced; each `SKILL.md` capped at 3000 bytes, with detail moved to `references/`.
- `diagram-design` split into a skill and `references/template.md`.

### Fixed

- `install.sh --auto` selects the detected environments.
- Corrected the `curl` install URL.
- A divergent `AGENTS.md`/`CLAUDE.md` no longer overwrites an earlier `.bak`; later backups become `.bak.1`, `.bak.2`, and so on.
- `manifest.tsv` rows with the wrong column count now fail with the offending line number.

## [1.1.0]

### Changed

- `bin/cli.js` reworked and package metadata prepared for the first npm release.
