---
phase: 01-foundation-and-security-primitives
plan: 07
subsystem: security
tags: [share-links, audit, rate-limiting, vitest, redaction]

requires:
  - phase: 01-foundation-and-security-primitives
    provides: Share service, repository, audit-event schema, and fail-closed share limiter from plans 01-03 through 01-06
provides:
  - Service-level `access_granted` audit events after successful public share access
  - Service-level `expired` audit events before generic expired public decisions
  - Middleware-level `access_denied_threshold` audit events for locked real shares
  - Regression coverage proving audit payloads and limiter keys omit raw tokens, access codes, passwords, TOTP seeds, and full public URLs
affects: [phase-02-owner-and-recipient-routes, share-link-security-contract, state-04-verification]

tech-stack:
  added: []
  patterns:
    - Audit writes for public share access live below routes in service and middleware primitives
    - Public share limiter keys use a route-family label plus derived token hash instead of request paths
    - Threshold-denial audits are inserted only when the derived token hash resolves to a real share

key-files:
  created:
    - .planning/phases/01-foundation-and-security-primitives/01-07-SUMMARY.md
  modified:
    - src/features/share/shareService.ts
    - src/features/share/shareService.test.ts
    - src/shared/middleware/shareRateLimitMiddleware.ts
    - src/shared/middleware/shareRateLimitMiddleware.test.ts

key-decisions:
  - "Keep successful-access, expired, and threshold-denial audit writes below the route layer so Phase 2 routes inherit STATE-04 behavior."
  - "Use a static `share-public-access` route-family component for default limiter keys instead of persisting request paths that may contain raw tokens."
  - "Skip threshold-denial audit insertion when a derived token hash does not resolve to a share because audit rows require real owner and share IDs."

patterns-established:
  - "Share audit metadata is serialized from small allowlisted status/timestamp/limiter fields only."
  - "TDD RED/GREEN commits are used for share security regression work."

requirements-completed: [STATE-04]

duration: 10min
completed: 2026-05-02
---

# Phase 01 Plan 07: Share Audit Gap Closure Summary

**Service and middleware share primitives now record safe `access_granted`, `expired`, and `access_denied_threshold` audit events before Phase 2 routes depend on them.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-02T17:20:00Z
- **Completed:** 2026-05-02T17:28:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added service-level `access_granted` audit insertion after successful access-code verification and vault-item lookup.
- Added service-level `expired` audit insertion before returning the existing generic expired public decision.
- Changed the share limiter default key to avoid request paths that may contain raw public tokens.
- Added threshold-denial audit insertion for locked attempts when the derived token hash resolves to a real share.
- Added focused Vitest coverage for audit insertion and redaction of raw tokens, access codes, password/TOTP markers, and full URL markers.

## Task Commits

Each TDD task used separate RED and GREEN commits:

1. **Task 1: Audit successful and expired share access in the service** - `d7e0c34` (test), `4592926` (feat)
2. **Task 2: Audit share rate-limit threshold denial safely** - `dfcf081` (test), `19bd100` (feat)

**Plan metadata:** Pending final summary commit.

## Files Created/Modified

- `src/features/share/shareService.ts` - Records `expired` and `access_granted` audit events with minimal safe metadata.
- `src/features/share/shareService.test.ts` - Covers successful-access and expiration audit events plus audit redaction assertions.
- `src/shared/middleware/shareRateLimitMiddleware.ts` - Sanitizes default limiter keys and records `access_denied_threshold` events for real locked shares.
- `src/shared/middleware/shareRateLimitMiddleware.test.ts` - Covers threshold audit insertion, unknown-token audit suppression, and limiter key redaction.
- `.planning/phases/01-foundation-and-security-primitives/01-07-SUMMARY.md` - Documents plan execution, verification, and commits.

## Verification

- `npm --prefix backend test -- src/features/share/shareService.test.ts src/shared/middleware/shareRateLimitMiddleware.test.ts` - PASS, 2 files and 21 tests.
- `rg -n "eventType: 'access_granted'|eventType: 'expired'" src/features/share/shareService.ts src/features/share/shareService.test.ts` - PASS, source and tests matched.
- `rg -n "eventType: 'access_denied_threshold'|findByTokenHash\\(tokenHash\\)" src/shared/middleware/shareRateLimitMiddleware.ts src/shared/middleware/shareRateLimitMiddleware.test.ts` - PASS, source and tests matched.
- `rg -n "c\\.req\\.url|publicUrl|fullUrl|accessCode" src/shared/middleware/shareRateLimitMiddleware.ts` - PASS, no matches.
- `rg -n "not\\.toContain\\(rawToken\\)|not\\.toContain\\('password'\\)|not\\.toContain\\('seed'\\)|not\\.toContain\\('https://'\\)" src/features/share/shareService.test.ts src/shared/middleware/shareRateLimitMiddleware.test.ts` - PASS, redaction assertions matched.

## Decisions Made

- Kept audit behavior in `ShareService.resolveShareAccess()` and `shareRateLimit()` rather than deferring it to future route handlers.
- Used fail-closed middleware behavior unchanged: storage, lookup, hash, and audit failures still produce generic `share_inaccessible`.
- Avoided fabricating audit rows for unknown token hashes because the durable audit table needs a real `shareId` and `ownerId`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- TDD RED runs failed as intended before implementation: service tests observed missing `markAccessed`/audit calls, and middleware tests observed raw-token path persistence.
- `DEPLOY.md` remained an unrelated untracked file and was left untouched.

## Known Stubs

None. Stub scan only found intentional test helper defaults and existing null checks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 2 owner and recipient routes can depend on below-route audit coverage for creation, revocation, successful access, expiration, and threshold denial without repeating these writes route-by-route.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/01-foundation-and-security-primitives/01-07-SUMMARY.md`.
- Modified source and test files exist.
- Task commits found: `d7e0c34`, `4592926`, `dfcf081`, `19bd100`.
- `DEPLOY.md` remains untracked and was not staged.

---
*Phase: 01-foundation-and-security-primitives*
*Completed: 2026-05-02*
