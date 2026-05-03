---
phase: 03-cleanup-compatibility-and-hardening
reviewed: 2026-05-03T10:07:56Z
depth: standard
files_reviewed: 22
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
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-03T10:07:56Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Reviewed the share-link source, tests, schema/migration alignment script, and shipped Worker/Docker/Netlify bundles. The implementation covers the main token hashing, revocation, generic public failure, generated-runtime inclusion, and cleanup paths, but the current access flow still stores owner identity in recipient-triggered audit rows and has compatibility gaps in public-share rate limiting and credential disclosure.

## Warnings

### WR-01: Recipient Access Audit Rows Persist Owner Identity

**File:** `src/features/share/shareService.ts:326`

**Issue:** `resolveShareAccess` writes `ownerId: share.ownerId` for successful public recipient access, and the expired path writes the same at line 274. The security contract says audit records must not include owner email, but `ownerId` is derived from `user.email || user.id` in the owner routes, so common deployments persist the owner's email for every public access/expiry event. The shipped bundles contain the same behavior at `backend/dist/worker/worker.js:7589` and `backend/dist/worker/worker.js:7637`, `backend/dist/docker/server.js:7619` and `backend/dist/docker/server.js:7667`, and `backend/dist/netlify/api.mjs:7610` and `backend/dist/netlify/api.mjs:7658`.

**Fix:**
```ts
await this.shareRepository.insertAuditEvent({
    id: createId('share-audit'),
    shareId: share.id,
    eventType: 'access_granted',
    actorType: 'recipient',
    eventAt: now,
    ownerId: 'redacted',
    ipHash: null,
    userAgentHash: null,
    metadata: toMetadata({
        accessedAt: now,
        status: 'active',
    }),
});
```

If owner-scoped audit queries are needed later, add a separate non-email owner pseudonym/HMAC column rather than writing the raw route owner identifier.

### WR-02: Share Rate Limiter Collapses Docker and Netlify Traffic Into One Unknown Client Bucket

**File:** `src/shared/middleware/shareRateLimitMiddleware.ts:44`

**Issue:** The public share limiter uses only `CF-Connecting-IP` to distinguish clients. That header is Cloudflare-specific, but this project explicitly supports Docker and Netlify. In those runtimes normal requests commonly arrive with `x-forwarded-for`, `x-real-ip`, or platform headers instead, so every request without `CF-Connecting-IP` shares the same `share:unknown:share-public-access:<tokenHash>` key. One recipient can lock all other recipients for the same share token, and the audit trail cannot separate clients.

**Fix:**
```ts
function getShareClientIp(c: Context): string {
    const forwardedFor = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    return c.req.header('CF-Connecting-IP')
        || c.req.header('x-nf-client-connection-ip')
        || c.req.header('x-real-ip')
        || forwardedFor
        || 'unknown';
}

const key = options?.keyBuilder
    ? options.keyBuilder(c)
    : ['share', getShareClientIp(c), 'share-public-access', tokenHash].join(':');
```

Add tests for missing `CF-Connecting-IP` with `x-forwarded-for`/Netlify headers, then rebuild the three runtime bundles.

### WR-03: Successful Share Access Never Returns The Account Login Password

**File:** `src/features/share/shareService.ts:300`

**Issue:** `SharedItemView` includes an optional `password` field and the project goal is to let a friend access a shared account's login details, but the success response only returns `service`, `account`, and optional OTP data. If NodeAuth vault items can contain account passwords, the recipient cannot complete the account-lending use case through the API. If the current vault schema truly only stores TOTP secrets, then the `password` field and "login details" contract are misleading and should be removed/clarified.

**Fix:** Either decrypt and include the allowed password field from the shared item when that credential exists, or tighten the API/types/docs to state that share links expose only account identity plus OTP.

```ts
const itemView: SharedItemView = {
    service: vaultItem.service,
    account: vaultItem.account,
    ...(decryptedPassword ? { password: decryptedPassword } : {}),
    ...(otp ? { otp } : {}),
};
```

---

_Reviewed: 2026-05-03T10:07:56Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
