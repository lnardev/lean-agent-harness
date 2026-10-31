# Changelog

All notable changes to this project are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
