---
phase: 01-foundation-and-security-primitives
reviewed: 2026-05-02T16:21:43Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - backend/dist/docker/server.js
  - backend/dist/docker/server.js.map
  - backend/dist/netlify/api.mjs
  - backend/dist/netlify/api.mjs.map
  - backend/dist/worker/worker.js
  - backend/dist/worker/worker.js.map
  - src/features/share/shareService.test.ts
  - src/features/share/shareService.ts
  - src/features/share/shareTypes.ts
  - src/shared/db/repositories/shareRepository.ts
  - src/shared/middleware/shareRateLimitMiddleware.test.ts
  - src/shared/middleware/shareRateLimitMiddleware.ts
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-02T16:21:43Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the new share service, repository, rate-limit middleware, and the generated backend bundles. The security plumbing is broadly consistent, but there are a few functional gaps: the successful share response does not return the shared secret material, the create-time response leaks hashed internal fields, and the limiter’s access-count threshold is off by one relative to the declared max attempts.

## Critical Issues

### CR-01: Successful share access never returns the shared account secrets

**File:** `src/features/share/shareService.ts:164-174`
**Issue:** `resolveShareAccess()` only returns `service` and `account` in `itemView`. The share contract in `SharedItemView` includes optional `password` and `otp`, and the feature scope says the recipient should access the shared account’s login details. As written, the share link cannot actually convey the account material needed for login.
**Fix:** Populate the view from the vault record using the existing vault decryption helpers, then include only the fields enabled by the share policy. For example:
```ts
const itemView: SharedItemView = {
    service: vaultItem.service,
    account: vaultItem.account,
    password: includePassword ? decryptedPassword : undefined,
    otp: includeOtp ? { code, period, remainingSeconds } : undefined,
};
```

## Warnings

### WR-01: Share creation returns internal hashes to the caller

**File:** `src/features/share/shareService.ts:96-109`
**Issue:** The create result exposes `tokenHash`, `accessCodeHash`, and `ownerId`/`vaultItemId` in the `share` payload. Those values are not needed by the recipient and widen the blast radius if the response is logged or replayed in the UI.
**Fix:** Return only the public-facing fields from `createShare()`, such as `id`, `status`, `expiresAt`, `revokedAt`, `createdAt`, and `publicUrl`, and keep hashes internal to the repository layer.

### WR-02: Rate limiting allows one extra failed access attempt

**File:** `src/shared/db/repositories/shareRepository.ts:93-96`
**Issue:** The lock condition uses `attempts > input.maxAttempts`, so with `maxAttempts = 5` the sixth request is still counted as allowed before locking on the next update. That is one attempt too permissive relative to the configured limit.
**Fix:** Change the comparison to `>=` so the limiter locks as soon as the configured maximum is reached:
```ts
const lockedUntil = attempts >= input.maxAttempts ? now + input.lockMs : null;
```

### WR-03: The share-rate-limit middleware swallows unrelated repository errors as a generic 404

**File:** `src/shared/middleware/shareRateLimitMiddleware.ts:20-48`
**Issue:** Any exception inside the rate-limit block is converted into `share_inaccessible`. That masks real persistence/configuration failures the same way as an invalid token, which will make backend failures hard to diagnose and can hide broken DB writes.
**Fix:** Catch only the expected access-denied path. Let unexpected errors bubble to the app error handler, or log and rethrow them distinctly before returning the generic 404 for genuine access failures.

## Info

### IN-01: `includePassword` and `includeOtp` are declared but unused

**File:** `src/features/share/shareTypes.ts:54-63`
**Issue:** The create-share input advertises `includePassword` and `includeOtp`, but `ShareService.createShare()` ignores both flags. That makes the public API misleading and suggests a partially implemented branch.
**Fix:** Either wire the flags through to the item-view builder or remove them until the share payload supports those options.

---

_Reviewed: 2026-05-02T16:21:43Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
