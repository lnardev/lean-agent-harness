---
name: diagnosing-bugs
description: Six-phase scientific debugging loop. Use when a defect, race condition or performance regression survives a first fix or cannot be explained.
---

# Diagnosing Bugs

Resolve defects by elimination of uncertainty, not by brute force. Never apply a second fix attempt to the same hypothesis.

## The 6-Phase Scientific Loop

```text
1. REPRODUCE (RED) ──► 2. MINIMIZE ──► 3. HYPOTHESIZE ──► 4. INSTRUMENT ──► 5. FIX (GREEN) ──► 6. REGRESSION TEST
```

1. **Reproduce (RED):** Build a failing test that triggers the bug deterministically. If it cannot be reproduced at will, you are debugging noise, not a defect. Capture exact steps and expected vs actual output. Check what changed recently (`git log`, `git diff`, dependencies, configuration).
2. **Minimize:** Strip parameters, data, and setup until the smallest possible trigger remains. A 5-line repro reveals root causes that a 500-line scenario hides.
3. **Hypothesize:** State the exact causal mechanism in writing BEFORE touching production code (*"the cache is populated before the tenant context exists because X runs before Y"*). No hypothesis, no edit. Follow a bad value back to where it is created.
4. **Instrument:** Add targeted temporary logging or assertions that would refute the hypothesis. Prefer assertions over prints. Run once, read, remove. Across several components, record what enters and leaves each boundary to find the failing component. For a secret, record only whether it is set, never its value.
5. **Fix (GREEN):** Apply the surgical correction at the root cause, never a symptom patch. The failing test from phase 1 must now pass.
6. **Regression Test:** Promote the repro into a permanent named test. Remove all instrumentation. Run the full suite to rule out collateral damage.

## Circuit Breaker Tie-In

After 2 consecutive failed fix attempts apply the Circuit Breaker from `AGENTS.md`, then start over at phase 3 with a *different* causal mechanism. Repeating the same hypothesis louder is not debugging; it is thrashing. If the Circuit Breaker triggers twice for the same bug, stop and ask the user one question: is the design wrong?

## Anti-Patterns (Forbidden)

* Fixing symptoms (validate input *before* the null deref instead of at the source).
* Shotgun changes: editing 5 files hoping something sticks.
* "Works now, ship it": skipping phase 6 leaves the armed time bomb in the codebase.
* Debugging by adding permanent `console.log`/`print` residue that survives into the commit.
