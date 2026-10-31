# Domain Glossary & Ubiquitous Language

Single source of truth for the domain vocabulary of this project. Both human engineers and coding agents must align terminology here to prevent conceptual divergence and verbose circumlocution.

> **For client projects installed via this harness:** replace the harness terms below with your business domain vocabulary, keeping the table format. The installed `GLOSSARY.md` is your project's glossary, not this repo's.

---

## Harness Core Entities & Concepts

| Term | Ubiquitous Definition | Canonical Representation | Constraints / Invariants |
| :--- | :--- | :--- | :--- |
| **Harness** | The portable rule + command + skill bundle deployed across coding agents. | `lean-agent-harness` root | Deployed files are package-derived; never hand-edit a deployed copy without syncing upstream. |
| **Target** | One deployment destination with its native layout. `agents` is the cross-tool `.agents/skills` location read by Pi, OpenCode, Codex, Copilot and Cursor; `claude` uses `.claude/skills`. | `target` column of `manifest.tsv` | Declared only in `manifest.tsv`; both installers read it. |
| **Manifest** | Tab-separated table mapping package sources to destinations per scope (local/global). | `manifest.tsv` | Single source for `bin/cli.js` and `install.sh`; `test/cli.test.js` asserts identical output trees. |
| **Adapter** | A static file that bridges one agent's native mechanism to a skill (OpenCode command stubs). | `adapters/` | Contains no rules, only a pointer to the skill. |
| **Instruction Stub** | A file that makes an agent read the shared rules (`AGENTS.md`, `CLAUDE.md`, `copilot-instructions.md`). | `file` rows in `manifest.tsv` | Content must derive from the package `AGENTS.md`; installed once per scope where the agent reads `AGENTS.md` natively; user customizations are kept as `.bak`, or the next free `.bak.N`, on overwrite; an existing backup is never overwritten. |
| **ODD (Organic Driven Development)** | Decomposition style: complex work becomes small, feature-complete, reviewable milestone slices chained across PRs. | `plan-flow` output in `.tasks/current.md` | A slice must satisfy its DoD before the next starts. |
| **Slice** | One feature-complete ODD unit (e.g., migration + model + service + tests). | `- [ ] Slice N:` checklist item | No fragmented single-line micro-slices. |
| **DoD (Definition of Done)** | Verification gate: 0 linter/compiler errors, passing tests with cited terminal output, no debug residue, glossary-aligned naming, isolated `git status`. | `orchestrate` skill DoD; `commit` skill step 1 | Evidence without raw terminal output is invalid. |
| **RED / GREEN / REFACTOR** | Test-first cycle: prove the gap with a failing test, implement minimally to pass, refactor for SOLID. | `testing` skill | Never assert GREEN without running the runner. |
| **Workflow Skill** | A skill invoked explicitly (`plan-flow`, `orchestrate`, `review`, `audit-code`, `commit`). It carries `disable-model-invocation: true`, so its description costs no standing tokens. | `skills/<name>/SKILL.md` | Role instructions (Planner, Orchestrator) live inside the skill; no separate agent or command files. |
| **Skill** | A self-contained Agent Skills playbook (`name` + `description` frontmatter) loaded on demand. | `skills/<name>/SKILL.md` | `name` equals the folder; keep each around 70 lines or fewer. |
| **Inline Task** | Work small enough to skip planning ceremony (≤ 1 file, < 30 lines, cosmetic). | `AGENTS.md` § 2 | Auditable through `git diff` alone. |
| **Risk Tier** | `low` or `high` tag on each planned slice. `high` = a high-risk item named in `AGENTS.md` § 2 (auth/authz, data migration or deletion, secrets/config, public interface, concurrency). | `Risk:` field in `plan-flow` output | High-risk slices get a fresh-context verifier (`orchestrate`) and review (`review`); low-risk slices keep the single DoD gate. |
| **Change Budget** | Limit of 400 changed lines per work unit. | `orchestrate` § Change budget (enforced by `commit`) | Rule text lives only in `orchestrate`. |
| **Blocker** | A review finding (Blocker or Critical) that blocks `commit` until fixed. | `review` verdict | WARNING and SUGGESTION never block and never trigger fixes. |
| **Profile** | Installation subset: `full` (default) deploys every skill; `core` omits the skills listed in `profile-extras.txt`. | `--profile core|full` | Only the `skills` directory is filtered; rules and workflow skills always install; both installers must produce identical trees. |
| **Seed Glossary** | Minimal domain-glossary template deployed to client projects when they have none. | `templates/GLOSSARY.md` | At most 1500 bytes (token budget test); never overwrites an existing `GLOSSARY.md`. |
| **Source Override** | Testability hook: installers use `LAH_SOURCE` (shell) or `LAH_FAKE_HOME`/`LAH_FAKE_CWD` (CLI exports) in tests. | `install.sh`, `bin/cli.js` | Must never alter default behavior when unset. |
| **Pinned Download** | A `curl` install fixed to a release and verified: `LAH_VERSION` selects the tag `vX.Y.Z` (default: the branch), `LAH_SHA256` makes `install.sh` abort before deploying when the archive differs, `LAH_ARCHIVE_URL` replaces the download URL (mirrors, tests). | `install.sh` | Without `LAH_SHA256` the archive is installed unverified and the installer says so. GitHub archives are not guaranteed byte-stable: recompute a stale checksum from a trusted copy before assuming tampering. |
| **Guard** | Opt-in enforcement of the `AGENTS.md` Hard Rules that a tool can check mechanically (secret files, destructive commands): a Claude Code `PreToolUse` hook, OpenCode permission rules, a Pi extension and Codex command rules. Deployed only by `--global --guard`. | `guard/`, `global-guard` rows in `manifest.tsv` | Executes code inside the agent, so it is never on by default and never project-local (Pi loads project extensions only after the project is trusted). Best effort, not a sandbox: it does not see commands built through an interpreter. |
| **Guard Policy** | The single list of protected secret files and destructive commands, each with a decision: `ask` (human confirms; blocked when nobody can answer) or `deny`. | `guard/policy.json` | Every guard artifact is generated from it by `guard/build.js` (including the `core.js` matcher copied beside the Pi and Claude Code guards); a test fails when a committed artifact drifts. |
| **Guard Matcher** | The shared logic that decides whether a path is a secret and which shell rule a command hits, built from the Guard Policy. Names, directories and the executable (`/bin/CAT` is `cat`) compare case-insensitively (the default macOS and Windows file systems open `.ENV` as `.env`), and brace patterns (`*.{env,pem}`) are expanded. | `guard/core.js` | One source, copied by `guard/build.js` beside each guard because each deploys on its own. |
| **OpenCode Permission** | A manifest row of kind `opencode-permission`: merges the rules generated from the Guard Policy into the `permission` of `~/.config/opencode/opencode.json`. | `manifest.tsv`, `guard/opencode/permission.json`, `guard/opencode/merge-permission.js` | OpenCode applies the last matching rule, so each pattern is moved to the end and replaces a user rule with the same pattern; a text value (`"allow"`) is kept as `{"*": "allow"}`. Same backup and invalid-JSON rules as the Settings Hook (`guard/json-config.js`). |
| **Settings Hook** | A manifest row of kind `settings-hook`: registers the Claude Code guard hook in `~/.claude/settings.json` by merge instead of copying a file. | `manifest.tsv`, `guard/claude/hook.json`, `guard/claude/merge-settings.js` | Idempotent. Keeps every other key, saves the previous file as `.bak` (or `.bak.N`) when it changes, and never touches a `settings.json` that is not valid JSON. |

