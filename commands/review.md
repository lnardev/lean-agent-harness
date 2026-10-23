Run a risk-based technical review of the current diff or specified target: $ARGUMENTS

Steps:
1. Load `skills/code-review/SKILL.md` to establish baseline Quality Gate rules.
2. Assess the Risk Level based on the changed file paths and domain context:
   - **Low Risk** (UI, CSS, Markdown, Docs): Proceed with standard code-review (focus on readability and basic logic).
   - **Medium Risk** (Business logic, API controllers, Services): Enforce rigorous SonarQube checks (cyclomatic complexity, resource leaks, N+1 queries).
   - **High Risk** (Auth, DB schemas, Middleware, Payments, Secrets): Automatically chain and load `skills/security-audit/SKILL.md` before proceeding.
3. Inspect the targeted files or active diff strictly against the active review axes.
4. Report actionable findings categorized by severity (Critical, Required, Nit/Optional).
5. Prescribe the exact structural remedy for each finding (do not just critique; provide the fix).