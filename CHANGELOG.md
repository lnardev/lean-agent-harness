# Changelog

All notable changes to this project are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `Scope` rule in `AGENTS.md`: a request that needs no file, code or command gets a direct answer, without the engineering workflow.

### Changed

- `plan-flow` and `orchestrate` treat `db-migration` and `impeccable` as optional, so `--profile core` installs no longer reference missing skills.
- `GLOSSARY.md` registers `LAH_VERSION`, `LAH_SHA256`, `LAH_ARCHIVE_URL` and the `.bak.N` backup naming.
- Standing-context estimate updated to about 0.9k tokens; the `AGENTS.md` size cap in the test is now 3800 bytes.

### Fixed

- The Circuit Breaker revert can no longer discard the user's uncommitted edits: it only touches files that were clean when the slice began, and `orchestrate` asks the user to commit or stash otherwise.
- `review` no longer records a meaningless hash for committed work: `git diff HEAD` is empty there, so it hashes `git diff <base>...HEAD`.

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
