---
name: testing
description: Testing standards for PHP, Go, Python, TS/JS and Rust. Use when writing or fixing tests, choosing fixtures or mocks, or removing flakiness.
---

# Testing

Write resilient, fast, deterministic tests. Test behavior and invariants, never private implementation details.

## Core Rules

1. **AAA Pattern (Arrange, Act, Assert):** Isolate state setup, action, and verification into distinct phases.
2. **Parameterized / Datasets:** Use data-driven suites for multi-case logic (e.g., Pest `with()`, PHPUnit `#[DataProvider]`, Go table-driven, Pytest `@pytest.mark.parametrize`).
3. **Hermetic State & Isolation:** Tests must not depend on execution order or leak data. Use database transactions with automatic rollback (e.g., `RefreshDatabase`, `DatabaseMigrations`), clean sqlite/in-memory instances, or isolated fixtures.
4. **Deterministic Timing:** Never use arbitrary sleeps (`sleep()`, `usleep()`). Await promises, mock clocks/carbon (`Carbon::setTestNow()`), or poll conditions with bounded timeouts.
5. **Pragmatic Mocks:** Favor public contracts, stubs, and in-memory fakes over brittle reflection mocks. Mock external boundaries (HTTP clients, payment gateways, mailers), never internal entities.

## Tests That Can Fail

- **Name the break:** before writing a test, say which bug would make it fail. If only an intentional change could (wording, a constant), test the behavior that depends on it.
- **Independent expected values:** literals or hand-checked fixtures, never computed by the code under test or its helpers.
- **No mock assertions:** a check that only proves a mock exists says nothing. Assert calls when their arguments, count or order are part of the contract.
- **Mutation check:** before finishing, imagine realistic breakage (wrong branch, missing side effect, empty return, missing validation): some test must fail for each.

## Edge Cases to Cover

- **Null / Falsy / Empty:** `null`, empty arrays (`[]`), zero values, empty collections, type casting bugs.
- **Boundaries & Limits:** Integer overflows (`PHP_INT_MAX`), off-by-one errors, pagination limits.
- **Error / Exception Branches:** Assert specific exception classes (`$this->expectException(DomainException::class)`) or error payloads, not generic errors.

## Validation Checklist

- [ ] Target runner executes clean: `vendor/bin/pest`, `vendor/bin/phpunit`, `go test ./...`, `npm test`, `pytest`.
- [ ] No outbound network calls or active credentials in test suites.
- [ ] Failures report clear `got` vs `expected` diffs.
