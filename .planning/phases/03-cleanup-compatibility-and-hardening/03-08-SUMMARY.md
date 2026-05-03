---
phase: 03-cleanup-compatibility-and-hardening
plan: 08
subsystem: security
tags: [share-links, mysql, schema-validation, route-hardening, tdd]
requires:
  - phase: 03-cleanup-compatibility-and-hardening
    provides: Phase 3 verification and review gaps for MySQL share limiter width and malformed create input
provides:
  - MySQL share_rate_limits.share_id widened for hashed limiter identifiers
  - Schema validator and regression coverage rejecting legacy MySQL limiter width
  - Create-share route finite-number timing gate with NaN regression coverage
affects: [share-links, mysql, schema-alignment, owner-share-api]
tech-stack:
  added: []
  patterns: [TDD regression tests for schema validators and Hono route input normalization]
key-files:
  created:
    - .planning/phases/03-cleanup-compatibility-and-hardening/03-08-SUMMARY.md
  modified:
    - src/shared/db/migrator.ts
    - scripts/validate_share_schema_alignment.js
    - src/shared/db/shareSchemaAlignmentValidator.test.ts
    - src/shared/db/schema/mysql.ts
    - src/features/share/shareRoutes.ts
    - src/features/share/shareRoutes.test.ts
key-decisions:
  - "Widen only the MySQL share_rate_limits.share_id column to VARCHAR(255); share audit event share_id remains a share row ID at VARCHAR(36)."
  - "Strip non-finite owner create timing values to undefined at the route boundary rather than changing the public request contract or service API."
patterns-established:
  - "Route-owned numeric option forwarding uses Number.isFinite before passing optional values into share service creation."
requirements-completed: [HARD-01, HARD-02]
duration: 7min
completed: 2026-05-03
---

# Phase 03 Plan 08: Share Width and Timing Hardening Summary

**MySQL share limiter identifiers now fit hashed share keys, and create-share route input strips NaN timing values before service creation**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-03T12:41:45Z
- **Completed:** 2026-05-03T12:48:23Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Widened the MySQL `share_rate_limits.share_id` migration and MySQL schema source from `VARCHAR(36)` to `VARCHAR(255)`.
- Locked the schema alignment validator and Vitest fixture to reject legacy `share_rate_limits.share_id VARCHAR(36)`.
- Added route-level `Number.isFinite` normalization so `ttlSeconds` and `expiresAt` become `undefined` when non-finite, while finite values still pass through unchanged.

## Task Commits

1. **Task 1 RED: MySQL share limiter width regression** - `bc77138` (test)
2. **Task 1 GREEN: Widen MySQL share limiter identifier** - `9a257dc` (fix)
3. **Task 2 RED: NaN share timing input regression** - `2ae065b` (test)
4. **Task 2 GREEN: Strip non-finite share timing input** - `a5780b6` (fix)

## Files Created/Modified

- `src/shared/db/migrator.ts` - MySQL `create_share_link_tables` migration now defines `share_rate_limits.share_id VARCHAR(255) NOT NULL`.
- `scripts/validate_share_schema_alignment.js` - Validator now requires the widened limiter column in the MySQL share migration block.
- `src/shared/db/shareSchemaAlignmentValidator.test.ts` - Fixed fixture uses the widened limiter column and legacy-width regression fails.
- `src/shared/db/schema/mysql.ts` - MySQL Drizzle schema now matches the widened limiter column.
- `src/features/share/shareRoutes.ts` - Create-share handler normalizes optional timing values with `Number.isFinite`.
- `src/features/share/shareRoutes.test.ts` - NaN timing input regression plus finite-value pass-through coverage.
- `.planning/phases/03-cleanup-compatibility-and-hardening/03-08-SUMMARY.md` - Plan execution record.

## Decisions Made

- Keep `share_audit_events.share_id` at `VARCHAR(36)` because it stores internal share row IDs, not hashed limiter identifiers.
- Normalize malformed timing input at the route boundary and keep the public owner create response shape unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated MySQL schema source alongside the migration**
- **Found during:** Task 1 (Widen the MySQL share limiter identifier and lock the validator to it)
- **Issue:** The plan listed the migration, validator, and validator test, but `src/shared/db/schema/mysql.ts` also declared `shareRateLimits.shareId` as length 36. Leaving it unchanged would preserve schema drift in the source schema.
- **Fix:** Changed `shareRateLimits.shareId` to `varchar('share_id', { length: 255 })`.
- **Files modified:** `src/shared/db/schema/mysql.ts`
- **Verification:** `node scripts/validate_share_schema_alignment.js`; `npm --prefix backend test -- src/shared/db/shareSchemaAlignmentValidator.test.ts`
- **Committed in:** `9a257dc`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** The deviation keeps the MySQL migration, validator, and schema source consistent. No public contract or architectural changes.

## Issues Encountered

- Task 1 RED failed as expected: the new legacy `VARCHAR(36)` limiter-width test initially passed the validator.
- Task 2 RED required mocking `HonoRequest.prototype.json()` because native `Request.prototype.json()` is not what `c.req.json()` calls in Hono tests. After correction, the test failed for the intended reason: `createShareForOwner()` received `NaN`.

## Verification

- `node scripts/validate_share_schema_alignment.js` - passed.
- `npm --prefix backend test -- src/shared/db/shareSchemaAlignmentValidator.test.ts src/features/share/shareRoutes.test.ts` - passed, 2 files / 24 tests.
- `rg -n "share_id VARCHAR\\(255\\)|Number\\.isFinite|NaN" src/shared/db/migrator.ts scripts/validate_share_schema_alignment.js src/shared/db/shareSchemaAlignmentValidator.test.ts src/features/share/shareRoutes.ts src/features/share/shareRoutes.test.ts` - passed.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

The remaining Phase 3 gaps for MySQL limiter width and malformed create-share timing input are closed in source and regression tests. Plan 03-09 can focus on the remaining revocation audit event gap and regenerated runtime bundles.

## TDD Gate Compliance

- RED commits present: `bc77138`, `2ae065b`.
- GREEN commits present after RED: `9a257dc`, `a5780b6`.
- Refactor phase not needed.

## Self-Check: PASSED

- Confirmed summary file exists.
- Confirmed task commits `bc77138`, `9a257dc`, `2ae065b`, and `a5780b6` exist in git history.
- Confirmed required verification commands passed.

---
*Phase: 03-cleanup-compatibility-and-hardening*
*Completed: 2026-05-03*
