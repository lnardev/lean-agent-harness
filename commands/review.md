# Command: /review [target]

Execute an exhaustive technical quality audit on active uncommitted changes (`git diff`) before committing.

## Execution Steps
1. **Inspect Working Tree:** Run `git diff` on uncommitted modifications (or the target file/branch).
2. **Check Against GLOSSARY.md:** Ensure all newly introduced symbols and terminology match the project domain glossary (skip if the project has no `GLOSSARY.md`).
3. **SonarQube Quality Gates:**
   * **Bugs:** Logic anomalies, unhandled null/undefined states, resource leaks.
   * **Vulnerabilities:** Threat surfaces, injection risks, authorization gaps, unsanitized inputs. (Load `skills/security-audit/SKILL.md` if touching persistence/auth).
   * **Code Smells:** High cyclomatic complexity (>10), methods >30 lines, shallow wrappers, dead code.
4. **Spec & Regression Audit:** Verify that changes fulfill the planned slice without unauthorized scope creep.
5. **Verdict:**
   * If any `Blocker` or `Critical` findings exist: list required fixes and block `/commit`.
   * If clean: output approval and instruct the user to run `/commit [hint]`.