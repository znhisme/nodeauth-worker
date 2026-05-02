---
phase: 01-foundation-and-security-primitives
plan: 02
subsystem: api
tags: [share-links, security-contract, hmac, web-crypto, vitest, cloudflare-workers]
requires:
  - phase: 01-foundation-and-security-primitives
    provides: editable backend source, reproducible backend builds, and source-map provenance for share-link work
provides:
  - Written share-link security contract for token, access-code, TTL, revocation, logging, cache, origin, and UI scope rules
  - Share domain types and DTO contracts for share links, audit events, and access decisions
  - Web Crypto share-secret primitives for token/access-code generation, HMAC hashing, verification, URL building, and public headers
  - Backend Vitest configuration that points tests at the restored root `src/**` tree
affects: [phase-01, share-link-api, security-primitives]
tech-stack:
  added: [vitest-config, web-crypto-hmac, base64url-tokening]
  patterns: [security contract first, one-way secret derivation, API-only scope]
key-files:
  created: [docs/share-link-security-contract.md, src/features/share/shareTypes.ts, src/features/share/shareSecurity.ts, src/features/share/shareSecurity.test.ts, backend/vitest.config.ts]
  modified: [src/app/config.ts]
key-decisions:
  - "Treat share-link security as a written contract before route or schema work depends on it."
  - "Store only HMAC-derived share secrets and keep raw tokens/codes one-time only at creation."
  - "Keep Phase 1 API-only because editable frontend source is absent in this checkout."
patterns-established:
  - "Share tokens use 32 random bytes and access codes use 16 random bytes, both encoded as base64url."
  - "Public share responses must use no-store/no-cache/no-referrer protections and canonicalize the public origin."
  - "Backend Vitest runs against the restored root source tree through a backend-local config."
requirements-completed: [FND-03, STATE-02, UX-04]
duration: 5min
completed: 2026-05-02
---

# Phase 01 Plan 02: Share Link Security Primitives Summary

**Security contract, share domain contracts, and HMAC-based secret primitives for single-account share links**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-02T13:41:00Z
- **Completed:** 2026-05-02T13:46:56Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Wrote the share-link security contract covering token/code handling, TTL bounds, revocation, logging, origin, cache, and UI scope.
- Added share domain types and DTOs for link records, audit events, and access decisions.
- Implemented token/access-code generation, HMAC-SHA-256 hashing, verification, canonical URL building, and public response headers.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write security contract and share domain types** - `87db3a7` (feat)
2. **Task 2: Implement and test one-way share secret primitives** - `456935b` (feat)

## Files Created/Modified
- `docs/share-link-security-contract.md` - Security contract for share-link behavior and API/UI boundaries.
- `src/features/share/shareTypes.ts` - Share constants, status/event types, and DTO contracts.
- `src/features/share/shareSecurity.ts` - Token generation, HMAC hashing, verification, URL building, and public headers.
- `src/features/share/shareSecurity.test.ts` - Vitest coverage for the secret primitive behaviors.
- `backend/vitest.config.ts` - Backend-local Vitest config that targets restored root `src/**`.
- `src/app/config.ts` - Added share-specific env bindings.

## Decisions Made
- Treat the security contract as a first-class artifact before repository or route code.
- Use HMAC-derived storage for share secrets so plaintext tokens and access codes are never persisted.
- Keep this phase API-only because the checkout still lacks editable frontend source.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added backend Vitest config so restored root tests could run**
- **Found during:** Task 2 (Implement and test one-way share secret primitives)
- **Issue:** `npm --prefix backend test -- src/features/share/shareSecurity.test.ts` found no tests because Vitest was rooted in `backend/` and the restored source lives at repo root.
- **Fix:** Added `backend/vitest.config.ts` with a root/alias/include configuration that points Vitest at `../src`.
- **Files modified:** `backend/vitest.config.ts`
- **Verification:** `npm --prefix backend test -- src/features/share/shareSecurity.test.ts` passed with 6/6 tests green.
- **Committed in:** `456935b`

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking issue)
**Impact on plan:** Required to execute the plan’s mandated test command from the restored source layout. No scope creep.

## Issues Encountered
- The initial backend test invocation failed because Vitest did not scan the restored root `src/**` tree from the backend package boundary. The config fix resolved that without changing feature behavior.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 1 now has the security contract and secret primitives needed for durable share-state work in plan 03.
- Remaining Phase 1 work still needs schema, repository, service enforcement, audit, and fail-closed rate limiting.

## Self-Check: PASSED

- Created file exists.
- Commits `87db3a7` and `456935b` exist.
- Plan verification command passed.

---
*Phase: 01-foundation-and-security-primitives*
*Completed: 2026-05-02*
