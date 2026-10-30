# Changelog

All notable changes to this project are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.2.0]

### Added

- `--profile core|full` in both installers. `core` skips the skills listed in `profile-extras.txt`.
- Risk tiers (`low` | `high`) on every planned slice, with a fresh-context verifier for high-risk slices.
- 400 changed-lines budget per slice, defined in `orchestrate` and enforced at `commit`.
- Verification evidence bound to a hash of the working diff, so it goes stale after any edit.

### Changed

- Standing token cost reduced; each `SKILL.md` capped at 3000 bytes, with detail moved to `references/`.
- `diagram-design` split into a skill and `references/template.md`.

### Fixed

- `install.sh --auto` selects the detected environments.
- Corrected the `curl` install URL.

## [1.1.0]

### Changed

- `bin/cli.js` reworked and package metadata prepared for the first npm release.
