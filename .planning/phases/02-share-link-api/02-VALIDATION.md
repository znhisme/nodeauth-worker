---
phase: 02
slug: share-link-api
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-03
updated: 2026-05-03
---

# Phase 02 — Validation Strategy

> Reconstructed Nyquist validation contract for completed Phase 02.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 |
| **Config file** | `backend/vitest.config.ts` |
| **Quick run command** | `npm --prefix backend test -- src/features/share/shareSecurity.test.ts src/features/share/shareService.test.ts src/features/share/shareRoutes.test.ts src/shared/middleware/shareRateLimitMiddleware.test.ts src/app/index.test.ts` |
| **Full suite command** | `npm --prefix backend test` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run focused tests for the touched module.
- **After every plan wave:** Run `npm --prefix backend test`.
- **Before `$gsd-verify-work`:** Full suite, schema alignment, source-map verification, and generated bundle assertions must be green.
- **Max feedback latency:** 30 seconds for source tests; generated bundle rebuild checks are allowed to run longer.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | OWN-01, OWN-02, OWN-03, OWN-04, OWN-05, OWN-06, UX-02 | T-02-01-01, T-02-01-02, T-02-01-04, T-02-01-05 | Owner-safe DTOs, owner-scoped repository methods, one-time raw token/code return, safe list/detail/revoke metadata, and revoke audit behavior. | unit | `npm --prefix backend test -- src/features/share/shareService.test.ts` | yes | green |
| 02-01-02 | 01 | 1 | REC-03, REC-04 | T-02-01-03 | Recipient `SharedItemView` includes only service/account and optional OTP code/countdown, never raw seed or otpauth data. | unit | `npm --prefix backend test -- src/features/share/shareService.test.ts` | yes | green |
| 02-02-01 | 02 | 2 | OWN-01, OWN-02, OWN-03, OWN-04, OWN-05, OWN-06, OWN-07, UX-02 | T-02-02-01, T-02-02-06 | Owner routes require auth, derive owner identity from session user, reject request-body owner spoofing, and serialize safe metadata. | route unit | `npm --prefix backend test -- src/features/share/shareRoutes.test.ts` | yes | green |
| 02-02-02 | 02 | 2 | REC-01, REC-02, REC-03, REC-04, REC-05, REC-06 | T-02-02-02, T-02-02-03, T-02-02-04, T-02-02-05 | Public recipient route is unauthenticated, body-code only, rate-limited fail-closed, generic on denial, and applies no-store/no-referrer headers. | route and middleware unit | `npm --prefix backend test -- src/features/share/shareRoutes.test.ts src/shared/middleware/shareRateLimitMiddleware.test.ts` | yes | green |
| 02-03-01 | 03 | 3 | REC-06 | T-02-03-01 | Global request logging redacts raw public share tokens before centralized logging. | unit/source contract | `npm --prefix backend test -- src/app/index.test.ts` | yes | green |
| 02-03-02 | 03 | 3 | OWN-07, REC-01, REC-05, REC-06 | T-02-03-02, T-02-03-03, T-02-03-04 | Root app mounts `/api/share` before API fallback and does not exempt share APIs from the global health gate. | unit/source contract | `npm --prefix backend test -- src/app/index.test.ts src/features/share/shareRoutes.test.ts` | yes | green |
| 02-04-01 | 04 | 4 | OWN-01, OWN-02, OWN-03, OWN-04, OWN-05, OWN-06, OWN-07, REC-01, REC-02, REC-03, REC-04, REC-05, REC-06, UX-02 | T-02-04-02, T-02-04-04 | Source-level Phase 2 behavior and share schema alignment pass before distribution bundles are refreshed. | integration command | `npm --prefix backend test && node scripts/validate_share_schema_alignment.js` | yes | green |
| 02-04-02 | 04 | 4 | OWN-07, REC-01, REC-05, REC-06 | T-02-04-01, T-02-04-02, T-02-04-03 | Worker, Docker, and Netlify bundles contain mounted share APIs, public privacy headers, generic inaccessible handling, and source-map verified generated output. | generated bundle assertion | `node scripts/restore_backend_source_from_sourcemaps.js --verify` | yes | green |
| 02-05-01 | 05 | 5 | OWN-07 | T-02-05-01, T-02-05-02 | Credentialed `/api/*` CORS allows only configured trusted origins and never reflects arbitrary origins. | unit/source contract | `npm --prefix backend test -- src/app/index.test.ts` | yes | green |
| 02-05-02 | 05 | 5 | REC-02, REC-03, REC-04, REC-05, REC-06 | T-02-05-03, T-02-05-04 | Wrong-code public share access rejects before `decryptField()` or OTP `generate()` and records no successful access audit. | unit/order assertion | `npm --prefix backend test -- src/features/share/shareService.test.ts` | yes | green |
| 02-06-01 | 06 | 6 | OWN-07, REC-02, REC-03, REC-04, REC-05, REC-06 | T-02-06-01, T-02-06-02, T-02-06-03, T-02-06-04 | Source fixes are proven before regenerated backend bundles are refreshed. | integration command | `npm --prefix backend test -- src/app/index.test.ts src/features/share/shareService.test.ts && node scripts/validate_share_schema_alignment.js` | yes | green |
| 02-06-02 | 06 | 6 | OWN-07, REC-01, REC-05, REC-06 | T-02-06-01, T-02-06-02, T-02-06-04 | Worker, Docker, and Netlify bundles are rebuilt from source and retain share route/privacy markers. | generated bundle assertion | `npm --prefix backend run build:worker && npm --prefix backend run build:docker && npm --prefix backend run build:netlify && node scripts/restore_backend_source_from_sourcemaps.js --verify` | yes | green |
| 02-06-03 | 06 | 6 | OWN-07, REC-02, REC-03, REC-04, REC-05, REC-06 | T-02-06-02, T-02-06-03 | Every generated backend target uses trusted-origin CORS and verifies access code before secret decryption or OTP generation. | generated bundle assertion | `node -e "<generated bundle security assertion>"` | yes | green |

