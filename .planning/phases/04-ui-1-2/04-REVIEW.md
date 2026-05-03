---
phase: 04-ui-1-2
reviewed: 2026-05-03T22:15:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - backend/dist/docker/server.js
  - backend/dist/docker/server.js.map
  - backend/dist/netlify/api.mjs
  - backend/dist/netlify/api.mjs.map
  - backend/dist/worker/worker.js
  - backend/dist/worker/worker.js.map
  - src/features/share/shareRoutes.test.ts
  - src/features/share/shareRoutes.ts
  - src/features/share/shareService.test.ts
  - src/features/share/shareService.ts
  - src/features/share/shareTypes.ts
  - src/shared/db/repositories/shareRepository.test.ts
  - src/shared/db/repositories/shareRepository.ts
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-03T22:15:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the share-link route, service, repository, tests, and the generated Worker, Docker, and Netlify bundles for parity. The generated bundles contain the same share repository/service/route logic as the TypeScript source, so the findings below apply across all deployment targets.

The owner-facing responses are mostly privacy-safe and the public access route uses generic failure responses, but there are three correctness/security gaps: shared vault passwords are never returned, latest-share-wins is not atomic under concurrent creates, and rate-limit increments can be lost under concurrent public access attempts.

## Warnings

### WR-01: Password Vault Items Are Never Shared

**File:** `src/features/share/shareService.ts:356`
**Issue:** `SharedItemView` defines an optional `password`, and the project goal is to share an account's login details, but `resolveShareAccess()` only returns `service`, `account`, and optional OTP data. For vault items where the encrypted `secret` is the password or where `type` is not TOTP/HOTP-compatible, recipients get no password at all. This is a functional bug in the core share-link workflow and a test gap because current successful public-access tests only assert OTP output.
**Fix:** Decide how vault item type maps to recipient output, then return the decrypted password for password-style records while keeping OTP seed material hidden. Add a public-access service/route test for a password vault item.

```ts
const baseView = {
    service: vaultItem.service,
    account: vaultItem.account,
};

const decryptedSecret = await decryptField(vaultItem.secret, this.env.ENCRYPTION_KEY || this.env.JWT_SECRET || '');
const isOtpItem = ['totp', 'hotp', 'steam', 'blizzard'].includes(String(vaultItem.type || 'totp').toLowerCase());

const itemView = isOtpItem
    ? {
        ...baseView,
        otp: {
            code: await generate(decryptedSecret, period, Number(vaultItem.digits || 6), vaultItem.algorithm || 'SHA1', vaultItem.type || 'totp', now),
            period,
            remainingSeconds,
        },
    }
    : {
        ...baseView,
        password: decryptedSecret,
    };
```

### WR-02: Latest-Share-Wins Can Leave Multiple Active Links

**File:** `src/features/share/shareService.ts:89`
**Issue:** `createShare()` revokes existing active shares and then inserts the new share as separate repository operations with no transaction or database constraint. Two concurrent creates for the same owner/vault item can both run `revokeActiveForOwnerVaultItem()` before either insert commits, then both insert active rows. That breaks the latest-share-wins guarantee and can leave older public links usable until expiration. The same non-atomic sequence is present in `backend/dist/worker/worker.js:7448`, `backend/dist/docker/server.js:7478`, and `backend/dist/netlify/api.mjs:7469`.
**Fix:** Make replacement atomic at the persistence boundary. Prefer a transaction around revoke-plus-insert for runtimes that support it, or add a database-enforced active-share guard and retry/handle conflicts. Add a repository/service test that simulates concurrent create attempts or validates the transaction wrapper is used.

```ts
await this.shareRepository.replaceActiveShareForOwnerVaultItem({
    ownerId: input.ownerId,
    vaultItemId: input.vaultItemId,
    revokedAt: now,
    newShare,
});
```

### WR-03: Public Access Rate Limiting Loses Attempts Under Concurrency

**File:** `src/shared/db/repositories/shareRepository.ts:152`
**Issue:** `enforceRateLimit()` performs select-then-insert/update without an atomic upsert or row lock. Concurrent wrong-code attempts for the same key can all read the same attempt count and write back the same next value, so high parallel guessing can stay below the configured lock threshold. On a fresh key, concurrent inserts can also race on the primary key and surface as generic inaccessible responses without reliably recording the attempts. The same logic is bundled in `backend/dist/worker/worker.js:7255`, `backend/dist/docker/server.js:7285`, and `backend/dist/netlify/api.mjs:7276`.
**Fix:** Use an atomic database operation per dialect: SQLite/D1 `INSERT ... ON CONFLICT DO UPDATE`, PostgreSQL `INSERT ... ON CONFLICT ... DO UPDATE`, and MySQL `INSERT ... ON DUPLICATE KEY UPDATE`, or wrap the read/update in a transaction with appropriate locking where available. Add a repository test for conflict/update behavior instead of only mocking the Drizzle call chain.

```ts
// Pseudocode: implement per dialect/executor rather than select-then-update.
await this.db
    .insert(shareRateLimits)
    .values(newWindowRow)
    .onConflictDoUpdate({
        target: shareRateLimits.key,
        set: {
            attempts: sql`${shareRateLimits.attempts} + 1`,
            lastAttemptAt: now,
            lockedUntil: sql`case when ${shareRateLimits.attempts} + 1 > ${input.maxAttempts} then ${now + input.lockMs} else null end`,
        },
    });
```

---

_Reviewed: 2026-05-03T22:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
