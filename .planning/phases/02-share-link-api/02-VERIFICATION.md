---
phase: 02-share-link-api
verified: 2026-05-02T22:05:21Z
status: gaps_found
score: 13/15 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Owner APIs enforce existing auth, session, CSRF, and ownership protections and cannot manage another owner's item or share."
    status: failed
    reason: "The committed code review's critical CORS finding is confirmed: global `/api/*` CORS reflects any Origin while allowing credentials, so arbitrary origins can read credentialed API responses."
    artifacts:
      - path: "src/app/index.ts"
        issue: "Lines 61-67 configure `origin: (origin) => origin` with `credentials: true`."
      - path: "backend/dist/worker/worker.js"
        issue: "Generated bundle preserves the same credentialed arbitrary-origin CORS behavior."
      - path: "backend/dist/docker/server.js"
        issue: "Generated bundle preserves the same credentialed arbitrary-origin CORS behavior."
      - path: "backend/dist/netlify/api.mjs"
        issue: "Generated bundle preserves the same credentialed arbitrary-origin CORS behavior."
    missing:
      - "Restrict credentialed CORS to configured trusted origins or disable credentials for reflected origins."
      - "Regenerate Worker, Docker, and Netlify bundles after fixing source."
  - truth: "Public share access is protected by the independent access code before shared secret material is processed."
    status: failed
    reason: "The committed review warning is confirmed: `resolveShareAccess()` decrypts the vault secret and generates the OTP before verifying the access code, so wrong-code requests still trigger protected secret processing."
    artifacts:
      - path: "src/features/share/shareService.ts"
        issue: "Lines 268-287 decrypt and generate OTP before lines 290-294 verify the access code and reject wrong-code requests."
      - path: "backend/dist/worker/worker.js"
        issue: "Generated bundle preserves decrypt/generate before `verifyShareSecret`."
      - path: "backend/dist/docker/server.js"
        issue: "Generated bundle preserves decrypt/generate before `verifyShareSecret`."
      - path: "backend/dist/netlify/api.mjs"
        issue: "Generated bundle preserves decrypt/generate before `verifyShareSecret`."
    missing:
      - "Verify `accessCode` immediately after share/vault accessibility checks and before `decryptField()` or `generate()`."
      - "Add a regression test that wrong-code access does not decrypt the vault secret or generate OTP."
      - "Regenerate Worker, Docker, and Netlify bundles after fixing source."
deferred:
  - truth: "MySQL share-link migrations bootstrap cleanly on supported Docker database paths."
    addressed_in: "Phase 3"
    evidence: "Phase 3 success criteria explicitly require share-link schema, repository, and route behavior to pass against supported database/runtime paths; code review WR-02 is therefore a Phase 3 compatibility/hardening item, not a Phase 2 API-goal blocker."
---

# Phase 2: Share Link API Verification Report

