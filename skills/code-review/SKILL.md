---
name: code-review
description: Fast, multi-axis technical code review targeting SonarQube quality gates (Bugs, Code Smells), architectural debt, and diff hygiene.
---

# Code Review

Evaluate diffs and PRs strictly against four technical axes. Focus on defects that fail SonarQube quality gates and produce technical debt. Propose the exact remedy, not just the critique.

## The Review Axes

1. **Correctness (SonarQube Bugs):**
   - Null pointer dereferences, unhandled nil/null checks, and type-coercion bugs.
   - Resource leaks: unclosed files, DB connections, HTTP request/response bodies.
   - Logic defects: off-by-one errors, infinite loops, inverted conditions, unchecked error returns.

2. **Readability & Bloat (SonarQube Code Smells):**
   - Dead code: unreachable branches, unused variables, orphan imports, commented-out legacy code.
   - Cyclomatic complexity: deep nesting (>3 levels), massive switch statements without default cases.
   - Duplication: identical logic blocks that must be consolidated.
   - Naming: cryptic variable names without domain meaning (`data`, `temp`, `res`).

3. **Architecture & Boundaries:**
   - Layer leaks: transport or DB logic leaking into domain/business layers.
   - Relocated complexity: refactors that merely shuffle lines instead of eliminating branches.
   - Unnecessary abstractions: premature interfaces, boilerplate wrappers with only one implementation.

4. **Safety & Performance:**
   - Unbounded queries, N+1 patterns, unconstrained pagination.
   - Input validation at system borders (complements `security-audit`).
   - Heavy allocations or redundant calculations inside loops or hot paths.

## Findings Format

Report only actionable issues ordered by severity:

- **Critical:** Blocks merge / SonarQube red gate. Runtime crash, resource leak, or data corruption.
- **Required:** Must fix. Code smells, complexity spikes, unhandled boundary cases, broken invariants.
- **Nit / Optional:** Style suggestions, minor syntactic sugar. Non-blocking.

For every reported issue, prescribe the exact structural remedy: *extract helper*, *close resource with defer/finally*, *dispatch via map*, or *collapse redundant branch*.