*Status: pending · green · red · flaky*

---

## Requirement Coverage

| Requirement | Coverage Status | Primary Automated Evidence |
|-------------|-----------------|----------------------------|
| OWN-01 | COVERED | `src/features/share/shareService.test.ts`, `src/features/share/shareRoutes.test.ts` |
| OWN-02 | COVERED | `src/features/share/shareService.test.ts`, `src/features/share/shareSecurity.test.ts` |
| OWN-03 | COVERED | `src/features/share/shareService.test.ts`, `src/features/share/shareRoutes.test.ts` |
| OWN-04 | COVERED | `src/features/share/shareService.test.ts`, `src/features/share/shareRoutes.test.ts` |
| OWN-05 | COVERED | `src/features/share/shareService.test.ts`, `src/features/share/shareRoutes.test.ts` |
| OWN-06 | COVERED | `src/features/share/shareService.test.ts`, `src/features/share/shareRoutes.test.ts` |
| OWN-07 | COVERED | `src/features/share/shareRoutes.test.ts`, `src/app/index.test.ts`, generated bundle assertions |
| REC-01 | COVERED | `src/features/share/shareRoutes.test.ts` |
| REC-02 | COVERED | `src/features/share/shareRoutes.test.ts`, `src/features/share/shareService.test.ts` |
| REC-03 | COVERED | `src/features/share/shareService.test.ts`, `src/features/share/shareRoutes.test.ts` |
| REC-04 | COVERED | `src/features/share/shareService.test.ts` |
| REC-05 | COVERED | `src/features/share/shareService.test.ts`, `src/features/share/shareRoutes.test.ts`, `src/shared/middleware/shareRateLimitMiddleware.test.ts` |
| REC-06 | COVERED | `src/features/share/shareRoutes.test.ts`, `src/shared/middleware/shareRateLimitMiddleware.test.ts`, `src/app/index.test.ts` |
| UX-02 | COVERED | `src/features/share/shareService.test.ts`, `src/features/share/shareRoutes.test.ts` |

---

## Validation Audit 2026-05-03

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

### Commands Run

| Command | Result |
|---------|--------|
| `npm --prefix backend test -- src/features/share/shareSecurity.test.ts src/features/share/shareService.test.ts src/features/share/shareRoutes.test.ts src/shared/middleware/shareRateLimitMiddleware.test.ts src/app/index.test.ts` | PASS, 5 files and 48 tests |
| `npm --prefix backend test` | PASS, 5 files and 48 tests |
| `node scripts/validate_share_schema_alignment.js` | PASS |
| `node scripts/restore_backend_source_from_sourcemaps.js --verify` | PASS |
| `node -e "<source resolveShareAccess order assertion>"` | PASS |
| `node -e "<generated bundle security assertion>"` | PASS |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Residual Risk

The Phase 02 verification report records MySQL indexed-`TEXT` migration compatibility as deferred Phase 3 debt. It is not a Phase 02 API validation gap because Phase 3 explicitly owns supported database/runtime path hardening.

---

## Validation Sign-Off

- [x] All tasks have automated verification or generated-output assertions.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency < 30 seconds for source-level checks.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-05-03
