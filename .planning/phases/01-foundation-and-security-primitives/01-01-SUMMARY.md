---
phase: 01-foundation-and-security-primitives
plan: 01
subsystem: infra
tags: [typescript, tsup, source-maps, cloudflare-workers, docker, netlify]
requires: []
provides:
  - Restored editable backend TypeScript source under src/**
  - Source provenance record for backend source restoration and frontend-source absence
  - Reproducible backend build scripts for Worker, Docker, and Netlify outputs
  - Backend package lockfile and locked CI/container install commands
affects: [phase-01, share-link-api, backend-builds]
tech-stack:
  added: [tsconfig, backend-package-lock, tsup-build-scripts]
  patterns: [source-map restoration, generated-bundle regeneration]
key-files:
  created: [scripts/restore_backend_source_from_sourcemaps.js, tsconfig.json, backend/package-lock.json, backend/scripts/build-worker.js, backend/scripts/build-docker.js, backend/scripts/build-netlify.js]
  modified: [.planning/source-provenance.md, Dockerfile, netlify.toml, backend/dist/worker/worker.js, backend/dist/docker/server.js, backend/dist/netlify/api.mjs]
key-decisions:
  - "Use restored src/** as the primary backend implementation surface; backend/dist/** is regenerated output."
  - "Keep Phase 1 API-only because editable frontend source is absent and only frontend/dist/** is present."
  - "Use npm ci for backend dependency installation wherever the backend lockfile is available."
patterns-established:
  - "Build scripts run from backend/ and bundle ../src/app entrypoints with tsup."
  - "Source maps are normalized back to ../../src/** so restoration remains repeatable after builds."
requirements-completed: [FND-01, FND-02, UX-04]
duration: 14min
completed: 2026-05-02
---

# Phase 01 Plan 01: Source and Build Provenance Summary

**Restored backend TypeScript source with repeatable source-map provenance and reproducible Worker, Docker, and Netlify backend builds**

## Performance

- **Duration:** 14 min
- **Started:** 2026-05-02T13:21:30Z
- **Completed:** 2026-05-02T13:35:45Z
- **Tasks:** 2
- **Files modified:** 88

## Accomplishments

- Restored editable backend source under `src/**` from checked-in source maps and documented frontend source absence in `.planning/source-provenance.md`.
- Added `tsconfig.json`, backend build scripts, and `backend/package-lock.json`.
- Switched Docker and Netlify backend installs to `npm ci`.
- Regenerated Worker, Docker, and Netlify backend bundles from source.

## Task Commits

Each task was committed atomically:

1. **Task 1: Restore editable backend source and record provenance** - `41cf9f3` (feat)
2. **Task 2: Restore backend build scripts and reproducible backend install path** - `eb1f9a0` (chore)

## Files Created/Modified

- `scripts/restore_backend_source_from_sourcemaps.js` - Restores and verifies backend source from source maps.
- `.planning/source-provenance.md` - Records source-map provenance and API-only frontend scope.
- `src/**` - Restored backend TypeScript source and build-critical missing contracts.
- `tsconfig.json` - Root TypeScript config with `@/*` alias.
- `backend/scripts/build-*.js` - tsup build scripts for all backend targets.
- `backend/package-lock.json` - Locked backend dependency graph.
- `Dockerfile` and `netlify.toml` - Locked backend install commands.
- `backend/dist/**` - Regenerated backend distribution outputs.

## Decisions Made

- Generated bundles are not primary implementation files; future share-link work should edit `src/**` and rebuild.
- The checkout has no editable frontend source, so UX-04 is satisfied here by documenting API-only Phase 1 scope.
- Build scripts normalize source-map paths to `../../src/**` so the restore verifier remains stable after generated bundle refreshes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added CommonJS package marker for backend build scripts**
- **Found during:** Task 2 (Restore backend build scripts and reproducible backend install path)
- **Issue:** `backend/package.json` declares `"type": "module"`, so CommonJS `.js` build scripts using `require(...)` would be interpreted as ESM.
- **Fix:** Added `backend/scripts/package.json` with `"type": "commonjs"`.
- **Files modified:** `backend/scripts/package.json`
- **Verification:** `npm --prefix backend run build:worker`, `build:docker`, and `build:netlify` all passed.
- **Committed in:** `eb1f9a0`

**2. [Rule 3 - Blocking] Restored missing type-only source contracts needed for builds**
- **Found during:** Task 2 (Restore backend build scripts and reproducible backend install path)
- **Issue:** Restored source imported `@/shared/db/executor` and `@/features/backup/providers`, but type-only/barrel files were not present in the original source-map extraction.
- **Fix:** Added minimal `DbExecutor`/`DbEngine`, backup provider contract, and provider barrel files; build scripts append these type-only sources to generated source maps so restoration remains complete.
- **Files modified:** `src/shared/db/executor.ts`, `src/features/backup/providers/backupProvider.ts`, `src/features/backup/providers/index.ts`, `backend/scripts/build-*.js`
- **Verification:** Source restoration now reports 71 files and `node scripts/restore_backend_source_from_sourcemaps.js --verify` passes after builds.
- **Committed in:** `eb1f9a0`

---

**Total deviations:** 2 auto-fixed (2 Rule 3 blocking issues)
**Impact on plan:** Both fixes were required to make the planned build pipeline executable from restored source; no share-link feature scope was added.

## Issues Encountered

The first Docker build failed on the Worker-only `cloudflare:sockets` dynamic import. The build scripts now mark it external for all backend targets, matching Netlify's existing external module configuration.

## Known Stubs

None introduced by this plan. Stub-pattern scan found existing restored-source initialization defaults and empty arrays used by runtime logic, not unfinished placeholders for this plan.

## User Setup Required

None - no external service configuration required.

## Verification

Passed:

- `node scripts/restore_backend_source_from_sourcemaps.js --verify`
- `npm ci --prefix backend`
- `npm --prefix backend run build:worker`
- `npm --prefix backend run build:docker`
- `npm --prefix backend run build:netlify`

## Next Phase Readiness

Phase 01 plan 02 can now build share-link security primitives in editable backend source without hand-patching generated bundles. Remaining Phase 1 work still needs the security contract, share-link schema/service primitives, and validation coverage.

## Self-Check: PASSED

- Created files exist.
- Task commits `41cf9f3` and `eb1f9a0` exist.
- Plan verification commands passed.

---
*Phase: 01-foundation-and-security-primitives*
*Completed: 2026-05-02*
