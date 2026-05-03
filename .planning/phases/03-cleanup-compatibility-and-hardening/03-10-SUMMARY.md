---
phase: 03-cleanup-compatibility-and-hardening
plan: 10
subsystem: database
tags: [share-links, mysql, schema-validation, migrator, tdd]
requires:
  - phase: 03-cleanup-compatibility-and-hardening
    provides: Plan 03-09 revocation audit and generated bundle baseline
provides:
  - MySQL share and audit ID columns widened for prefixed runtime IDs
  - MySQL-specific baseline share DDL for self-healing startup schema creation
  - Docker MySQL schema preload guard for share tables from schema.sql
  - Schema alignment validator coverage for legacy widths and baseline TEXT drift
affects: [share-links, mysql-schema, schema-validator, runtime-migration]
tech-stack:
  added: []
  patterns: [Scoped MySQL baseline override for share tables, validator fixtures for migration and baseline DDL drift]
key-files:
  created:
    - .planning/phases/03-cleanup-compatibility-and-hardening/03-10-SUMMARY.md
  modified:
    - src/shared/db/migrator.ts
    - src/app/server.ts
    - src/shared/db/schema/mysql.ts
    - scripts/validate_share_schema_alignment.js
    - src/shared/db/shareSchemaAlignmentValidator.test.ts
key-decisions:
  - "Use a scoped MYSQL_SHARE_BASE_SCHEMA override instead of broad TEXT-to-VARCHAR transforms for MySQL baseline share tables."
  - "Skip share table/index statements from schema.sql during Docker MySQL startup so migrateDatabase() owns bounded share table creation."
  - "Require VARCHAR(64) for prefixed share and share-audit IDs while preserving share_rate_limits.share_id as VARCHAR(255)."
patterns-established:
  - "Schema alignment checks must inspect both migration DDL and baseline/self-healing DDL for supported database compatibility."
requirements-completed: [HARD-01]
duration: 8min
completed: 2026-05-03
---

# Phase 03 Plan 10: MySQL Share Schema Gap Summary

**MySQL share/audit identifiers now fit prefixed runtime IDs, and baseline share DDL is validated against legacy drift**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-03T21:45:30+08:00
- **Completed:** 2026-05-03T21:51:24+08:00
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Widened MySQL `share_links.id`, `share_links.vault_item_id`, `share_audit_events.id`, and `share_audit_events.share_id` to `VARCHAR(64)`.
- Added `MYSQL_SHARE_BASE_SCHEMA` and `getBaseSchemaForEngine()` so MySQL baseline/self-healing creation uses bounded share table DDL before migrations run.
- Added a Docker startup guard that skips only share table/index statements from `schema.sql` for MySQL, preventing that preload path from creating legacy unbounded share tables before migrations run.
- Extended `validate_share_schema_alignment.js` to check both migration 13 and MySQL baseline share DDL.
- Expanded validator tests to fail on legacy `VARCHAR(36)` widths, unbounded baseline `TEXT` identifier drift, and missing Docker MySQL schema preload protection.

## Task Commits

Pending commit in current working tree.

## Files Created/Modified

- `src/shared/db/migrator.ts` - Adds MySQL-safe baseline share DDL and widens migration 13 share/audit ID columns.
- `src/app/server.ts` - Skips share table/index `schema.sql` preload statements when Docker runs against MySQL.
- `src/shared/db/schema/mysql.ts` - Widens MySQL Drizzle share/audit ID columns to `length: 64`.
- `scripts/validate_share_schema_alignment.js` - Validates migration, baseline DDL, and Docker preload guarding for bounded MySQL share definitions.
- `src/shared/db/shareSchemaAlignmentValidator.test.ts` - Adds regression fixtures for legacy width, baseline TEXT drift, and missing Docker preload guard.

## Decisions Made

- Kept SQLite/D1/Postgres baseline share DDL unchanged.
- Used a scoped MySQL baseline override only for `share_links`, `share_audit_events`, and `share_rate_limits`.
- Left non-share schema.sql preload behavior unchanged for Docker startup compatibility.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial validator run correctly failed until migration 13's real MySQL block was widened from `VARCHAR(36)` to `VARCHAR(64)`.
- Advisory code review found the Docker `schema.sql` preload path could still create old share tables before `migrateDatabase()`; fixed with a MySQL-only share schema skip guard.
- Source-map verification was stale before bundle regeneration, as expected; Plan 03-11 rebuilt bundles and verified source maps.

## Verification

- `npm --prefix backend test -- src/shared/db/shareSchemaAlignmentValidator.test.ts src/app/index.test.ts` - passed, 24 tests.
- `node scripts/validate_share_schema_alignment.js` - passed.
- Required `rg` source assertions for `VARCHAR(64)`, `VARCHAR(255)`, `MYSQL_SHARE_BASE_SCHEMA`, and `getBaseSchemaForEngine` - passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03-10 closes the source/schema validator side of the MySQL compatibility gap. Plan 03-11 rebuilt generated runtime artifacts from this source.

## Self-Check: PASSED

- Confirmed summary file exists.
- Confirmed source validator and targeted tests pass.
- Confirmed source contains the required MySQL DDL and Drizzle schema markers.

---
*Phase: 03-cleanup-compatibility-and-hardening*
*Completed: 2026-05-03*
