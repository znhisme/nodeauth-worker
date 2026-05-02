---
phase: 02-share-link-api
plan: 05
subsystem: api
tags: [hono, cors, share-links, security, vitest]

# Dependency graph
requires:
  - phase: 02-share-link-api
    provides: owner share routes, public recipient access, and source-level API behavior needing gap closure
provides:
  - trusted-origin credentialed API CORS
  - access-code-first public share secret processing
  - regression tests for both Phase 2 security gaps
affects:
  - 02-06 generated backend bundle regeneration
  - Phase 3 compatibility and hardening verification

# Tech tracking
tech-stack:
  added: [none]
  patterns: [configured-origin CORS allowlist, access-code-first secret processing, TDD security regression tests]

key-files:
  created:
    - .planning/phases/02-share-link-api/02-05-SUMMARY.md
  modified:
    - src/app/index.ts
    - src/app/index.test.ts
    - src/features/share/shareService.ts
    - src/features/share/shareService.test.ts

key-decisions:
  - "Use NODEAUTH_PUBLIC_ORIGIN as the sole trusted browser origin for credentialed API CORS because EnvBindings exposes no separate app-origin setting."
  - "Verify the public share access code before decrypting vault secret material or generating OTP output."

patterns-established:
  - "Pattern 1: credentialed API CORS must return the request origin only after exact configured-origin allowlist matching"
  - "Pattern 2: public share access must reject wrong access codes before any vault secret decryption or OTP generation"

requirements-completed: [OWN-01, OWN-02, OWN-03, OWN-04, OWN-05, OWN-06, OWN-07, REC-01, REC-02, REC-03, REC-04, REC-05, REC-06, UX-02]

# Metrics
duration: 6m
completed: 2026-05-03
---

# Phase 02 Plan 05: Share Link API Security Gap Closure Summary

**Trusted-origin credentialed CORS and access-code-first public share secret processing with focused regression coverage**

## Performance

- **Duration:** 6m
- **Started:** 2026-05-02T23:17:28Z
- **Completed:** 2026-05-02T23:23:20Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Replaced reflected credentialed `/api/*` CORS with `resolveApiCorsOrigin()`, allowing only exact matches to normalized `NODEAUTH_PUBLIC_ORIGIN`.
- Moved public share access-code verification before `decryptField()` and OTP `generate()` in `resolveShareAccess()`.
- Added TDD regression coverage for arbitrary-origin denial, deterministic configured-origin allowance, wrong-code secret-processing short-circuiting, and correct-code success behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Trusted API CORS tests** - `891d60a` (`test`)
2. **Task 1 GREEN: Restrict API CORS to trusted origin** - `e9b0097` (`feat`)
3. **Task 2 RED: Access-code-first share access tests** - `0ce0f50` (`test`)
4. **Task 2 GREEN: Verify share access code before secret processing** - `d734e95` (`feat`)

## Files Created/Modified

- `.planning/phases/02-share-link-api/02-05-SUMMARY.md` - completion summary and verification record.
- `src/app/index.ts` - exported `resolveApiCorsOrigin()` and wired API CORS to trusted configured-origin matching.
- `src/app/index.test.ts` - added CORS helper tests and source assertions against wildcard/reflected credentialed CORS.
- `src/features/share/shareService.ts` - moved access-code verification before vault secret decryption and OTP generation.
- `src/features/share/shareService.test.ts` - added spies proving wrong-code requests do not decrypt or generate OTP, while correct-code access still succeeds.

## Decisions Made

- Use `NODEAUTH_PUBLIC_ORIGIN` as the only trusted credentialed CORS origin because the current environment contract exposes no `NODEAUTH_APP_ORIGIN`.
- Keep `credentials: true` for configured same-site/same-origin API use, but return `null` for untrusted or unconfigured origins so Hono does not set `Access-Control-Allow-Origin`.
- Preserve the existing generic public share inaccessible response shape; wrong-code attempts still return `itemView: null` and do not create a successful access audit.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification

- `npm --prefix backend test -- src/app/index.test.ts` - PASS, 9 tests.
- `npm --prefix backend test -- src/features/share/shareService.test.ts` - PASS, 18 tests.
- `npm --prefix backend test -- src/app/index.test.ts src/features/share/shareService.test.ts` - PASS, 27 tests.
- `npm --prefix backend test -- src/features/share/shareService.test.ts src/features/share/shareRoutes.test.ts src/shared/middleware/shareRateLimitMiddleware.test.ts src/app/index.test.ts` - PASS, 42 tests.
- Source-order check for `verifyShareSecret` before `decryptField` and OTP `generate()` - PASS.
- CORS source check rejecting reflected/wildcard origins and confirming `resolveApiCorsOrigin(origin, c.env)` plus `credentials: true` - PASS.

## Known Stubs

None. Stub-pattern scan found only test helper defaults and legitimate nullable metadata fields.

## Threat Flags

None. This plan reduces existing browser-origin and public-recipient trust-boundary exposure without adding new network endpoints, auth paths, file access patterns, or schema changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 02-06 can regenerate Worker, Docker, and Netlify backend bundles from these source fixes and verify source-map alignment.

## Self-Check: PASSED

- Found `.planning/phases/02-share-link-api/02-05-SUMMARY.md`.
- Found `src/app/index.ts`, `src/app/index.test.ts`, `src/features/share/shareService.ts`, and `src/features/share/shareService.test.ts`.
- Found task commits `891d60a`, `e9b0097`, `0ce0f50`, and `d734e95`.

---
*Phase: 02-share-link-api*
*Completed: 2026-05-03*
