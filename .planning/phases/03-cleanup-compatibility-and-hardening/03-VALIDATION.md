---
phase: 3
slug: cleanup-compatibility-and-hardening
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-03
---

# Phase 3 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x |
| **Config file** | `backend/vitest.config.ts` |
| **Quick run command** | `npm --prefix backend test -- src/features/share/shareService.test.ts src/features/share/shareRoutes.test.ts src/shared/middleware/shareRateLimitMiddleware.test.ts src/app/index.test.ts` |
| **Full suite command** | `npm --prefix backend test` |
| **Estimated runtime** | ~10 seconds for focused tests; ~15 seconds for full backend suite |

---

## Sampling Rate

- **After every task commit:** Run the focused test file for the module touched by the task; for schema/migration edits also run `node scripts/validate_share_schema_alignment.js`.
- **After every plan wave:** Run `npm --prefix backend test`.
- **Before `$gsd-verify-work`:** Run `npm --prefix backend test`, `node scripts/validate_share_schema_alignment.js`, all three backend builds, and source-map verification.
- **Max feedback latency:** 15 seconds for normal backend tests; build-only gates may exceed this and should run at wave or phase boundaries.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | UX-01 | T3-01 | Expired share cleanup and stale share rate-limit cleanup are idempotent and log counts only. | unit/repository/runtime source contract | `npm --prefix backend test -- src/features/share/shareService.test.ts src/shared/db/repositories/shareRepository.test.ts` | Partial: repository test missing | pending |
| 03-02-01 | 02 | 1 | UX-03 | T3-02 | Docs and API contract state that revocation stops future access only and cannot retract copied credentials. | docs grep | `rg -n "cannot retract|already copied|future access" docs .planning src` | Partial | pending |
| 03-03-01 | 03 | 1 | HARD-01 | T3-03 | Share schema, migration SQL, repository, and route behavior stay compatible across available runtime paths. | schema/build/conditional DB smoke | `node scripts/validate_share_schema_alignment.js && npm --prefix backend run build:worker && npm --prefix backend run build:docker && npm --prefix backend run build:netlify` | Yes | pending |
| 03-04-01 | 04 | 2 | HARD-02 | T3-04 | Expired, revoked, wrong-code, locked, deleted-item, wrong-owner, and token-enumeration states remain generic and access-controlled. | unit/route/middleware | `npm --prefix backend test -- src/features/share/shareService.test.ts src/features/share/shareRoutes.test.ts src/shared/middleware/shareRateLimitMiddleware.test.ts` | Partial | pending |
| 03-05-01 | 05 | 2 | HARD-03 | T3-05 | Public share responses use exact allowlists, secure headers, generic errors, and log redaction. | route/middleware/app | `npm --prefix backend test -- src/features/share/shareRoutes.test.ts src/shared/middleware/shareRateLimitMiddleware.test.ts src/app/index.test.ts` | Partial | pending |
| 03-06-01 | 06 | 3 | HARD-04 | T3-06 | Auth, vault, backup, health, scheduled handlers, and generated deployment bundles do not regress. | full suite/source-map/generated assertions | `npm --prefix backend test && node scripts/restore_backend_source_from_sourcemaps.js --verify` | Partial | pending |

---

## Wave 0 Requirements

- [ ] `src/shared/db/repositories/shareRepository.test.ts` - cleanup repository coverage for expired shares and stale limiter rows.
- [ ] `scripts/validate_share_schema_alignment.js` - MySQL share migration check for indexed `TEXT` column regressions.
- [ ] `src/features/share/shareService.test.ts` - explicit repeated-expired cleanup, token-enumeration, and allowlist cases.
- [ ] `src/app/index.test.ts` or a focused runtime source-contract test - backup cron, Worker scheduled handler, Netlify opportunistic cleanup, route health gate, and generated marker coverage.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live MySQL and PostgreSQL runtime migrations | HARD-01 | Local CLI availability is not guaranteed in this checkout. | If Docker is available, run the MySQL and PostgreSQL compose variants after the MySQL migration fix and capture whether startup/migration succeeds. |
| Netlify scheduled-function decision | UX-01 | Research leaves this as a design choice unless the build script can cleanly emit a scheduled function. | Verify the chosen plan either implements a scheduled Netlify function or documents and tests the opportunistic cleanup fallback. |

---

## Validation Sign-Off

- [x] All tasks have automated verification candidates.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing references from research.
- [x] No watch-mode flags.
- [x] Feedback latency target is defined.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-05-03
