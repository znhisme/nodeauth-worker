---
phase: 05
slug: api-token-api-api-token
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-04
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for API-token account import execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `backend/vitest.config.ts` |
| **Quick run command** | `npm --prefix backend test -- src/shared/middleware/auth.test.ts src/features/vault/vaultRoutes.test.ts` |
| **Full suite command** | `npm --prefix backend test` |
| **Estimated runtime** | ~30 seconds for targeted tests; ~2 minutes for full suite |

---

## Sampling Rate

- **After every task commit:** Run `npm --prefix backend test -- src/shared/middleware/auth.test.ts src/features/vault/vaultRoutes.test.ts`
- **After every plan wave:** Run `npm --prefix backend test`
- **Before `$gsd-verify-work`:** Full suite and all backend runtime builds must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | API token auth | T5-01 / T5-02 | Bearer token validates JWT and active session without disabling cookie CSRF | unit | `npm --prefix backend test -- src/shared/middleware/auth.test.ts` | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | API import reuse | T5-03 / T5-04 | Bearer import reaches existing `VaultService.importAccounts()` and returns aggregate-only result | route | `npm --prefix backend test -- src/features/vault/vaultRoutes.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | Runtime compatibility | T5-05 | Worker, Docker, and Netlify bundles include source changes generated from `src/**` | build | `npm --prefix backend run build:worker && npm --prefix backend run build:docker && npm --prefix backend run build:netlify` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/shared/middleware/auth.test.ts` — stubs and fixtures for cookie vs Bearer auth middleware behavior.
- [ ] `src/features/vault/vaultRoutes.test.ts` — route-level import test fixtures for Bearer-authenticated import.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real external automation token import | API token auth | Requires a live logged-in token from an operator environment | Use a valid `auth_token` JWT as `Authorization: Bearer <token>` and POST `{"type":"text","content":"otpauth://totp/OpenAI:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=OpenAI"}` to `/api/vault/import`; expect `success: true` and no returned secret. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-04
