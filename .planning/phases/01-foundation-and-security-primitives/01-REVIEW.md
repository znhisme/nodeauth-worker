---
phase: 01-foundation-and-security-primitives
reviewed: 2026-05-02T14:54:54Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - Dockerfile
  - netlify.toml
  - tsconfig.json
  - backend/package.json
  - backend/vitest.config.ts
  - backend/schema.sql
  - backend/scripts/build-worker.js
  - backend/scripts/build-docker.js
  - backend/scripts/build-netlify.js
  - scripts/restore_backend_source_from_sourcemaps.js
  - scripts/validate_share_schema_alignment.js
  - docs/share-link-security-contract.md
  - src/app/config.ts
  - src/app/index.ts
  - src/features/share/sharePrimitives.ts
  - src/features/share/shareSecurity.ts
  - src/features/share/shareSecurity.test.ts
  - src/features/share/shareService.ts
  - src/features/share/shareService.test.ts
  - src/features/share/shareTypes.ts
  - src/shared/db/migrator.ts
  - src/shared/db/repositories/shareRepository.ts
  - src/shared/db/repositories/vaultRepository.ts
  - src/shared/db/schema/index.ts
  - src/shared/db/schema/mysql.ts
  - src/shared/db/schema/pg.ts
  - src/shared/db/schema/sqlite.ts
  - src/shared/middleware/shareRateLimitMiddleware.ts
  - src/shared/middleware/shareRateLimitMiddleware.test.ts
findings:
  critical: 2
  warning: 2
  info: 0
  total: 4
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-05-02T14:54:54Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Reviewed the Phase 1 share-link primitives, database schema/migrations, build scripts, and tests. The schema alignment guard and Vitest suite pass, but the share primitives currently leak internal share records across public access decisions and persist raw share tokens in rate-limit storage. Those issues should be fixed before public share routes serialize these service decisions.

## Critical Issues

### CR-01: Public Share Decisions Return Stored Secret Hashes And Internal IDs

**File:** `src/features/share/shareService.ts:143`
**Issue:** `resolveShareAccess()` returns the raw `share` database record for revoked, expired, deleted-item, wrong-code, and successful recipient decisions. That record includes `ownerId`, `vaultItemId`, `tokenHash`, and `accessCodeHash`. Any route that serializes the decision will leak derived secret material and internal identifiers to public recipients, violating the security contract's explicit allowlist requirement.
**Fix:**
```ts
private toPublicShareRecord(share: ShareLink): Pick<ShareLinkRecord, 'status' | 'expiresAt' | 'revokedAt' | 'createdAt'> {
    const now = Date.now();
    return {
        status: share.revokedAt ? 'revoked' : (share.expiresAt <= now ? 'expired' : 'active'),
        expiresAt: String(share.expiresAt),
        revokedAt: share.revokedAt ? String(share.revokedAt) : null,
        createdAt: String(share.createdAt),
    };
}

// For recipient/public decisions, never include the stored ShareLink row.
return {
    accessible: false,
    status: 'active',
    reason: 'inaccessible',
    share: null,
    itemView: null,
    publicHeaders: getSharePublicHeaders(),
};
```

Keep owner-management responses separate from public recipient responses, and expose only an allowlisted public DTO from `resolveShareAccess()`.

### CR-02: Rate Limiter Persists Raw Share Tokens

**File:** `src/shared/middleware/shareRateLimitMiddleware.ts:19`
**Issue:** The default rate-limit key includes `c.req.param('token')`, and `shareId` is also set to the raw token. `ShareRepository.enforceRateLimit()` then stores those values in `share_rate_limits.key` and `share_rate_limits.share_id`, creating durable raw share-token storage outside `share_links`. This violates the contract that only HMAC-derived share secret values are stored after creation and turns rate-limit rows into bearer-token material if storage is exposed.
**Fix:**
```ts
const token = c.req.param('token') || '';
const pepper = getShareSecretPepper(c.env);
const tokenHash = token ? await hashShareSecret(pepper, 'share-token', token) : 'missing-token';

const key = options?.keyBuilder
    ? options.keyBuilder(c)
    : ['share', c.req.header('CF-Connecting-IP') || 'unknown', c.req.path, tokenHash]
        .filter(Boolean)
        .join(':');

await repository.enforceRateLimit({
    key,
    shareId: tokenHash,
    windowMs: SHARE_RATE_LIMIT_WINDOW_MS,
    maxAttempts: SHARE_RATE_LIMIT_MAX_ATTEMPTS,
    lockMs: SHARE_RATE_LIMIT_LOCK_MS,
});
```

When access-code-aware routes are added, include a derived access-code component as well so enforcement is per share and per access code without storing raw codes.

## Warnings

### WR-01: Revocation Reports Success Without Verifying A Row Was Updated

**File:** `src/shared/db/repositories/shareRepository.ts:40`
**Issue:** `revokeForOwner()` returns `!!result`, but Drizzle update calls commonly return a truthy result object even when zero rows match. `ShareService.revokeShare()` can therefore record a revocation audit event and report success for a missing, already-revoked, or non-owned share even though no active share was revoked.
**Fix:**
```ts
const existing = await this.findByIdForOwner(id, ownerId);
if (!existing || existing.revokedAt !== null) {
    return false;
}

await this.db
    .update(shareLinks)
    .set({ revokedAt })
    .where(and(eq(shareLinks.id, id), eq(shareLinks.ownerId, ownerId), isNull(shareLinks.revokedAt)));

return true;
```

If the project standardizes adapter-specific affected-row metadata, use that instead of a pre-read.

### WR-02: Public Share Access Decisions Drop Required No-Store Headers

**File:** `src/features/share/shareService.ts:170`
**Issue:** `resolveShareAccess()` exposes a `publicHeaders` field but sets it to `undefined` on successful access and omits it on denial paths. Public share responses are required to use `Cache-Control: no-store`, `Pragma: no-cache`, and `Referrer-Policy: no-referrer`; relying on future routes to remember this duplicates a security-sensitive requirement.
**Fix:**
```ts
const publicHeaders = getSharePublicHeaders();

return {
    accessible: true,
    status: 'active',
    share: null,
    itemView: {
        service: vaultItem.service,
        account: vaultItem.account,
    },
    publicHeaders,
    publicUrl: input.requestOrigin ? buildShareUrl(input.requestOrigin, input.token) : undefined,
};
```

Return `getSharePublicHeaders()` from every public access decision, including inaccessible, expired, and revoked outcomes.

---

_Reviewed: 2026-05-02T14:54:54Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
