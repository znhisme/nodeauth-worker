---
phase: 03-cleanup-compatibility-and-hardening
reviewed: 2026-05-03T11:08:34Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - backend/dist/docker/server.js
  - backend/dist/docker/server.js.map
  - backend/dist/netlify/api.mjs
  - backend/dist/netlify/api.mjs.map
  - backend/dist/worker/worker.js
  - backend/dist/worker/worker.js.map
  - docs/share-link-security-contract.md
  - scripts/validate_share_schema_alignment.js
  - src/app/index.test.ts
  - src/app/netlify.ts
  - src/app/server.ts
  - src/app/worker.ts
  - src/features/share/shareRoutes.test.ts
  - src/features/share/shareRoutes.ts
  - src/features/share/shareService.test.ts
  - src/features/share/shareService.ts
  - src/features/share/shareTypes.ts
  - src/shared/db/migrator.ts
  - src/shared/db/repositories/shareRepository.test.ts
  - src/shared/db/repositories/shareRepository.ts
  - src/shared/db/shareSchemaAlignmentValidator.test.ts
  - src/shared/middleware/shareRateLimitMiddleware.test.ts
  - src/shared/middleware/shareRateLimitMiddleware.ts
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-03T11:08:34Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

The share-link flow is broadly aligned with the contract, including token hashing, public headers, and fail-closed rate limiting. I found three correctness gaps: malformed TTL input can bypass expiration, owner revocations do not emit the revocation audit event, and the MySQL rate-limit schema is too narrow for the hashed share identifier actually stored there.

## Warnings

### WR-01: `expiresAt` accepts `NaN` and can create a non-expiring share

**File:** `src/features/share/shareRoutes.ts:21-29`
**Issue:** The route forwards `expiresAt` and `ttlSeconds` when they are any JavaScript `number`, including `NaN`. `createShare()` later compares `expiresAt` with `<=` and `>`, and `NaN` bypasses both checks. That can persist a share with an invalid expiration value that never expires as intended.
**Fix:**
```ts
const ttlSeconds = Number.isFinite(body.ttlSeconds) ? body.ttlSeconds : undefined;
const expiresAt = Number.isFinite(body.expiresAt) ? body.expiresAt : undefined;
```

### WR-02: Owner revocations skip the revocation audit event

**File:** `src/features/share/shareService.ts:188-229`
**Issue:** `revokeShareForOwner()` updates the share row and returns metadata, but it never records the `revoked` audit event. The public DELETE route uses this method, so API revocations disappear from the audit trail even though the service already has a separate `revokeShare()` helper that logs revocations.
**Fix:**
```ts
await this.shareRepository.insertAuditEvent({
    id: createId('share-audit'),
    shareId,
    eventType: 'revoked',
    actorType: 'owner',
    eventAt: now,
    ownerId,
    ipHash: null,
    userAgentHash: null,
    metadata: toMetadata({ revokedAt: now }),
});
```

### WR-03: MySQL `share_rate_limits.share_id` is too short for hashed token IDs

**File:** `src/shared/db/migrator.ts:382-388`
**Issue:** The rate limiter stores `shareId: tokenHash`, and the token hash is a base64url HMAC-SHA-256 string. That is longer than 36 characters, but the MySQL migration defines `share_rate_limits.share_id` as `VARCHAR(36)`. MySQL deployments will truncate or reject rate-limit rows, which breaks public access throttling and cleanup.
**Fix:**
```sql
share_id VARCHAR(255) NOT NULL
```
Update the schema validator and tests to expect the wider column as well.

---

_Reviewed: 2026-05-03T11:08:34Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
