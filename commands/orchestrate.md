Coordinate and execute this task using the orchestrator workflow: $ARGUMENTS

Steps:
1. Load and assume the orchestrator role defined in `agents/orchestrator.md`.
2. Initialize and track the task checklist (`- [ ] ` -> `- [x] `) using platform task capabilities or markdown state.
3. Inspect `AGENTS.md` and load relevant skills (`skills/<name>/SKILL.md`) before modifying code.
4. Apply minimal, surgical edits with complete typing (no placeholders `// ...`, no commented legacy code).
5. Run validation checks (syntax, tests, linters) to satisfy the Definition of Done.
6. Mark items completed sequentially and report concise progress.