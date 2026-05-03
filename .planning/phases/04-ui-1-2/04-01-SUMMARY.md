---
phase: 04-ui-1-2
plan: 01
subsystem: backend
tags: [share-links, latest-share-wins, repository, service, vitest]

requires:
  - phase: 01-foundation-and-security-primitives
    provides: share-link durable state, audit events, and hashed secret storage
  - phase: 02-share-link-api
    provides: owner create and public recipient access service contracts
provides:
  - Owner+vault active-share replacement repository helper
  - Service-level latest-share-wins enforcement for share creation
  - Regression tests for replacement audit privacy and old-link inaccessibility
affects: [04-ui-1-2, share-management-ui, batch-share]

tech-stack:
  added: []
  patterns:
    - "Select matching active shares before update so service can emit audit events without leaking secret values"
    - "Revoke older shares after owner validation and before new raw token/access-code generation"

key-files:
  created: []
  modified:
    - src/shared/db/repositories/shareRepository.ts
    - src/shared/db/repositories/shareRepository.test.ts
    - src/features/share/shareService.ts
    - src/features/share/shareService.test.ts

key-decisions:
  - "Enforce latest-share-wins in backend service/repository logic so UI cannot merely hide still-usable old links."
  - "Use safe replacement audit metadata containing only revokedAt and reason: latest_share_wins."

patterns-established:
  - "Repository replacement helper returns selected old ShareLink rows for audit emission after revocation."
  - "Service creates replacement audit events before returning the new one-time raw token/access code."

requirements-completed: [PH4-BE-01, PH4-SEC-01]

duration: 4min
completed: 2026-05-03
---

# Phase 04-ui-1-2 Plan 01: Latest-Share-Wins Backend Summary

**Backend latest-share-wins now revokes older active owner/account links before returning a new one-time share URL and access code.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-03T21:43:23Z
- **Completed:** 2026-05-03T21:47:45Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `ShareRepository.revokeActiveForOwnerVaultItem()` to select active, unrevoked, unexpired shares for one owner+vault item and mark them revoked.
- Updated `ShareService.createShare()` to revoke older active shares after ownership validation and before generating the new raw token/access code.
- Added TDD regression coverage proving replacement audit metadata is safe and revoked old links resolve through the generic inaccessible public contract without secret processing.

## Task Commits

1. **Task 1 RED: Add failing repository replacement test** - `a343e81` (test)
2. **Task 1 GREEN: Add active share replacement repository helper** - `c421cf8` (feat)
3. **Task 2 RED: Add failing latest-share-wins service tests** - `cffa9da` (test)
4. **Task 2 GREEN: Enforce latest-share-wins in service** - `166383d` (feat)

## Files Created/Modified

- `src/shared/db/repositories/shareRepository.ts` - Added owner+vault active-share revocation helper.
- `src/shared/db/repositories/shareRepository.test.ts` - Added Drizzle mock coverage and repository regression test.
- `src/features/share/shareService.ts` - Revokes older active shares and writes safe replacement audit events before new secret generation.
- `src/features/share/shareService.test.ts` - Added latest-share-wins, audit privacy, and old-token inaccessible tests.
- `.planning/phases/04-ui-1-2/04-01-SUMMARY.md` - Execution summary.

## Decisions Made

- Enforced latest-share-wins in backend service/repository logic, not in the UI.
- Kept replacement audit metadata to `{ revokedAt, reason: 'latest_share_wins' }` only.
- Did not add a database uniqueness constraint, preserving cross-database compatibility.

## Verification

- `cd backend && npm test -- ../src/shared/db/repositories/shareRepository.test.ts` - passed, 4 tests.
- `cd backend && npm test -- ../src/features/share/shareService.test.ts` - passed, 29 tests.
- `cd backend && npm test -- ../src/shared/db/repositories/shareRepository.test.ts ../src/features/share/shareService.test.ts` - passed, 33 tests.
- Acceptance greps for `revokeActiveForOwnerVaultItem`, `gt(shareLinks.expiresAt, revokedAt)`, `latest_share_wins`, and raw secret omission assertions all passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wrapped Drizzle eq/and in repository test mock**
- **Found during:** Task 1 GREEN
- **Issue:** The new repository test asserted `eq(...)` predicate calls, but the mock only wrapped `gt`, `isNull`, `lt`, `lte`, and `count`.
- **Fix:** Added mocked `eq` and `and` functions so predicate assertions are executable and meaningful.
- **Files modified:** `src/shared/db/repositories/shareRepository.test.ts`
- **Verification:** Repository test passed.
- **Committed in:** `c421cf8`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix only strengthened the planned repository test harness. No scope change.

## Issues Encountered

- RED tests failed as expected before implementation.
- Existing `.planning/STATE.md` had uncommitted changes before execution; it was left untouched and unstaged per orchestrator ownership.

## Known Stubs

None.

## Threat Flags

None. The changed surface stays within the plan threat model for share creation, share repository state, replacement audit metadata, and public old-link access.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 02 can build batch sharing on a backend that now guarantees only the latest active share remains usable for a given owner/account item.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/04-ui-1-2/04-01-SUMMARY.md`.
- Task commits found: `a343e81`, `c421cf8`, `cffa9da`, `166383d`.
- Targeted tests passed.

---
*Phase: 04-ui-1-2*
*Completed: 2026-05-03*
