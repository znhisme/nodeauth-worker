---
phase: 02
slug: share-link-api
status: verified
threats_open: 0
asvs_level: not configured
created: 2026-05-03
---

# Phase 02 - Security Verification

**Phase:** 02 - share-link-api  
**Verified:** 2026-05-03  
**ASVS Level:** not configured  
**Block On:** open threats unless explicitly accepted  
**Threats Open:** 0  
**Threats Closed:** 27/27

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|---|---|---:|---|---|
| T-02-01-01 | Elevation of Privilege | mitigate | CLOSED | `src/shared/db/repositories/shareRepository.ts:31` and `:40` filter owner reads by `ownerId`; routes derive owner context at `src/features/share/shareRoutes.ts:14`. |
| T-02-01-02 | Information Disclosure | mitigate | CLOSED | Owner DTO serializer allowlists fields in `src/features/share/shareService.ts:49`; create-only raw token/code are added at `:149`. Redaction tests cover forbidden fields in `src/features/share/shareService.test.ts:187`. |
| T-02-01-03 | Information Disclosure | mitigate | CLOSED | `resolveShareAccess()` verifies code before secret processing, decrypts only in memory, and returns only OTP code/period/remainingSeconds at `src/features/share/shareService.ts:269`, `:274`, and `:277`. Tests assert seed/otpauth absence at `src/features/share/shareService.test.ts:385`. |
| T-02-01-04 | Tampering | mitigate | CLOSED | `revokeShareForOwner()` performs owner-scoped read and calls `revokeForOwner(shareId, ownerId, now)` at `src/features/share/shareService.ts:186` and `:197`; repository update is owner-scoped at `src/shared/db/repositories/shareRepository.ts:48`. |
| T-02-01-05 | Repudiation | mitigate | CLOSED | Audit events are written for created/revoked/expired/access_granted at `src/features/share/shareService.ts:108`, `:216`, `:245`, and `:296`; tests assert safe audit metadata at `src/features/share/shareService.test.ts:390`. |
| T-02-02-01 | Elevation of Privilege | mitigate | CLOSED | Owner routes attach `authMiddleware` and derive `ownerId = user.email || user.id` at `src/features/share/shareRoutes.ts:12`, `:34`, `:43`, and `:52`. |
| T-02-02-02 | Spoofing | mitigate | CLOSED | Public route reads only JSON body `accessCode` at `src/features/share/shareRoutes.ts:63`; route test proves query accessCode is ignored at `src/features/share/shareRoutes.test.ts:253`. |
| T-02-02-03 | Denial of Service | mitigate | CLOSED | Public route attaches `shareRateLimit()` before handler execution at `src/features/share/shareRoutes.ts:61`; middleware enforces durable limits at `src/shared/middleware/shareRateLimitMiddleware.ts:49`. |
| T-02-02-04 | Information Disclosure | mitigate | CLOSED | Public route returns generic 404 envelope at `src/features/share/shareRoutes.ts:76`; middleware blocking path uses the same envelope at `src/shared/middleware/shareRateLimitMiddleware.ts:20`. |
| T-02-02-05 | Information Disclosure | mitigate | CLOSED | Public route applies decision/public headers at `src/features/share/shareRoutes.ts:72`; middleware blocking path applies `getSharePublicHeaders()` at `src/shared/middleware/shareRateLimitMiddleware.ts:20`; header source is `src/features/share/shareSecurity.ts:132`. |
| T-02-02-06 | Information Disclosure | mitigate | CLOSED | Owner route responses use service DTOs at `src/features/share/shareRoutes.ts:23`, `:38`, `:47`, and `:56`; route tests reject hashes/session/credential fields at `src/features/share/shareRoutes.test.ts:77`. |
| T-02-03-01 | Information Disclosure | mitigate | CLOSED | `redactSharePublicToken()` masks `/api/share/public/:token/access` at `src/app/index.ts:41`; logger uses the redacted value at `src/app/index.ts:91`. |
| T-02-03-02 | Tampering | mitigate | CLOSED | Share routes mount before API fallback at `src/app/index.ts:152`; fallback remains later at `src/app/index.ts:160`. |
| T-02-03-03 | Denial of Service | mitigate | CLOSED | Global `/api/*` health gate runs before route mounting at `src/app/index.ts:123`; no `/api/share` exemption appears in the bypass condition at `src/app/index.ts:126`. |
| T-02-03-04 | Information Disclosure | accept | CLOSED | Accepted risk is documented in `.planning/phases/02-share-link-api/02-03-PLAN.md:161`; generic API fallback is present at `src/app/index.ts:160`. |
| T-02-04-01 | Tampering | mitigate | CLOSED | 02-04 summary records generated bundles rebuilt through `npm --prefix backend run build:*` in `.planning/phases/02-share-link-api/02-04-SUMMARY.md`; git history shows build commit `6912ff5`. |
| T-02-04-02 | Information Disclosure | mitigate | CLOSED | Generated bundles contain `share_inaccessible`, public headers, and redaction markers at `backend/dist/worker/worker.js:7623`, `:7328`, `:8132`; Docker/Netlify markers verified by targeted grep. |
| T-02-04-03 | Denial of Service | mitigate | CLOSED | `node scripts/restore_backend_source_from_sourcemaps.js --verify` exited 0 during this audit; verification script is `scripts/restore_backend_source_from_sourcemaps.js:111`. |
| T-02-04-04 | Tampering | mitigate | CLOSED | `node scripts/validate_share_schema_alignment.js` exited 0 during this audit; required schema/bundle marker checks are in `scripts/validate_share_schema_alignment.js:8`. |
| T-02-05-01 | Information Disclosure | mitigate | CLOSED | `resolveApiCorsOrigin()` exact-match allowlist is implemented at `src/app/index.ts:61`; CORS middleware uses it with credentials at `src/app/index.ts:95`; tests reject arbitrary/wildcard origins at `src/app/index.test.ts:30`. |
| T-02-05-02 | Elevation of Privilege | mitigate | CLOSED | Owner routes preserve `authMiddleware` and owner-scoped service calls at `src/features/share/shareRoutes.ts:12`; `authMiddleware` enforces cookie, CSRF, JWT, and session validation at `src/shared/middleware/auth.ts:7`. |
| T-02-05-03 | Information Disclosure | mitigate | CLOSED | `verifyShareSecret()` precedes `decryptField()` and OTP `generate()` at `src/features/share/shareService.ts:269`, `:274`, and `:282`; wrong-code spy test is `src/features/share/shareService.test.ts:418`. |
| T-02-05-04 | Repudiation | mitigate | CLOSED | Wrong-code branch returns before audit at `src/features/share/shareService.ts:270`; successful `access_granted` audit occurs only after secret processing at `src/features/share/shareService.ts:296`. |
| T-02-06-01 | Tampering | mitigate | CLOSED | 02-06 summary records Worker/Docker/Netlify rebuild through build scripts in `.planning/phases/02-share-link-api/02-06-SUMMARY.md`; git history shows build commit `018b0b8`. |
| T-02-06-02 | Information Disclosure | mitigate | CLOSED | Generated `/api/*` CORS blocks call `resolveApiCorsOrigin(origin, c.env)` with credentials in all targets: `backend/dist/worker/worker.js:8170`, `backend/dist/docker/server.js:8200`, `backend/dist/netlify/api.mjs:8191`. |
| T-02-06-03 | Information Disclosure | mitigate | CLOSED | Generated `resolveShareAccess()` order is code verification before secret processing in all targets: Worker `backend/dist/worker/worker.js:7556`, `:7560`, `:7568`; Docker/Netlify verified by Node assertion. |
| T-02-06-04 | Denial of Service | accept | CLOSED | Accepted risk is documented in `.planning/phases/02-share-link-api/02-06-PLAN.md:219`; 02-06 verification records build/source-map validation gates in `.planning/phases/02-share-link-api/02-06-SUMMARY.md`. |

