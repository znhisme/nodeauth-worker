---
phase: 03-cleanup-compatibility-and-hardening
plan: 11
subsystem: build
tags: [share-links, mysql, backend-builds, source-maps, generated-artifacts]
requires:
  - phase: 03-cleanup-compatibility-and-hardening
    provides: Plan 03-10 MySQL source schema and validator fixes
provides:
  - Regenerated Worker backend bundle with widened MySQL share DDL
  - Regenerated Docker backend bundle with widened MySQL share DDL
  - Regenerated Netlify backend bundle with widened MySQL share DDL
  - Regenerated Docker backend bundle with MySQL schema.sql share preload guard
  - Final generated-output checks for public share privacy/security markers
affects: [worker-runtime, docker-runtime, netlify-runtime, share-links, mysql-schema]
tech-stack:
  added: []
  patterns: [Generated backend bundles rebuilt only through backend build scripts, source-map verification after rebuild]
key-files:
  created:
    - .planning/phases/03-cleanup-compatibility-and-hardening/03-11-SUMMARY.md
  modified:
    - backend/dist/worker/worker.js
    - backend/dist/worker/worker.js.map
    - backend/dist/docker/server.js
    - backend/dist/docker/server.js.map
    - backend/dist/netlify/api.mjs
    - backend/dist/netlify/api.mjs.map
key-decisions:
  - "Regenerate Worker, Docker, and Netlify bundles only through the existing backend build scripts."
  - "Leave .planning/source-provenance.md unchanged because source-map verification passed after regeneration."
patterns-established:
  - "Generated bundle acceptance must include positive compatibility/security markers and negative legacy-width assertions."
requirements-completed: [HARD-01, HARD-04]
duration: 5min
completed: 2026-05-03
---

# Phase 03 Plan 11: MySQL Bundle Regeneration Summary

**Worker, Docker, and Netlify bundles now carry the MySQL share schema fixes and pass final runtime marker gates**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-03T21:51:28+08:00
- **Completed:** 2026-05-03T21:53:41+08:00
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Ran full backend tests before and after bundle regeneration.
- Rebuilt Worker, Docker, and Netlify backend outputs through `build:worker`, `build:docker`, and `build:netlify`.
- Rebuilt Docker output after adding the MySQL `schema.sql` share preload guard.
- Verified schema alignment after rebuild.
- Verified source maps against restored source after rebuild.
- Confirmed generated bundles contain `VARCHAR(64)`, `VARCHAR(255)`, `share_inaccessible`, `Cache-Control`, and `Referrer-Policy`.
- Confirmed generated bundles no longer contain legacy `VARCHAR(36)` share/audit ID definitions.

## Task Commits

Pending commit in current working tree.

## Files Created/Modified

- `backend/dist/worker/worker.js` and `backend/dist/worker/worker.js.map` - Regenerated Worker bundle and source map.
- `backend/dist/docker/server.js` and `backend/dist/docker/server.js.map` - Regenerated Docker bundle and source map.
- `backend/dist/netlify/api.mjs` and `backend/dist/netlify/api.mjs.map` - Regenerated Netlify bundle and source map.

## Decisions Made

- Did not hand-edit generated bundles.
- Did not refresh `.planning/source-provenance.md` because `node scripts/restore_backend_source_from_sourcemaps.js --verify` passed after regeneration.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first negative legacy-width assertion used shell double quotes and backticks in inline JavaScript, which caused shell command substitution. The same assertion passed after rerunning with safe single-quoted JavaScript.

## Verification

- `npm --prefix backend test` - passed, 7 files / 87 tests.
- `node scripts/validate_share_schema_alignment.js` - passed.
- `npm --prefix backend run build:worker` - passed.
- `npm --prefix backend run build:docker` - passed.
- `npm --prefix backend run build:netlify` - passed.
- `node scripts/restore_backend_source_from_sourcemaps.js --verify` - passed.
- `rg -n "share_links|VARCHAR\\(64\\)|share_audit_events|VARCHAR\\(255\\)|share_inaccessible|Cache-Control|Referrer-Policy" backend/dist/worker/worker.js backend/dist/docker/server.js backend/dist/netlify/api.mjs` - passed.
- Generated assertion for `isShareSchemaStatement` in Docker bundle - passed.
- Negative legacy-width generated bundle assertion - passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03-11 closes the final generated-artifact side of the Phase 03 MySQL compatibility gaps. Phase 03 has no remaining incomplete plans.

## Self-Check: PASSED

- Confirmed summary file exists.
- Confirmed full tests, validator, source-map verification, and generated marker checks pass.
- Confirmed no generated bundle still contains legacy MySQL share/audit `VARCHAR(36)` definitions.

---
*Phase: 03-cleanup-compatibility-and-hardening*
*Completed: 2026-05-03*
