---
phase: 02-share-link-api
reviewed: 2026-05-02T21:56:18Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - backend/dist/docker/server.js
  - backend/dist/docker/server.js.map
  - backend/dist/netlify/api.mjs
  - backend/dist/netlify/api.mjs.map
  - backend/dist/worker/worker.js
  - backend/dist/worker/worker.js.map
  - src/app/index.test.ts
  - src/app/index.ts
  - src/features/share/shareRoutes.test.ts
  - src/features/share/shareRoutes.ts
  - src/features/share/shareService.test.ts
  - src/features/share/shareService.ts
  - src/features/share/shareTypes.ts
  - src/shared/db/repositories/shareRepository.ts
  - src/shared/middleware/shareRateLimitMiddleware.test.ts
  - src/shared/middleware/shareRateLimitMiddleware.ts
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-02T21:56:18Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

The share-link flow is mostly well-contained, but I found one cross-origin auth exposure, one secret-processing order issue, and one generated MySQL migration that will not bootstrap cleanly.

## Critical Issues

### CR-01: Credentialed CORS reflects every origin

**File:** `src/app/index.ts:61-67`
**Issue:** The API CORS middleware echoes any request `Origin` while also enabling `credentials: true`. That allows arbitrary websites to make credentialed requests against authenticated `/api/*` endpoints and read the JSON response, which is a cross-origin authorization gap.
**Fix:**
```ts
const allowedOrigins = new Set([
    c.env.NODEAUTH_PUBLIC_ORIGIN,
    c.env.NODEAUTH_APP_ORIGIN,
].filter(Boolean));

app.use('/api/*', cors({
    origin: (origin) => (origin && allowedOrigins.has(origin) ? origin : ''),
    credentials: false,
    allowHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
    maxAge: 86400,
}));
```

## Warnings

### WR-01: Vault secret is decrypted before recipient access code is verified

**File:** `src/features/share/shareService.ts:263-293`
**Issue:** `resolveShareAccess()` decrypts the vault secret and generates the OTP before it checks `accessCode`. A bad access code should short-circuit first so invalid requests never touch the protected secret or its derived output.
**Fix:**
```ts
const accessCode = input.accessCode || '';
const accessCodeOk = await verifyShareSecret(pepper, 'share-access-code', accessCode, share.accessCodeHash);
if (!accessCodeOk) {
    return { accessible: false, status: 'active', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
}

const decryptedSecret = await decryptField(vaultItem.secret, this.env.ENCRYPTION_KEY || this.env.JWT_SECRET || '');
// generate OTP only after the access code passes
```

### WR-02: MySQL migration in generated bundles uses incompatible `TEXT` primary key columns

**File:** `backend/dist/docker/server.js:8620-8622`
**Issue:** The generated MySQL migration emits `share_links.id TEXT PRIMARY KEY` and related `TEXT` columns, while the source MySQL schema uses fixed-length `VARCHAR` fields. On a fresh MySQL-backed Docker deployment, this migration is likely to fail or create invalid key definitions. The same defect is mirrored in the Netlify and Worker bundles.
**Fix:**
```sql
CREATE TABLE IF NOT EXISTS share_links (
    id VARCHAR(36) PRIMARY KEY,
    vault_item_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    access_code_hash VARCHAR(255) NOT NULL,
    ...
);
```
Regenerate `backend/dist/docker/server.js`, `backend/dist/netlify/api.mjs`, and `backend/dist/worker/worker.js` from the corrected source schema.

---

_Reviewed: 2026-05-02T21:56:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
