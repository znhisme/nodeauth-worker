---
phase: 01-foundation-and-security-primitives
plan: 05
subsystem: security
tags: [share-links, rate-limiting, public-dto, revocation, vitest]

requires:
  - phase: 01-foundation-and-security-primitives
    provides: Share security primitives, repository schema, and verification gap report from plans 01-01 through 01-04
provides:
  - Raw-token-free public share rate-limit persistence
  - Recipient-safe public share access decisions
  - Truthful owner revocation false semantics
  - Regression tests for public DTO leakage, public headers, raw limiter token storage, and failed revoke audit behavior
affects: [phase-02-owner-and-recipient-routes, share-link-security-contract, generated-output-validation]

tech-stack:
  added: []
  patterns:
    - HMAC-derived public limiter identifiers
    - Recipient-safe DTO contracts separate from owner share records
    - Pre-read repository state before boolean revocation updates

key-files:
  created:
    - .planning/phases/01-foundation-and-security-primitives/01-05-SUMMARY.md
  modified:
    - src/shared/middleware/shareRateLimitMiddleware.ts
    - src/shared/middleware/shareRateLimitMiddleware.test.ts
    - src/features/share/shareTypes.ts
    - src/features/share/shareService.ts
    - src/features/share/shareService.test.ts
    - src/shared/db/repositories/shareRepository.ts

key-decisions:
  - "Public share rate-limit keys and share IDs use HMAC-derived token components, never raw URL tokens."
  - "Recipient access decisions return `share: null` instead of stored share rows to minimize public metadata."
  - "Revocation success is based on an active owner-owned pre-read, not Drizzle update result truthiness."

patterns-established:
  - "Public share decisions carry `getSharePublicHeaders()` on denied and allowed outcomes."
  - "Service-level failed revoke behavior rejects and skips audit insertion when repository revocation returns false."

requirements-completed: [STATE-02, STATE-03, STATE-05, FND-03, STATE-04]

duration: 7min
completed: 2026-05-02
---

# Phase 01 Plan 05: Foundation Security Gap Closure Summary

**Share-link public access primitives now avoid durable raw-token storage, serialize recipient-safe decisions, and report revocation success truthfully.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-02T16:01:11Z
- **Completed:** 2026-05-02T16:07:23Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added failing-first regression coverage for raw limiter token persistence, public decision serialization, no-store public headers, and failed revoke audit suppression.
- Changed the public share limiter to derive persisted `key`/`shareId` values through `hashShareSecret()` before repository persistence.
- Narrowed `ShareAccessDecision.share` to a recipient-safe `SharePublicAccessRecord | null` contract and returned `share: null` from public access decisions.
- Fixed `ShareRepository.revokeForOwner()` to return `false` for missing, wrong-owner, and already-revoked shares before update.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add regression tests for gap assertions** - `17500fc` (test)
2. **Task 2: Fix public limiter derivation and recipient-safe access decisions** - `72d795b` (feat)
3. **Task 3: Fix revoke false semantics** - `5857382` (fix)

**Plan metadata:** Pending final summary commit.

## Files Created/Modified

- `src/shared/middleware/shareRateLimitMiddleware.ts` - Derives public token limiter identifiers with `getShareSecretPepper()` and `hashShareSecret()`.
- `src/shared/middleware/shareRateLimitMiddleware.test.ts` - Proves raw URL tokens are absent from `enforceRateLimit()` inputs.
- `src/features/share/shareTypes.ts` - Adds `SharePublicAccessRecord` and prevents public decisions from carrying `ShareLinkRecord`.
- `src/features/share/shareService.ts` - Returns recipient-safe public decisions with no-store/no-referrer headers on every outcome.
- `src/features/share/shareService.test.ts` - Covers decision serialization, public headers, successful access, denial cases, and failed revoke audit suppression.
- `src/shared/db/repositories/shareRepository.ts` - Pre-reads owner share state before revocation and returns false for no-op cases.

## Verification

- `npm --prefix backend test -- src/shared/middleware/shareRateLimitMiddleware.test.ts src/features/share/shareService.test.ts` - PASS, 2 files and 18 tests.
- Negative grep for raw token/stored-share patterns - PASS, no matches for raw `c.req.param('token')` persistence, `publicHeaders: undefined`, `share: share`, or `share?: ShareLinkRecord`.
- Required proof grep - PASS, found `not.toContain(rawToken)`, forbidden field serialization assertions, `insertAuditEvent).not.toHaveBeenCalled`, `SharePublicAccessRecord`, `getSharePublicHeaders`, and repository pre-read logic.

## Decisions Made

Followed the plan's minimum-disclosure recommendation by using `share: null` for public access outcomes instead of returning even allowlisted share metadata. This keeps recipient responses focused on status, headers, URL, and the shared item view.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Kept share limiter setup errors fail-closed**
- **Found during:** Task 2 (Fix public limiter derivation and recipient-safe access decisions)
- **Issue:** After adding HMAC derivation, missing share pepper errors could occur before the limiter's fail-closed repository `try` block.
- **Fix:** Moved raw token extraction, pepper resolution, token hashing, and key construction inside the protected block so setup failures return `share_inaccessible`.
- **Files modified:** `src/shared/middleware/shareRateLimitMiddleware.ts`
- **Verification:** Focused middleware/service Vitest suite passed.
- **Committed in:** `72d795b`

---

**Total deviations:** 1 auto-fixed (Rule 2).
**Impact on plan:** Required for STATE-05 fail-closed behavior; no scope expansion.

## Issues Encountered

The RED test run failed as intended: raw URL token persistence, public header omissions, and internal share row serialization were all observed before production fixes.

## Known Stubs

None. Stub scan only found intentional test helper defaults and null checks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 2 routes can depend on source-level share primitives that no longer persist raw public tokens in limiter rows, no longer serialize stored share rows to recipients, and no longer report revocation success for no-op updates. Generated Worker/Docker/Netlify output rebuild and validation remain queued for Plan 01-06 as planned.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/01-foundation-and-security-primitives/01-05-SUMMARY.md`.
- Task commits found: `17500fc`, `72d795b`, `5857382`.
- Shared orchestrator files were not staged or committed by this executor.

---
*Phase: 01-foundation-and-security-primitives*
*Completed: 2026-05-02*