## Accepted Risks Log

| Threat ID | Accepted Risk | Evidence |
|---|---|---|
| T-02-03-04 | Unknown API routes use the existing generic 404 fallback after mounted routes; no share-specific secret material is included. | `.planning/phases/02-share-link-api/02-03-PLAN.md:161`, `src/app/index.ts:160` |
| T-02-06-04 | Build/source-map failures block distribution refresh publication; no runtime mitigation is required for the build pipeline acceptance. | `.planning/phases/02-share-link-api/02-06-PLAN.md:219`, `.planning/phases/02-share-link-api/02-06-SUMMARY.md` |

## Threat Flags

No unregistered threat flags. All `## Threat Flags` sections in 02-01 through 02-06 summaries were `None`.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-03 | 27 | 27 | 0 | gsd-security-auditor + Codex |

## Verification Commands

```bash
node scripts/validate_share_schema_alignment.js
node scripts/restore_backend_source_from_sourcemaps.js --verify
node - <<'NODE'
const fs=require('fs');
const files=['backend/dist/worker/worker.js','backend/dist/docker/server.js','backend/dist/netlify/api.mjs'];
for (const file of files) {
  const s=fs.readFileSync(file,'utf8');
  const start=s.indexOf('async resolveShareAccess');
  const end=s.indexOf('\n  }\n}', start);
  const body=s.slice(start,end);
  if (!(body.indexOf('verifyShareSecret') < body.indexOf('decryptField') && body.indexOf('verifyShareSecret') < body.indexOf('generate('))) {
    throw new Error(file);
  }
}
NODE
```

All commands exited 0 during this audit.

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-03
