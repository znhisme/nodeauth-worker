---
phase: 03-cleanup-compatibility-and-hardening
plan: 02
subsystem: infra
tags: [cloudflare-worker, docker, netlify, cleanup, cron]
requires:
  - phase: 03-cleanup-compatibility-and-hardening
    provides: Count-only ShareService.cleanupShareState runtime primitive
provides:
  - Worker scheduled share cleanup beside backup
  - Docker daily cron share cleanup beside backup
  - Netlify hourly opportunistic cleanup guard
affects: [worker-runtime, docker-runtime, netlify-runtime, share-cleanup]
tech-stack:
  added: []
  patterns: [shared runtime cleanup service, count-only maintenance logging]
key-files:
  created: []
  modified:
    - src/app/worker.ts
    - src/app/server.ts
    - src/app/netlify.ts
    - src/app/index.test.ts
key-decisions:
  - "All runtimes call createShareService(...).cleanupShareState() instead of duplicating cleanup SQL."
  - "Netlify uses an hourly warm-instance opportunistic guard rather than promising scheduled-function plumbing absent from this checkout."
patterns-established:
  - "Runtime cleanup failures are caught and logged generically while normal request handling continues."
requirements-completed: [UX-01, HARD-04]
duration: 8min
completed: 2026-05-03
---

# Phase 03: Cleanup Compatibility and Hardening Summary

**Share cleanup is wired into Worker cron, Docker cron, and Netlify opportunistic request handling**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-03T09:54:38Z
- **Completed:** 2026-05-03T10:02:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Worker scheduled handler now waits on both scheduled backup and share cleanup.
- Docker daily cron keeps backup behavior and adds share cleanup with count-only logs.
- Netlify handler runs cleanup at most hourly per warm function instance after cached DB initialization and before `app.fetch`.
- Added app source-contract tests for runtime cleanup wiring and privacy-preserving log markers.

## Task Commits

1. **Task 1: Wire Worker and Docker scheduled cleanup** - `341e9fc` (feat)
2. **Task 2: Add Netlify opportunistic cleanup guard** - `341e9fc` (feat)

## Files Created/Modified

- `src/app/worker.ts` - Scheduled backup plus share cleanup in `ctx.waitUntil(Promise.all(...))`.
- `src/app/server.ts` - Daily cron share cleanup beside backup.
- `src/app/netlify.ts` - Hourly opportunistic cleanup guard after DB initialization.
- `src/app/index.test.ts` - Runtime source-contract tests.

## Decisions Made

- Share cleanup is runtime-agnostic through `createShareService`, preserving existing database abstractions.
- Netlify cleanup failure logs only a generic failure and does not alter the response body or block request handling.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `gsd-sdk query verify.key-links` reported false after implementation because one plan regex is malformed and the other helper pattern did not match the multiline source as expected. Direct source-contract tests and plan grep commands passed and are the acceptance evidence.

## Verification

- `npm --prefix backend test -- src/app/index.test.ts` - passed, 12 tests.
- `rg -n "createShareService|cleanupShareState|handleScheduledBackup|cron\\.schedule\\('0 2 \\* \\* \\*'" src/app/worker.ts src/app/server.ts src/app/index.test.ts` - passed.
- `rg -n "SHARE_CLEANUP_INTERVAL_MS|lastShareCleanupAt|cleanupShareState|\\[Share Cleanup\\]" src/app/netlify.ts src/app/index.test.ts` - passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Hardening tests can now assert cleanup behavior across all backend runtime entrypoints while relying on the same service cleanup primitive.

---
*Phase: 03-cleanup-compatibility-and-hardening*
*Completed: 2026-05-03*