**Phase Goal:** Authenticated owners can manage safe, revocable links and friends can retrieve only the shared account login view without a NodeAuth account.
**Verified:** 2026-05-02T22:05:21Z
**Status:** gaps_found
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Owner can create a share link for exactly one allowed vault/account item with bounded expiration and access code by default. | VERIFIED | `createShare()` checks `findActiveByIdForOwner()`, clamps TTL, rejects invalid expiry, generates raw token/code, and stores hashes in `src/features/share/shareService.ts:67`. |
| 2 | Owner receives raw share URL token and access code exactly once, then list/detail/revoke use safe metadata only. | VERIFIED | `createShareForOwner()` adds `rawToken`/`rawAccessCode`; `listSharesForOwner()`, `getShareForOwner()`, and `revokeShareForOwner()` return `OwnerShareMetadataView` without hashes or credential fields. |
| 3 | Owner service methods create, list, inspect, and revoke share links with safe owner metadata only. | VERIFIED | DTOs are allowlisted in `src/features/share/shareTypes.ts:24`; service metadata helper emits item reference, status, timestamps, and count only. |
| 4 | Owner APIs expose create/list/inspect/revoke through `/api/share` endpoints. | VERIFIED | `src/features/share/shareRoutes.ts:12`, `:34`, `:43`, and `:52` define POST/GET/GET id/DELETE routes. |
| 5 | Owner endpoints derive owner identity from authenticated user rather than request body. | VERIFIED | Routes use `user.email || user.id` in `src/features/share/shareRoutes.ts:14`, `:36`, `:45`, and `:54`; route tests cover hostile body ownerId. |
| 6 | Owner APIs enforce existing auth/session/CSRF/ownership protections. | FAILED | Share routes attach `authMiddleware`, but global CORS reflects arbitrary origins with credentials in `src/app/index.ts:61`; this weakens browser-enforced API protection. |
| 7 | Public recipient endpoint is accessible without a NodeAuth session. | VERIFIED | `POST /public/:token/access` has `shareRateLimit()` but no `authMiddleware` in `src/features/share/shareRoutes.ts:61`; tests assert auth middleware is not called. |
| 8 | Public recipient access code is supplied through body/non-URL channel. | VERIFIED | Route reads `body.accessCode` only and tests confirm query `accessCode` is ignored. |
| 9 | Public share access gates shared-secret processing on a valid access code. | FAILED | `resolveShareAccess()` decrypts/generates OTP before `verifyShareSecret()` in `src/features/share/shareService.ts:268-291`. |
| 10 | Recipient receives only minimal `SharedItemView`, with OTP code/countdown when available. | VERIFIED | Returned `itemView` contains service/account and optional `{ code, period, remainingSeconds }`; tests assert no owner IDs, token hashes, seed, otpauth, URLs, or internal share fields. |
| 11 | Public responses use generic inaccessible errors and no-store/no-referrer protections. | VERIFIED | Route and limiter return `{ success: false, message: 'share_inaccessible', data: null }` with headers from `getSharePublicHeaders()`. |
| 12 | Rate-limited or fail-closed public share access returns the same generic envelope and public headers. | VERIFIED | `returnShareInaccessible()` in `src/shared/middleware/shareRateLimitMiddleware.ts:20` handles missing DB, repository errors, and lockouts. |
| 13 | Share routes are mounted under `/api/share` and pass the global health gate. | VERIFIED | `src/app/index.ts:90` applies health gate to `/api/*`; `app.route('/api/share', shareRoutes)` is mounted at line 119 before API fallback. |
| 14 | Global request logging redacts raw public share URL tokens. | VERIFIED | `redactSharePublicToken()` masks `/api/share/public/:token/access` before `logger.info()` in `src/app/index.ts:41` and `:58`. |
| 15 | Worker, Docker, and Netlify backend bundles include the Phase 2 source behavior. | VERIFIED | Generated bundles contain `/api/share`, public access route, headers, `share_inaccessible`, `rawAccessCode`, and `redactSharePublicToken`; source-map verification passed. |

