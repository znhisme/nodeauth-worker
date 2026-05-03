---
phase: 04-ui-1-2
plan: 02
subsystem: backend
tags: [share-links, batch-api, hono, vitest, privacy]

requires:
  - phase: 04-ui-1-2
    provides: latest-share-wins owner share creation from plan 04-01
provides:
  - Owner-safe batch share DTO contracts
  - ShareService batch creation delegating to latest-share-wins single-share behavior
  - Authenticated POST /api/share/batch route with bounded input and privacy-safe partial failures
  - Route and service regression tests for batch one-time secret and failure allowlists
affects: [04-ui-1-2, share-management-ui, batch-share]

tech-stack:
  added: []
  patterns:
    - "Batch share service delegates each selected vault item to createShareForOwner so latest-share-wins and one-time secret rules remain centralized"
    - "Batch failure rows expose only requestIndex and could_not_create_share"

key-files:
  created:
    - .planning/phases/04-ui-1-2/04-02-SUMMARY.md
  modified:
    - src/features/share/shareTypes.ts
    - src/features/share/shareService.ts
    - src/features/share/shareService.test.ts
    - src/features/share/shareRoutes.ts
    - src/features/share/shareRoutes.test.ts

key-decisions:
  - "Use backend batch semantics instead of requiring the UI to loop over single-create calls."
  - "Keep partial failure rows generic and index-based so inaccessible account IDs, labels, owner IDs, hashes, and diagnostics are not returned."
  - "Insert /api/share/batch before parameterized share routes so it cannot be treated as a share id."

patterns-established:
  - "Batch owner APIs return successes and failures arrays keyed by requestIndex."
  - "Route-level owner identity is always derived from authMiddleware user.email || user.id, never request JSON."

requirements-completed: [PH4-BE-02, PH4-SEC-01]

duration: 5min
completed: 2026-05-03
---

# Phase 04-ui-1-2 Plan 02: Batch Share API Summary

**Authenticated owners can batch-create account share links with one-time secrets for successful rows and generic privacy-safe partial failures.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-03T21:51:10Z
- **Completed:** 2026-05-03T21:56:31Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added batch share DTOs for request input, success rows, generic failure rows, and the combined result.
- Added `ShareService.createSharesForOwnerBatch()` to process selected vault item IDs in request order while reusing `createShareForOwner()` for latest-share-wins and one-time raw token/access-code delivery.
- Added authenticated `POST /api/share/batch` with owner derivation from auth state, non-empty string-array validation, a 50-item cap, and finite timing forwarding.
- Expanded service and route tests for all-success, mixed success/failure, request-order indices, attacker-supplied owner ID ignoring, response allowlists, and failure privacy.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing batch share service tests** - `f79892c` (test)
2. **Task 1 GREEN: Implement batch share service** - `1fa8b1e` (feat)
3. **Task 2 RED: Add failing batch share route tests** - `9cec0cc` (test)
4. **Task 2 GREEN: Expose batch share route** - `bbd8420` (feat)

**Plan metadata:** pending final docs commit

## Files Created/Modified

- `src/features/share/shareTypes.ts` - Added `CreateSharesBatchInput`, batch success/failure row DTOs, and `OwnerShareBatchCreatedView`.
- `src/features/share/shareService.ts` - Added ordered batch creation that delegates every row to `createShareForOwner()` and catches per-row failures generically.
- `src/features/share/shareService.test.ts` - Added TDD coverage for all-success, mixed failure, request indices, one-time secrets, and failure privacy.
- `src/features/share/shareRoutes.ts` - Added authenticated `POST /api/share/batch` before parameterized/public routes.
- `src/features/share/shareRoutes.test.ts` - Added route coverage for owner scoping, validation, max batch size, success allowlists, and partial failure privacy.
- `.planning/phases/04-ui-1-2/04-02-SUMMARY.md` - Execution summary.

## Decisions Made

- Used a backend batch endpoint so replacement semantics and partial-failure shape are consistent for the future UI.
- Returned only `requestIndex` and `could_not_create_share` for failed rows; no failed `vaultItemId`, account label, owner ID, exception text, hashes, or credential data.
- Kept raw URL/token and access code only inside successful created share rows.

## Verification

- `cd backend && npm test -- ../src/features/share/shareService.test.ts` - passed, 32 tests after GREEN.
- `cd backend && npm test -- ../src/features/share/shareRoutes.test.ts` - passed, 23 tests after GREEN.
- `cd backend && npm test -- ../src/features/share/shareService.test.ts ../src/features/share/shareRoutes.test.ts` - passed, 55 tests.
- Acceptance greps for batch DTOs, `createSharesForOwnerBatch`, `could_not_create_share`, `/batch`, validation messages, and route/service wiring all passed.

## TDD Gate Compliance

- RED service commit present: `f79892c`.
- GREEN service commit present after RED: `1fa8b1e`.
- RED route commit present: `9cec0cc`.
- GREEN route commit present after RED: `bbd8420`.
- No refactor commit was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made batch route origin fallback tolerate missing test env**
- **Found during:** Task 2 GREEN
- **Issue:** The new batch route initially read `c.env.NODEAUTH_PUBLIC_ORIGIN`; one route test intentionally did not pass an env object, producing an internal server error instead of using the request origin fallback.
- **Fix:** Changed the new batch route to use optional env access before falling back to `new URL(c.req.url).origin`.
- **Files modified:** `src/features/share/shareRoutes.ts`
- **Verification:** `cd backend && npm test -- ../src/features/share/shareRoutes.test.ts` passed.
- **Committed in:** `bbd8420`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix preserves the planned fallback behavior and keeps route tests representative of supported Hono request environments.

## Issues Encountered

- RED service tests failed as expected because `createSharesForOwnerBatch` did not exist.
- RED route tests failed as expected because `/api/share/batch` was matched by the existing parameterized route before implementation.

## Known Stubs

None.

## Threat Flags

None. The new authenticated batch route and service method are explicitly covered by this plan's threat model.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03 can regenerate backend runtime bundles and keep frontend UI work gated on restored editable Vue source. The backend now exposes the batch API semantics needed by the requested My Accounts bulk Share button.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/04-ui-1-2/04-02-SUMMARY.md`.
- Task commits found: `f79892c`, `1fa8b1e`, `9cec0cc`, `bbd8420`.
- Targeted service and route tests passed together.
- `.planning/STATE.md` and `.planning/ROADMAP.md` were not modified by this executor.

---
*Phase: 04-ui-1-2*
*Completed: 2026-05-03*
