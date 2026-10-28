---
name: review
description: Risk-based audit of uncommitted changes against quality gates before committing. Invoke explicitly.
argument-hint: [target]
disable-model-invocation: true
---

# review

1. Run `git diff` (or inspect the given target file/branch).
2. Check new symbols against `GLOSSARY.md` (skip if absent).
3. Quality gates:
   * **Bugs:** logic anomalies, unhandled null/undefined, resource leaks.
   * **Vulnerabilities:** injection, authorization gaps, unsanitized input (load `security-audit` if touching persistence/auth).
   * **Smells:** cyclomatic complexity > 10, functions > 30 lines, shallow wrappers, dead code.
4. Verify the diff fulfils the planned slice with no scope creep.
5. Verdict: any Blocker/Critical → list required fixes and block `commit`. Clean → approve and tell the user to run `commit`.

For deeper multi-axis review rules use the `code-review` skill.
