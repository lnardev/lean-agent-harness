Run the planning workflow for the objective: $ARGUMENTS

Steps:
1. Load and assume the planner role defined in `agents/planner.md`.
2. Perform pure read-only analysis using repository search and file inspection capabilities.
3. Identify affected components, system boundaries, schemas, and dependencies.
4. Determine which skills (from `skills/`) are required for execution.
5. Output the execution plan ending with an actionable checklist (`- [ ] `) formatted for `/orchestrate`.