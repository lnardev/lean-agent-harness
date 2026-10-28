# Domain Glossary & Ubiquitous Language

Single source of truth for the domain vocabulary of this project. Both human engineers and coding agents must align terminology here to prevent conceptual divergence and verbose circumlocution.

> **For client projects installed via this harness:** replace the harness terms below with your business domain vocabulary, keeping the table format. The installed `GLOSSARY.md` is your project's glossary, not this repo's.

---

## Harness Core Entities & Concepts

| Term | Ubiquitous Definition | Canonical Representation | Constraints / Invariants |
| :--- | :--- | :--- | :--- |
| **Harness** | The portable rule + command + skill bundle deployed across coding agents. | `lean-agent-harness` root | Deployed files are package-derived; never hand-edit a deployed copy without syncing upstream. |
| **Target** | One supported coding-agent environment with its filesystem layout. | `TARGETS` in `bin/cli.js`, `deploy_*()` in `install.sh` | A target must be declared exactly once in both installers. |
| **Instruction Stub** | A file that makes an agent read the shared rules (`AGENTS.md`, `CLAUDE.md`, `agents.mdc`, `instructions.md`, `copilot-instructions.md`). | `AGENTS.md->aliases` in the deploy manifest | Content must derive from the package `AGENTS.md`; user customizations land in `.bak` on overwrite. |
| **ODD (Organic Driven Development)** | Decomposition style: complex work becomes small, feature-complete, reviewable milestone slices chained across PRs. | `/plan-flow` output in `.tasks/current.md` | A slice must satisfy its DoD before the next starts. |
| **Slice** | One feature-complete ODD unit (e.g., migration + model + service + tests). | `- [ ] Slice N:` checklist item | No fragmented single-line micro-slices. |
| **DoD (Definition of Done)** | Verification gate: 0 linter/compiler errors, passing tests with cited terminal output, no debug residue, glossary-aligned naming, isolated `git status`. | `/orchestrate` step 7; `/commit` step 1 | Evidence without raw terminal output is invalid. |
| **RED / GREEN / REFACTOR** | Test-first cycle: prove the gap with a failing test, implement minimally to pass, refactor for SOLID. | `skills/testing/SKILL.md` | Never assert GREEN without running the runner. |
| **Command** | A slash command markdown file (`/plan-flow`, `/orchestrate`, `/review`, `/audit-code`, `/commit`). | `commands/*.md` | Commands reference `AGENTS.md`; they never restate it. |
| **Skill** | A self-contained, on-demand markdown playbook loaded only when the task matches its trigger. | `skills/<name>/SKILL.md` | Keep each under ~70 lines; loading is opt-in to save tokens. |
| **Inline Task** | Work small enough to skip planning ceremony (≤ 1 file, < 30 lines, cosmetic). | `AGENTS.md` § 2 | Auditable through `git diff` alone. |
| **Source Override** | Testability hook: installers use `LAH_SOURCE` (shell) or `LAH_FAKE_HOME`/`LAH_FAKE_CWD` (CLI exports) in tests. | `install.sh`, `bin/cli.js` | Must never alter default behavior when unset. |

---

## Architectural Seams & Boundaries

* **Seam 1 (SSOT):** `AGENTS.md` is the only normative rule set. `CLAUDE.md`, command files, and agent role files reference it; duplication of normative rules across files is a defect.
* **Seam 2 (Installer Parity):** Any supported environment must be deployable from both installers (`bin/cli.js` and `install.sh`) with equivalent file placement. Adding a target requires touching both.
* **Seam 3 (Coupling):** Behavior of the harness must be declarative (manifest/table driven). No per-platform copy-paste blocks in the CLI.
* **Seam 4 (Token Budget):** Standing rules cost ~1k tokens per session. Every rule added must earn its tokens by preventing a real, observed failure mode.

---

## Deprecated / Forbidden Jargon

* *Do not say:* "the installer script things".
  *Use instead:* "the shell installer (`install.sh`)" or "the CLI (`bin/cli.js`)".
* *Do not say:* "the md file with the rules".
  *Use instead:* "`AGENTS.md` (SSOT)".
* *Do not say:* "the todo file".
  *Use instead:* "`.tasks/current.md` (ephemeral execution state)".
