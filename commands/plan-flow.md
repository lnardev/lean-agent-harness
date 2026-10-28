# Command: /plan-flow <task>

Analyze codebase context and design a phased, reviewable execution plan divided into Organic Driven Development (ODD) milestone slices.

## Guardrail: Progressive Scope Refinement
If `$ARGUMENTS` is broad, ambiguous, or lacks concrete boundaries:
- **STOP IMMEDIATELY.** Do NOT dump a multi-question questionnaire.
- Ask strictly **ONE clarifying question** representing the primary decision gate.
- Propose a sensible, high-quality default with the question so the user can affirm with a single word.
- Wait for user reply before proceeding with planning.

## Execution Steps
1. **Validate Input:** Ensure requirements are clear. If clear, proceed.
2. **Assume Role:** Load `agents/planner.md` (or fallback to `~/.pi/agent/agents/planner.md`).
3. **Context & Manifest Check:** Inspect repository files, `GLOSSARY.md` (if present), and active manifests (`package.json`, `go.mod`, etc.) to locate exact dependencies and test scripts.
4. **Slicing:** Decompose into cohesive ODD slices with explicit RED-GREEN criteria and deep module interfaces.
5. **Persist:** Write plan and `- [ ]` checklist into `.tasks/current.md`.
6. **Output:** Present the architectural analysis and checklist to the user. Instruct them to run `/orchestrate` when ready.