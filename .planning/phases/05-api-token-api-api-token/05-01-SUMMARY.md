---
phase: 05-api-token-api-api-token
plan: 01
subsystem: auth-api
tags: [hono, vitest, jwt, bearer-auth, vault-import]

# Dependency graph
requires:
  - phase: 04-ui-1-2
    provides: existing authenticated vault and share-management source path
provides:
  - Cookie-or-Bearer authentication in the shared auth middleware
  - Bearer-authenticated reuse of POST /api/vault/import
  - Regression tests for cookie CSRF preservation and aggregate-only import responses
affects: [auth, vault, api-token-import, phase-05-runtime-bundles]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Cookie credentials take precedence over Bearer credentials so browser CSRF remains strict.
    - Bearer credentials reuse the existing verifySecureJWT plus SessionService.validateSession flow.

key-files:
  created:
    - src/shared/middleware/auth.test.ts
    - src/features/vault/vaultRoutes.test.ts
  modified:
    - src/shared/middleware/auth.ts

key-decisions:
  - "Use the existing /api/vault/import route for API-token import rather than adding a second parser or endpoint."
  - "Prefer cookie auth over Bearer auth when both are present so browser requests still require double-submit CSRF."

patterns-established:
  - "Bearer API clients skip CSRF only when no auth_token cookie is present."
  - "Vault import route tests assert service delegation and response allowlists at the Hono route boundary."

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-05-04
---

# Phase 05 Plan 01: API Token Import Auth Summary

**Cookie-or-Bearer vault import authentication with active-session validation and aggregate-only route coverage**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-04T13:08:03Z
- **Completed:** 2026-05-04T13:13:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Extended `authMiddleware` so automation clients can authenticate with `Authorization: Bearer <jwt>` when no browser auth cookie is present.
- Preserved cookie-authenticated browser CSRF protection, including cookie precedence when both cookie and Bearer credentials are supplied.
- Added route coverage proving `POST /api/vault/import` delegates to `VaultService.importAccounts()` and returns only `{ success, count, duplicates, pending }`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add cookie-or-Bearer authentication without disabling cookie CSRF** - `343c903` (feat)
2. **Task 2: Prove Bearer-authenticated API import reuses the existing import service** - `e228f5f` (test)

**Plan metadata:** pending final docs commit

## Files Created/Modified

- `src/shared/middleware/auth.ts` - Adds cookie-or-Bearer token selection while keeping shared JWT and session validation.
- `src/shared/middleware/auth.test.ts` - Covers cookie CSRF success/failure, Bearer success/failure, inactive sessions, missing session IDs, and cookie precedence.
- `src/features/vault/vaultRoutes.test.ts` - Covers Bearer-authenticated import route delegation, limiter configuration, and safe aggregate response shape.

## Decisions Made

- Use the existing `/api/vault/import` route for API-token import rather than adding a second parser or endpoint.
- Prefer cookie auth over Bearer auth when both are present so browser requests still require double-submit CSRF.

## Deviations from Plan

None - plan executed within the requested source/test scope.

## Issues Encountered

- Initial Vitest class mocks for `SessionService`, `VaultService`, and `VaultRepository` used arrow implementations that cannot be called with `new`; the test harness was corrected to constructor-compatible function mocks.
- The route-level limiter assertion needed to preserve the module import-time `rateLimit({ windowMs, max })` call while clearing per-request mocks.

## Known Stubs

None. Stub scan found only test helper default parameters and no production placeholders or unwired data paths.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: authorization-header | src/shared/middleware/auth.ts | New Authorization Bearer credential source at the auth boundary, mitigated by JWT signature validation, required userInfo/sessionId, and active `SessionService.validateSession(sessionId)`. |

## Verification

- `npm --prefix backend test -- src/shared/middleware/auth.test.ts` - passed, 8 tests.
- `npm --prefix backend test -- src/features/vault/vaultRoutes.test.ts` - passed, 1 test.
- `npm --prefix backend test -- src/shared/middleware/auth.test.ts src/features/vault/vaultRoutes.test.ts` - passed, 9 tests.
- `rg -n "Authorization|Bearer|csrf_mismatch|validateSession\\(sessionId\\)|vault\\.post\\('/import'|importAccounts\\(" src/shared/middleware/auth.ts src/shared/middleware/auth.test.ts src/features/vault/vaultRoutes.ts src/features/vault/vaultRoutes.test.ts` - passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 05-02 can regenerate Worker, Docker, and Netlify backend bundles from source and assert that the generated runtime outputs contain the Bearer import behavior.

## Self-Check: PASSED

- Found: `src/shared/middleware/auth.ts`
- Found: `src/shared/middleware/auth.test.ts`
- Found: `src/features/vault/vaultRoutes.test.ts`
- Found: `.planning/phases/05-api-token-api-api-token/05-01-SUMMARY.md`
- Found commits: `343c903`, `e228f5f`

---
*Phase: 05-api-token-api-api-token*
*Completed: 2026-05-04*