**Score:** 13/15 truths verified

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | MySQL share-link migration uses `TEXT PRIMARY KEY` despite MySQL source schema using `VARCHAR`. | Phase 3 | Phase 3 success criterion 3 covers supported database/runtime paths; review WR-02 should be fixed during compatibility/hardening. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/features/share/shareTypes.ts` | Owner DTO contracts and `SharedItemView` allowlist | VERIFIED | DTO interfaces exist and avoid credential/hash fields. |
| `src/shared/db/repositories/shareRepository.ts` | Owner-scoped list/find/revoke and rate-limit persistence | VERIFIED | `listForOwner()`, `findByIdForOwner()`, `revokeForOwner()`, and `enforceRateLimit()` are substantive. |
| `src/features/share/shareService.ts` | Owner metadata methods and recipient DTO construction | PARTIAL | Substantive and wired, but wrong-code recipient requests process decrypted secret before access-code verification. |
| `src/features/share/shareRoutes.ts` | Hono owner/public share route module | VERIFIED | Owner/public routes are implemented and wired to service and middleware. |
| `src/shared/middleware/shareRateLimitMiddleware.ts` | Fail-closed public share limiter | VERIFIED | Blocking paths return generic envelope and public headers. |
| `src/app/index.ts` | Root mount, logging redaction, global middleware | PARTIAL | Share mount/log redaction verified; credentialed arbitrary-origin CORS is a blocking security gap. |
| `backend/dist/worker/worker.js` | Cloudflare Worker generated backend | PARTIAL | Includes Phase 2 behavior and both blocking source gaps. |
| `backend/dist/docker/server.js` | Docker generated backend | PARTIAL | Includes Phase 2 behavior and both blocking source gaps; also has deferred MySQL migration issue. |
| `backend/dist/netlify/api.mjs` | Netlify generated backend | PARTIAL | Includes Phase 2 behavior and both blocking source gaps; also has deferred MySQL migration issue. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `shareRoutes.ts` | `authMiddleware` | Owner routes attach middleware | VERIFIED | All owner routes include `authMiddleware`; the middleware itself validates cookie JWT, CSRF header/cookie, and DB session. |
| `shareRoutes.ts` | `shareRateLimitMiddleware.ts` | Public route attaches `shareRateLimit()` | VERIFIED | Public route at `src/features/share/shareRoutes.ts:61` uses `shareRateLimit()`. |
| `shareRoutes.ts` | `shareService.ts` | `createShareService(c.env)` | VERIFIED | `getService()` calls `createShareService(c.env)` and all route handlers call service methods. |
| `shareRateLimitMiddleware.ts` | `shareSecurity.ts` | `getSharePublicHeaders()` | VERIFIED | Limiter blocking path uses `getSharePublicHeaders()` before returning. |
| `app/index.ts` | `shareRoutes.ts` | Import and route mount | VERIFIED | `shareRoutes` imported at line 17 and mounted at line 119. |
| `app/index.ts` | generated bundles | Rebuilt backend outputs | VERIFIED | Bundle markers and source-map verification passed for Worker, Docker, and Netlify. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `shareRoutes.ts` owner create | `share` response | `createShareForOwner()` -> `createShare()` -> `ShareRepository.createShareLink()` | Yes | VERIFIED |
| `shareRoutes.ts` owner list/detail/revoke | `shares` / `share` response | Owner route user -> service owner methods -> owner-scoped repository calls | Yes | VERIFIED |
| `shareRoutes.ts` public access | `decision.itemView` | Body `accessCode` + path token -> `resolveShareAccess()` -> token hash lookup -> vault item lookup | Partial | HOLLOW SECURITY ORDER - real data flows, but secret processing happens before access-code verification. |
| `app/index.ts` logging | request log string | Hono logger callback -> `redactSharePublicToken()` -> centralized logger | Yes | VERIFIED |
| generated bundles | route/runtime behavior | `src/**` source maps and rebuilt outputs | Yes | VERIFIED with source-map check |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Focused Phase 2 tests pass | `npm --prefix backend test -- src/features/share/shareService.test.ts src/features/share/shareRoutes.test.ts src/shared/middleware/shareRateLimitMiddleware.test.ts src/app/index.test.ts` | 4 files, 34 tests passed | PASS |
| Source maps align with restored source | `node scripts/restore_backend_source_from_sourcemaps.js --verify` | Passed | PASS |
| Share schema alignment script passes | `node scripts/validate_share_schema_alignment.js` | Passed | PASS |
| Full backend tests | Orchestrator already ran `npm --prefix backend test` | 5 files, 40 tests passed | PASS |
| Schema drift | Orchestrator already ran `gsd-sdk query verify.schema-drift "02"` | `drift_detected=false` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| OWN-01 | 02-01, 02-02, 02-04 | Owner can create one allowed item share link. | SATISFIED | Owner create route and service use authenticated owner and `findActiveByIdForOwner()`. |
| OWN-02 | 02-01, 02-02, 02-04 | Expiration bounded and access code required by default. | SATISFIED | `clampShareTtlSeconds()`, expiry validation, and generated access code are in source. |
| OWN-03 | 02-01, 02-02, 02-04 | Raw token/code returned exactly once. | SATISFIED | Raw values only in create result/created view; list/detail/revoke redaction tests pass. |
| OWN-04 | 02-01, 02-02, 02-04 | Owner can list safe metadata. | SATISFIED | `listSharesForOwner()` and `GET /api/share` return safe metadata with status and counts. |
| OWN-05 | 02-01, 02-02, 02-04 | Owner can inspect without secrets. | SATISFIED | `getShareForOwner()` and route tests return safe metadata only. |
| OWN-06 | 02-01, 02-02, 02-04 | Owner can revoke and revoked links stop working. | SATISFIED | `revokeShareForOwner()`, `revokeForOwner()`, and public revoked decision exist. |
| OWN-07 | 02-02, 02-03, 02-04 | Owner APIs enforce auth/session/CSRF/ownership. | BLOCKED | Route auth and owner scoping exist, but credentialed arbitrary-origin CORS weakens browser API protection. |
| REC-01 | 02-02, 02-03, 02-04 | Friend can open public link without account. | SATISFIED | Public route has no auth middleware. |
| REC-02 | 02-02, 02-04 | Access requires independent code through non-URL channel. | BLOCKED | Route reads body code only, but service decrypts/generates OTP before verifying the code. |
| REC-03 | 02-01, 02-02, 02-04 | Recipient receives minimal `SharedItemView`. | SATISFIED | Public success DTO is service/account/password optional and OTP object only; tests assert forbidden fields absent. |
| REC-04 | 02-01, 02-02, 02-04 | Current TOTP code/countdown when TOTP exists, no seed. | SATISFIED | OTP generation and redaction tests pass; ordering problem tracked under REC-02. |
| REC-05 | 02-02, 02-03, 02-04 | Generic inaccessible errors. | SATISFIED | Missing, expired, revoked, deleted, wrong-code, locked, and fail-closed paths use generic response. |
| REC-06 | 02-02, 02-03, 02-04 | No-store/no-referrer and no query/log leakage. | SATISFIED | Headers and log token redaction are implemented and tested. |
| UX-02 | 02-01, 02-02, 02-04 | Safe owner status info for future UI. | SATISFIED | Owner metadata includes active/expired/revoked status, created/expires/revoked/lastAccessed, and accessCount. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `src/app/index.ts` | 61 | Credentialed CORS reflects arbitrary origin | BLOCKER | Arbitrary websites can make and read credentialed API requests in browsers. |
| `src/features/share/shareService.ts` | 268 | Secret decrypt/OTP generation before access-code verification | BLOCKER | Wrong-code requests still process protected secret material. |
| `src/shared/db/migrator.ts` | 359 | MySQL migration uses `TEXT PRIMARY KEY` for share tables | WARNING | Likely fresh MySQL bootstrap problem; deferred to Phase 3 compatibility/hardening. |

### Human Verification Required

None for phase-goal verification. The blocking gaps are code-level and reproducible by inspection; automated tests otherwise pass.

### Gaps Summary

Phase 2 delivered the expected share API surface, owner-safe DTOs, public recipient route, generic public errors, no-store/no-referrer headers, log redaction, and regenerated backend bundles. However, the phase goal is not achieved yet because two security conditions fail: global credentialed CORS allows arbitrary-origin reads of authenticated API responses, and public share access processes decrypted OTP material before the access code passes.

The code review's MySQL migration warning is valid, but it is not counted as a Phase 2 blocker because Phase 3 explicitly owns supported database/runtime compatibility validation.

---

_Verified: 2026-05-02T22:05:21Z_
_Verifier: Claude (gsd-verifier)_
