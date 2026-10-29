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
   If any slice is `Risk: high`, run this review in a fresh context (subagent or new session) so it does not judge code it just wrote; if the host has neither, state that the review ran in the authoring context.
   Record the hash of the diff you judged (`git add -N <new files>`, then `git diff HEAD | git hash-object --stdin`) in the verdict; a later change to that hash needs a new review.
5. Verdict: any Blocker/Critical → list required fixes and block `commit`. Clean → approve and tell the user to run `commit`.
   WARNING and SUGGESTION are listed once in the verdict. They never trigger fixes or another review round.

For deeper multi-axis review rules use the `code-review` skill.
