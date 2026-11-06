---
name: review-audit
description: Risk-based audit of uncommitted changes against quality gates before committing. Invoke explicitly.
argument-hint: [low|medium|high] [target]
disable-model-invocation: true
---

# review-audit

Arguments: optional effort level, then optional target (file, branch or PR). Default: **medium**.

* **low**: report only Blocker/Critical findings you are certain of.
* **medium**: add WARNING findings you verified in the code.
* **high**: add SUGGESTION findings and uncertain ones, each marked PLAUSIBLE.

1. Run `git diff` (or inspect the given target file/branch).
2. Check new symbols against `GLOSSARY.md` (skip if absent).
3. Review by axis: one reviewer per axis. Report only actionable defects, each with its exact structural remedy.
   * **Correctness:** null dereferences, type coercion, resource leaks, off-by-one, inverted conditions, unchecked errors.
   * **Readability & Bloat:** dead code and commented-out code, cyclomatic complexity > 10, nesting > 3 levels, functions > 30 lines, duplicated blocks, cryptic names (`data`, `temp`, `res`).
   * **Architecture & Boundaries:** transport or DB logic leaking into domain layers, refactors that only shuffle lines, premature interfaces and shallow wrappers.
   * **Safety & Performance:** injection, authorization gaps, unsanitized input at system borders (load `security-audit` if touching persistence/auth), unbounded queries, N+1, heavy work inside hot loops.
     Security hotspots (crypto, CORS, cookies, regex on user input, deserialization, dependency/config changes) are not defects: list each once as a WARNING for human review, with the reason.
   If the host has subagents, run the axis reviewers in parallel, each with only the diff and its axis. Otherwise run them sequential in this context and state that in the verdict.
4. Verify pass: re-read the cited code for every candidate finding and drop any you cannot reproduce from the code. Mark survivors CONFIRMED, or PLAUSIBLE when the level allows uncertain ones.
5. Verify the diff fulfils the planned slice with no scope creep.
   If any slice is `Risk: high`, run this review in a fresh context (subagent or new session) so it does not judge code it just wrote; if the host has neither, state that the review ran in the authoring context.
   Record the hash of the diff you judged (`git add -N <new files>`, then `git diff HEAD | git hash-object --stdin`) in the verdict; a later change to that hash needs a new review. If the work is already committed, `git diff HEAD` is empty and always hashes the same: hash `git diff <base>...HEAD` instead.
6. Verdict: any Blocker/Critical → list required fixes, each with the exact structural remedy, and block `commit`. Clean → approve and tell the user to run `commit`.
   WARNING and SUGGESTION are listed once in the verdict. They never trigger fixes or another review round.

Report only. Never edit code in a review: fixes go through `orchestrate`, so the judged hash stays valid.
