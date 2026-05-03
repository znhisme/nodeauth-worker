---
phase: 03-cleanup-compatibility-and-hardening
plan: 09
subsystem: security
tags: [share-links, audit, backend-builds, source-maps, tdd]
requires:
  - phase: 03-cleanup-compatibility-and-hardening
    provides: Plan 03-08 schema and create-route hardening fixes
provides:
  - Owner revocation audit events from revokeShareForOwner()
  - Regression coverage for safe revoked audit metadata
  - Regenerated Worker, Docker, and Netlify backend bundles
  - Source-map provenance verification after final rebuild
affects: [share-links, audit-trail, worker-runtime, docker-runtime, netlify-runtime]
tech-stack:
  added: []
  patterns: [TDD regression test before owner revocation audit fix, generated-output assertions for runtime bundle contracts]
key-files:
  created:
    - .planning/phases/03-cleanup-compatibility-and-hardening/03-09-SUMMARY.md
  modified:
    - src/features/share/shareService.ts
    - src/features/share/shareService.test.ts
    - backend/dist/worker/worker.js
    - backend/dist/worker/worker.js.map
    - backend/dist/docker/server.js
    - backend/dist/docker/server.js.map
    - backend/dist/netlify/api.mjs
    - backend/dist/netlify/api.mjs.map
key-decisions:
  - "Mirror the existing revokeShare() audit contract in revokeShareForOwner() with revokedAt-only metadata."
  - "Leave .planning/source-provenance.md unchanged because source-map verification passed after regeneration."
patterns-established:
  - "Owner revocation paths must emit one safe revoked audit row after revokeForOwner() succeeds."
requirements-completed: [HARD-03, HARD-04]
duration: 5min
completed: 2026-05-03
---

# Phase 03 Plan 09: Revocation Audit and Bundle Regeneration Summary

**Owner share revocations now leave safe revoked audit evidence, and all backend runtime bundles were regenerated from source**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-03T12:53:07Z
- **Completed:** 2026-05-03T12:58:15Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added a failing regression test proving `revokeShareForOwner()` must insert exactly one `revoked` audit event.
- Updated `revokeShareForOwner()` to emit owner audit metadata with only `revokedAt`, null IP/user-agent hashes, and no token/code/vault secret data.
- Rebuilt Worker, Docker, and Netlify backend bundles through the project build scripts and verified source-map provenance.
- Confirmed generated bundles still contain `eventType: "revoked"`, `share_inaccessible`, `Cache-Control`, and `Referrer-Policy`.

## Task Commits

1. **Task 1 RED: Owner revoke audit regression** - `0528380` (test)
2. **Task 1 GREEN: Owner revoke audit emission** - `3ba84d6` (fix)
3. **Task 2: Regenerate backend runtime bundles** - `7615e21` (chore)

_Note: Task 1 followed the plan's TDD intent, so it produced separate RED and GREEN commits._

## Files Created/Modified

- `src/features/share/shareService.ts` - `revokeShareForOwner()` now inserts a `revoked` audit event after successful owner revocation.
- `src/features/share/shareService.test.ts` - Adds regression coverage for one safe owner revocation audit row and `revokedAt` metadata.
- `backend/dist/worker/worker.js` and `backend/dist/worker/worker.js.map` - Regenerated Worker bundle and source map.
- `backend/dist/docker/server.js` and `backend/dist/docker/server.js.map` - Regenerated Docker bundle and source map.
- `backend/dist/netlify/api.mjs` and `backend/dist/netlify/api.mjs.map` - Regenerated Netlify bundle and source map.

## Decisions Made

- Reused the existing `revokeShare()` audit envelope for owner API revocation instead of introducing a new event shape.
- Did not refresh `.planning/source-provenance.md` because `node scripts/restore_backend_source_from_sourcemaps.js --verify` passed after rebuild.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Task 1 RED failed as expected: the new regression test saw zero `insertAuditEvent()` calls from `revokeShareForOwner()`.
- No source-map provenance drift occurred after rebuild, so the provenance file did not need to change.

## Verification

- `npm --prefix backend test -- src/features/share/shareService.test.ts` - passed, 1 file / 27 tests.
- `rg -n "eventType: 'revoked'|insertAuditEvent|revokedAt" src/features/share/shareService.ts src/features/share/shareService.test.ts` - passed.
- `npm --prefix backend test` - passed, 7 files / 85 tests.
- `node scripts/validate_share_schema_alignment.js` - passed.
- `npm --prefix backend run build:worker` - passed.
- `npm --prefix backend run build:docker` - passed.
- `npm --prefix backend run build:netlify` - passed.
- `node scripts/restore_backend_source_from_sourcemaps.js --verify` - passed.
- `rg -n "eventType\\s*:\\s*['\\\"]revoked['\\\"]|share_inaccessible|Cache-Control|Referrer-Policy" backend/dist/worker/worker.js backend/dist/docker/server.js backend/dist/netlify/api.mjs` - passed.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None.

## Next Phase Readiness

Plan 03-09 closes the remaining owner revocation audit regression and refreshes all supported backend runtime bundles. Phase 3 hardening requirements `HARD-03` and `HARD-04` are ready to be marked complete.

## TDD Gate Compliance

- RED commit present: `0528380`.
- GREEN commit present after RED: `3ba84d6`.
- Refactor phase not needed.

## Self-Check: PASSED

- Confirmed summary file exists.
- Confirmed task commits `0528380`, `3ba84d6`, and `7615e21` exist in git history.
- Confirmed required verification commands passed.

---
*Phase: 03-cleanup-compatibility-and-hardening*
*Completed: 2026-05-03*
