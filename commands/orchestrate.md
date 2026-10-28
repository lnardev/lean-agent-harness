# Command: /orchestrate [task or slice]

Execute planned tasks sequentially adhering to strict typing, dynamic skill loading, RED-GREEN-REFACTOR, and the Definition of Done (DoD).

## Guardrail: Plan Verification
1. Inspect `.tasks/current.md` (or current context) for an active checklist (`- [ ]`).
2. If no plan exists, halt immediately and prompt the user to run `/plan-flow <task>` first.

## Execution Steps
1. **Assume Role:** Load `agents/orchestrator.md` (or fallback to `~/.pi/agent/agents/orchestrator.md`).
2. **Branch Check:** Verify the active branch is a feature branch (`git branch --show-current`). If on `main`/`master`, halt and propose branching.
3. **Sequential Execution:** Ingest the first pending `- [ ]` slice from `.tasks/current.md`.
4. **Dynamic Skill Loading:** Read the relevant `skills/<name>/SKILL.md` needed for this slice.
5. **Execution Loop:**
   * If implementing a feature: follow RED-GREEN-REFACTOR.
   * If fixing a defect: follow the 6-phase loop from `skills/diagnosing-bugs/SKILL.md`.
6. **Verify DoD:** Run linters, compilers, and test suites. **Capture raw terminal output summary as evidence**.
7. **Circuit Breaker:** If 2 consecutive attempts fail, halt, revert active slice changes (`git checkout -- <files>`), and explain the diagnosis.
8. **Update State:** Mark item as `- [x]` in `.tasks/current.md`. Advance to the next item or prompt user to run `/review` if all items are complete.