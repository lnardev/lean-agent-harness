---
name: diagnosing-bugs
description: Disciplined 6-phase scientific debugging loop for stubborn defects, race conditions, and performance regressions. Prevents random code thrashing.
---

# Diagnosing Bugs

Resolve defects by elimination of uncertainty, not by brute force. Never apply a second fix attempt to the same hypothesis.

## The 6-Phase Scientific Loop

```text
1. REPRODUCE (RED) ──► 2. MINIMIZE ──► 3. HYPOTHESIZE ──► 4. INSTRUMENT ──► 5. FIX (GREEN) ──► 6. REGRESSION TEST
```

1. **Reproduce (RED):** Build a failing test that triggers the bug deterministically. If it cannot be reproduced at will, you are debugging noise, not a defect. Capture exact steps and expected vs actual output.
2. **Minimize:** Strip parameters, data, and setup until the smallest possible trigger remains. A 5-line repro reveals root causes that a 500-line scenario hides.
3. **Hypothesize:** State the exact causal mechanism in writing BEFORE touching production code (*"the cache is populated before the tenant context exists because X runs before Y"*). No hypothesis, no edit.
4. **Instrument:** Add targeted temporary logging or assertions that would refute the hypothesis. Prefer assertions over prints. Run once, read, remove.
5. **Fix (GREEN):** Apply the surgical correction at the root cause, never a symptom patch. The failing test from phase 1 must now pass.
6. **Regression Test:** Promote the repro into a permanent named test. Remove all instrumentation. Run the full suite to rule out collateral damage.

## Circuit Breaker Tie-In

After 2 consecutive failed fix attempts: STOP, `git checkout -- <files>`, and start over at phase 3 with a *different* causal mechanism. Repeating the same hypothesis louder is not debugging; it is thrashing.

## Anti-Patterns (Forbidden)

* Fixing symptoms (validate input *before* the null deref instead of at the source).
* Shotgun changes: editing 5 files hoping something sticks.
* "Works now, ship it": skipping phase 6 leaves the armed time bomb in the codebase.
* Debugging by adding permanent `console.log`/`print` residue that survives into the commit.