---

## Architectural Seams & Boundaries

* **Seam 1 (SSOT):** `AGENTS.md` is the only normative rule set. `CLAUDE.md` and the workflow skills reference it; duplication of normative rules across files is a defect.
* **Seam 2 (Installer Parity):** Any supported environment must be deployable from both installers (`bin/cli.js` and `install.sh`) with equivalent file placement. Adding a target requires only a `manifest.tsv` row; the parity test enforces it.
* **Seam 3 (Coupling):** Behavior of the harness must be declarative (`manifest.tsv` driven). No per-platform copy-paste blocks in either installer; there are no transforms; files are copied verbatim.
* **Seam 4 (Token Budget):** Standing rules (`AGENTS.md`) cost ~0.9k tokens per session; skill descriptions add one line each, and workflow skills add none. Every rule added must earn its tokens by preventing a real, observed failure mode.

---

## Deprecated / Forbidden Jargon

* *Do not say:* "the installer script things".
  *Use instead:* "the shell installer (`install.sh`)" or "the CLI (`bin/cli.js`)".
* *Do not say:* "the md file with the rules".
  *Use instead:* "`AGENTS.md` (SSOT)".
* *Do not say:* "the todo file".
  *Use instead:* "`.tasks/current.md` (ephemeral execution state)".
