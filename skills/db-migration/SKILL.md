---
name: db-migration
description: Safe, zero-downtime schema migrations and index tuning for SQL databases (PostgreSQL, MySQL, SQLite) and their ORMs.
---

# Database Migration

Design safe, deterministic, zero-downtime schema migrations. Prevent table locks, connection pool exhaustion, and data loss.

## Core Rules

1. **Expand & Contract Pattern:**
   - Never rename or drop columns/tables in a single step.
   - **Step 1 (Expand):** Add new nullable column/table.
   - **Step 2 (Dual-write):** Write to old and new columns in application code.
   - **Step 3 (Backfill):** Backfill historical rows in small batches outside peak traffic.
   - **Step 4 (Contract):** Switch reads to new column, drop legacy writes.
   - **Step 5 (Cleanup):** Drop the legacy column in a subsequent release.

2. **Lock Prevention & Safe Schema Changes:**
   - Add new columns as `NULL` or with database-level defaults that do not trigger full table rewrites.
   - Never run unbounded `UPDATE` or `DELETE` statements inside a migration transaction.
   - Always create indexes concurrently or non-blocking:
     - PostgreSQL: `CREATE INDEX CONCURRENTLY` (outside transactional block).
     - MySQL: `ALGORITHM=INPLACE, LOCK=NONE`.
   - Set lock timeouts (`SET lock_timeout = '2s';`) so a migration fails fast instead of queueing behind long transactions and exhausting the pool.
   - SQLite: `ALTER TABLE` adds a column, renames one (3.25+) and drops one (3.35+; it fails if the column is a key, unique, indexed, or referenced by a constraint, view or trigger). Any other change, such as a type or constraint, needs a rebuild: set `PRAGMA foreign_keys=OFF` outside the transaction, then in one transaction create the new table, copy rows in batches, drop the old one, rename, and run `PRAGMA foreign_key_check` before committing. Index builds block writers, so run them in a quiet window.

3. **Foreign Keys & Indices:**
   - Explicitly index foreign key columns to eliminate table locks on cascaded operations.
   - Order composite index columns: equality filters first, range/sort filters second.

4. **Reversibility:**
   - Every migration must have a tested, matching rollback step (`down()` / `down.sql`).
   - Reversible migrations must not assume default states that wipe data on rollback.

## Validation Checklist

- [ ] Migration applies and rolls back cleanly on an empty database.
- [ ] No long-lived exclusive table locks on large tables.
- [ ] Large data updates/backfills are decoupled into batched background jobs or scripts.
