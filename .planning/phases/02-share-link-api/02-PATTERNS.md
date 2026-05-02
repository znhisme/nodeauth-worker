# Phase 02: Share Link API - Pattern Map

**Mapped:** 2026-05-03  
**Files analyzed:** 13  
**Analogs found:** 11 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/features/share/shareRoutes.ts` | route/controller | request-response | `src/features/vault/vaultRoutes.ts` + `src/shared/middleware/shareRateLimitMiddleware.ts` | exact |
| `src/app/index.ts` | route/config/middleware | request-response | existing route mounting, logger, health, error handling in `src/app/index.ts` | exact |
| `src/features/share/shareService.ts` | service | CRUD + transform + event-driven audit | existing `src/features/share/shareService.ts` | exact |
| `src/features/share/shareTypes.ts` | model/DTO | request-response + transform | existing `src/features/share/shareTypes.ts` | exact |
| `src/shared/db/repositories/shareRepository.ts` | repository | CRUD | existing `src/shared/db/repositories/shareRepository.ts` | exact |
| `src/features/share/shareRoutes.test.ts` | test | request-response | `src/features/share/shareService.test.ts` + `src/shared/middleware/shareRateLimitMiddleware.test.ts` | role-match |
| `src/features/share/shareService.test.ts` | test | CRUD + transform + event-driven audit | existing `src/features/share/shareService.test.ts` | exact |
| `src/shared/db/repositories/shareRepository.test.ts` | test | CRUD | no repository test exists; use service/middleware test style | no exact analog |
| `src/app/index.test.ts` | test | request-response + logging/privacy | no app route/logger test exists; use Vitest style from share tests | no exact analog |
| `backend/dist/worker/worker.js` and `.map` | generated artifact | batch/transform | `backend/scripts/build-worker.js` | generated |
| `backend/dist/docker/server.js` and `.map` | generated artifact | batch/transform | `backend/scripts/build-docker.js` | generated |
| `backend/dist/netlify/api.mjs` and `.map` | generated artifact | batch/transform | `backend/scripts/build-netlify.js` | generated |
| `frontend/dist/**` | generated frontend asset | static asset/request-response | none; UI-SPEC says API-only and no editable frontend source | out-of-scope |

## Pattern Assignments

### `src/features/share/shareRoutes.ts` (route/controller, request-response)

**Analog:** `src/features/vault/vaultRoutes.ts`

**Imports and Hono sub-app pattern** (lines 1-11):
```typescript
import { Hono } from 'hono';
import { EnvBindings } from '@/app/config';
import { authMiddleware } from '@/shared/middleware/auth';
import { rateLimit } from '@/shared/middleware/rateLimitMiddleware';
import { VaultService } from '@/features/vault/vaultService';
import { TrashService } from '@/features/vault/trashService';
import { VaultRepository } from '@/shared/db/repositories/vaultRepository';

const vault = new Hono<{ Bindings: EnvBindings, Variables: { user: any } }>();
```

Copy this shape with `ShareService`, `ShareRepository`, `VaultRepository`, `shareRateLimit`, and `EnvBindings`. The share route needs `Variables: { user: any }` for owner routes.

**Route-local service factory** (lines 13-17):
```typescript
const getService = (c: any) => {
    const repo = new VaultRepository(c.env.DB);
    return new VaultService(c.env, repo);
};
```

Use the existing share factory instead:
```typescript
const getService = (c: any) => createShareService(c.env);
```

**Owner auth and owner id pattern** (lines 24, 119-125):
```typescript
vault.use('/*', authMiddleware);

vault.post('/', async (c) => {
    const user = c.get('user');
    const data = await c.req.json();
    const service = getService(c);
    const item = await service.createAccount(user.email || user.id, data);
    return c.json({ success: true, item });
});
```

For share routes, apply `authMiddleware` to owner endpoints only. Public recipient routes must not use this middleware.

**Request validation pattern** (lines 52-60, 217-245):
```typescript
vault.post('/reorder', async (c) => {
    const { ids } = await c.req.json();
    if (!Array.isArray(ids)) {
        return c.json({ success: false, error: 'ids must be an array' }, 400);
    }
    const service = getService(c);
    await service.reorderAccounts(ids);
    return c.json({ success: true });
});
```

Use route-level type checks for malformed JSON/body fields, then delegate security decisions to `ShareService`.

**Public rate-limit analog:** `src/shared/middleware/shareRateLimitMiddleware.ts`

**Fail-closed middleware attachment** (lines 20-27, 71-76):
```typescript
export const shareRateLimit = (options?: { keyBuilder?: (c: Context) => string }) => {
    return async (c: Context<{ Bindings: EnvBindings }>, next: Next) => {
        const db = c.env.DB;
        if (!db) {
            logger.warn('[ShareRateLimit] access blocked');
            throw new AppError('share_inaccessible', 404);
        }

        try {
            // ...
        } catch {
            logger.warn('[ShareRateLimit] access blocked');
            throw new AppError('share_inaccessible', 404);
        }

        await next();
    };
};
```

Apply `shareRateLimit()` to `POST /public/:token/access` before calling `resolveShareAccess`.

**Public response header pattern:** `src/features/share/shareSecurity.ts` (lines 129-138):
```typescript
export function getSharePublicHeaders(): Record<string, string> {
    return {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        'Referrer-Policy': 'no-referrer',
    };
}
```

Every public route response, success or failure, should set each header from `decision.publicHeaders`.

---

### `src/app/index.ts` (route/config/middleware, request-response)

**Analog:** existing `src/app/index.ts`

**Imports pattern** (lines 1-21):
```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as hLogger } from 'hono/logger';
import { logger } from '@/shared/utils/logger';
import { secureHeaders } from 'hono/secure-headers';
import { EnvBindings, getEffectiveCSP } from '@/app/config';
import { initializeEnv } from '@/shared/utils/crypto';

import authRoutes from '@/features/auth/authRoutes';
import vaultRoutes from '@/features/vault/vaultRoutes';
```

Add `import shareRoutes from '@/features/share/shareRoutes';` beside the other feature routes.

**Global logger pattern and privacy risk** (lines 49-50):
```typescript
// 1.2 全球请求日志注入: 通过统一 Logger 进行过滤
app.use('*', hLogger((str) => logger.info(str)));
```

Phase 2 public routes put the raw share token in the URL path. Replace this direct logger callback with a redaction wrapper that masks `/api/share/public/:token` before `logger.info(...)`.

**Health gate pattern** (lines 81-101):
```typescript
app.use('/api/*', async (c, next) => {
    const path = c.req.path;
    if (path.startsWith('/api/health') || path === '/api/oauth/logout') {
        await next();
        return;
    }

    const securityResult = await runHealthCheck(c.env, c.req.url);
    if (securityResult.status === 'fail') {
        return c.json({
            code: 403,
            success: false,
            message: 'health_check_failed',
            data: securityResult.issues
        }, 403);
    }

    await next();
});
```

Public share endpoints should still pass this global health gate. Do not add them to the health-check exemption list.

**Route mounting pattern** (lines 103-111):
```typescript
app.route('/api/health', healthRoutes);
app.route('/api/emergency', emergencyRoutes);
app.route('/api/oauth', authRoutes);
app.route('/api/vault', vaultRoutes);
app.route('/api/backups', backupRoutes);
app.route('/api/telegram', telegramRoutes);
app.route('/api/tools', toolsRoutes);
app.route('/api/oauth/wc-proxy', wcProxyRoutes);
```

Mount `shareRoutes` as `app.route('/api/share', shareRoutes);` with the other business sub-routes.

**Centralized error pattern** (lines 136-160):
```typescript
app.onError((err, c) => {
    const statusCode = (err as any).statusCode || (err as any).status || 500;
    const isAppError = (err as any).name === 'AppError';
    let message = err.message || 'Internal Server Error';

    if (!isAppError && statusCode >= 500) {
        logger.error(`[CRITICAL ERROR] ${err.stack || err.message}`);
        message = 'internal_server_error';
    } else {
        logger.error(`[Server Error] ${err.message}`);
    }

    return c.json({
        code: statusCode,
        success: false,
        message: message,
        data: null
    }, statusCode as any);
});
```

Owner routes should throw `AppError` through service methods. Public routes should collapse inaccessible decisions to a generic response and not expose internal reasons.

---

### `src/features/share/shareService.ts` (service, CRUD + transform + event-driven audit)

**Analog:** existing `src/features/share/shareService.ts`

**Imports pattern** (lines 1-21):
```typescript
import { AppError, type EnvBindings } from '@/app/config';
import { VaultRepository } from '@/shared/db/repositories/vaultRepository';
import { ShareRepository } from '@/shared/db/repositories/shareRepository';
import {
    buildShareUrl,
    clampShareTtlSeconds,
    generateAccessCode,
    generateShareToken,
    getSharePublicHeaders,
    getShareSecretPepper,
    hashShareSecret,
    verifyShareSecret,
} from '@/features/share/shareSecurity';
```

Add `decryptField` from `@/shared/db/db` and `generate` from `@/shared/utils/otp` for `SharedItemView.otp`. Keep app imports through `@/`.

**Create-share enforcement pattern** (lines 40-80):
```typescript
async createShare(input: CreateShareInput): Promise<CreateShareResult> {
    if (!input.ownerId || !input.vaultItemId) {
        throw new AppError('share_item_inaccessible', 404);
    }

    const now = input.now ?? Date.now();
    const ttlSeconds = clampShareTtlSeconds(input.ttlSeconds ?? SHARE_DEFAULT_TTL_SECONDS);
    const expiresAt = input.expiresAt ?? now + ttlSeconds * 1000;

    if (expiresAt <= now || expiresAt > now + SHARE_MAX_TTL_SECONDS * 1000) {
        throw new AppError('share_item_inaccessible', 404);
    }

    const vaultItem = await this.vaultRepository.findActiveByIdForOwner(input.vaultItemId, input.ownerId);
    if (!vaultItem) {
        throw new AppError('share_item_inaccessible', 404);
    }
```

Keep expiration and ownership checks below the route layer.

**One-time raw token/access-code return pattern** (lines 58-79, 96-112):
```typescript
const rawToken = generateShareToken();
const rawAccessCode = generateAccessCode();
const pepper = getShareSecretPepper(this.env);
const tokenHash = await hashShareSecret(pepper, 'share-token', rawToken);
const accessCodeHash = await hashShareSecret(pepper, 'share-access-code', rawAccessCode);

const publicOrigin = input.publicOrigin || this.env.NODEAUTH_PUBLIC_ORIGIN;
const publicUrl = publicOrigin ? buildShareUrl(publicOrigin, rawToken) : undefined;

return {
    share: {
        id: share.id,
        ownerId: share.ownerId,
        vaultItemId: share.vaultItemId,
        tokenHash: share.tokenHash,
        accessCodeHash: share.accessCodeHash,
        status: share.revokedAt ? 'revoked' : (share.expiresAt <= now ? 'expired' : 'active'),
        expiresAt: String(share.expiresAt),
        revokedAt: share.revokedAt ? String(share.revokedAt) : null,
        createdAt: String(share.createdAt),
        updatedAt: String(share.createdAt),
        publicUrl,
    },
    rawToken,
    rawAccessCode,
};
```

Routes must not return this internal `share` object directly. Add safe DTO serializers for create/list/detail/revoke that omit `ownerId`, `vaultItemId` unless replaced by a non-sensitive item reference, `tokenHash`, and `accessCodeHash`.

**Revoke pattern** (lines 115-132):
```typescript
async revokeShare(ownerId: string, shareId: string, now = Date.now()): Promise<void> {
    const revoked = await this.shareRepository.revokeForOwner(shareId, ownerId, now);
    if (!revoked) {
        throw new AppError('share_item_inaccessible', 404);
    }

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
}
```

For Phase 2, return safe metadata after revocation by re-reading through an owner-scoped method or by making `revokeShare` return the serialized owner DTO.

**Public access decision pattern** (lines 134-177):
```typescript
const publicHeaders = getSharePublicHeaders();
const tokenHash = await hashShareSecret(pepper, 'share-token', input.token);
const share = await this.shareRepository.findByTokenHash(tokenHash);

if (!share) {
    return { accessible: false, status: 'revoked', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
}

if (share.revokedAt !== null && share.revokedAt !== undefined) {
    return { accessible: false, status: 'revoked', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
}

if (share.expiresAt <= now) {
    await this.shareRepository.insertAuditEvent({ /* expired audit */ });
    return { accessible: false, status: 'expired', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
}

const vaultItem = await this.vaultRepository.findActiveByIdForOwner(share.vaultItemId, share.ownerId);
if (!vaultItem) {
    return { accessible: false, status: 'revoked', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
}

const accessCodeOk = await verifyShareSecret(pepper, 'share-access-code', accessCode, share.accessCodeHash);
if (!accessCodeOk) {
    return { accessible: false, status: 'active', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
}
```

Keep distinct internal statuses for owner metadata/tests, but public routes must serialize them as the same generic inaccessible state.

**Recipient DTO allowlist pattern** (lines 195-204):
```typescript
return {
    accessible: true,
    status: 'active',
    share: null,
    itemView: {
        service: vaultItem.service,
        account: vaultItem.account,
    },
    publicHeaders,
};
```

Extend only this allowlist. Do not spread `vaultItem`.

**Decryption analog:** `src/features/vault/vaultService.ts` (lines 321-331):
```typescript
private async plainSecretForExport(userId: string, sseEncryptedSecret: string | null): Promise<string | null> {
    if (!sseEncryptedSecret) return null;
    try {
        const plain = await decryptField(sseEncryptedSecret, this.encryptionKey) as string;
        if (!plain) return null;
        if (plain.startsWith('nodeauth:')) {
            const salt = await generateDeviceKey(userId, this.env.JWT_SECRET || '');
            const maskingKey = await deriveMaskingKey(salt);
            return await unmaskSecret(plain, maskingKey);
        }
        return plain;
    } catch (e) {
        return null;
    }
}
```

For public share access, decrypt only inside the service to generate current OTP. Do not return the seed or otpauth URI.

**OTP generation analog:** `src/shared/utils/otp/index.ts` (lines 21-39):
```typescript
export async function generate(
    secret: string | Uint8Array,
    timeOrCounter = 30,
    digits = 6,
    algorithm = 'SHA1',
    type = 'totp',
    timestamp = Date.now()
): Promise<string> {
    if (type === 'steam') {
        return generateSteamTOTP(secret, timeOrCounter);
    }
    if (type === 'blizzard') {
        return generateBlizzardOTP(secret, timeOrCounter, timestamp);
    }
    if (type === 'hotp') {
        return generateHOTP(secret, timeOrCounter, digits, algorithm);
    }
    return generateTOTP(secret, timeOrCounter, digits, algorithm, timestamp);
}
```

Compute countdown as `period - (Math.floor(now / 1000) % period)` and return only `{ code, period, remainingSeconds }`.

---

### `src/features/share/shareTypes.ts` (model/DTO, request-response + transform)

**Analog:** existing `src/features/share/shareTypes.ts`

**Constants and status pattern** (lines 1-10):
```typescript
export const SHARE_TOKEN_BYTES = 32;
export const SHARE_ACCESS_CODE_BYTES = 16;
export const SHARE_DEFAULT_TTL_SECONDS = 24 * 60 * 60;
export const SHARE_MAX_TTL_SECONDS = 7 * 24 * 60 * 60;

export type ShareStatus = 'active' | 'expired' | 'revoked';
export type ShareAuditEventType = 'created' | 'access_granted' | 'access_denied_threshold' | 'expired' | 'revoked';
```

Keep status values stable for future UI: `active`, `expired`, `revoked`.

**Recipient DTO allowlist** (lines 13-22):
```typescript
export interface SharedItemView {
    service: string;
    account: string;
    password?: string;
    otp?: {
        code: string;
        period: number;
        remainingSeconds: number;
    };
}
```

Do not add `secret`, `otpAuthUri`, `ownerId`, `vaultItemId`, `tokenHash`, `accessCodeHash`, session fields, or backup fields to recipient DTOs.

**Internal record includes secret-bearing hashes** (lines 24-36):
```typescript
export interface ShareLinkRecord {
    id: string;
    ownerId: string;
    vaultItemId: string;
    tokenHash: string;
    accessCodeHash: string;
    status: ShareStatus;
    expiresAt: string;
    revokedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    publicUrl?: string;
}
```

Add separate route-facing owner DTOs instead of reusing `ShareLinkRecord`, for example `OwnerShareMetadataView` and `OwnerShareCreatedView`.

**Input/result pattern** (lines 54-76, 93-100):
```typescript
export interface CreateShareInput {
    ownerId: string;
    vaultItemId: string;
    expiresAt?: number;
    ttlSeconds?: number;
    now?: number;
    publicOrigin?: string;
    includePassword?: boolean;
    includeOtp?: boolean;
}

export interface ShareAccessDecision {
    accessible: boolean;
    status: ShareStatus;
    reason?: 'inaccessible';
    share?: SharePublicAccessRecord | null;
    publicHeaders?: Record<string, string>;
    publicUrl?: string;
    itemView?: SharedItemView | null;
}
```

Add owner list/detail/revoke DTOs with safe item label/reference fields and status timestamps from the UI spec: `status`, `createdAt`, `expiresAt`, `revokedAt`, `lastAccessedAt`, `accessCount`, and item display fields.

---

### `src/shared/db/repositories/shareRepository.ts` (repository, CRUD)

**Analog:** existing `src/shared/db/repositories/shareRepository.ts`

**Imports pattern** (lines 1-12):
```typescript
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import {
    shareAuditEvents,
    shareLinks,
    shareRateLimits,
    type NewShareAuditEvent,
    type NewShareLink,
    type NewShareRateLimit,
    type ShareLink,
    type ShareRateLimit,
} from '@/shared/db/schema/index';
```

Remove unused imports if still unused after adding list queries. Use `desc`, `and`, `eq`, and `isNull` consistently.

**Create then owner-scoped read pattern** (lines 17-20):
```typescript
async createShareLink(input: NewShareLink): Promise<ShareLink> {
    await this.db.insert(shareLinks).values(input);
    return await this.findByIdForOwner(input.id as string, input.ownerId as string) as ShareLink;
}
```

Owner-facing methods should always scope by both share id and `ownerId`.

**Token lookup for public access only** (lines 22-29):
```typescript
async findByTokenHash(tokenHash: string): Promise<ShareLink | null> {
    const result = await this.db
        .select()
        .from(shareLinks)
        .where(eq(shareLinks.tokenHash, tokenHash))
        .limit(1);
    return result[0] || null;
}
```

Do not use this method for owner inspect/revoke routes.

**Owner-scoped lookup and revoke pattern** (lines 31-52):
```typescript
async findByIdForOwner(id: string, ownerId: string): Promise<ShareLink | null> {
    const result = await this.db
        .select()
        .from(shareLinks)
        .where(and(eq(shareLinks.id, id), eq(shareLinks.ownerId, ownerId)))
        .limit(1);
    return result[0] || null;
}

async revokeForOwner(id: string, ownerId: string, revokedAt: number): Promise<boolean> {
    const existing = await this.findByIdForOwner(id, ownerId);
    if (!existing || (existing.revokedAt !== null && existing.revokedAt !== undefined)) {
        return false;
    }

    await this.db
        .update(shareLinks)
        .set({ revokedAt })
        .where(and(eq(shareLinks.id, id), eq(shareLinks.ownerId, ownerId), isNull(shareLinks.revokedAt)));

    return true;
}
```

Add `listForOwner(ownerId)` using the same owner filter and `orderBy(desc(shareLinks.createdAt))`. If item display labels require vault data, prefer service-level enrichment through `VaultRepository.findActiveByIdForOwner` unless a simple Drizzle join remains cross-dialect.

**Mutation pattern for access count** (lines 54-62):
```typescript
async markAccessed(id: string, accessedAt: number): Promise<void> {
    await this.db
        .update(shareLinks)
        .set({
            lastAccessedAt: accessedAt,
            accessCount: sql<number>`coalesce(${shareLinks.accessCount}, 0) + 1`,
        })
        .where(eq(shareLinks.id, id));
}
```

Use `sql<number>` only where Drizzle expression support is already present.

---

### `src/features/share/shareRoutes.test.ts` (test, request-response)

**Analogs:** `src/features/share/shareService.test.ts`, `src/shared/middleware/shareRateLimitMiddleware.test.ts`, `backend/vitest.config.ts`

**Vitest import/style pattern** (`shareService.test.ts` lines 1-5):
```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppError } from '@/app/config';
import { ShareService } from '@/features/share/shareService';
import { hashShareSecret } from '@/features/share/shareSecurity';
```

**Fixture and redaction assertion pattern** (`shareService.test.ts` lines 6-49):
```typescript
const makeVaultItem = (overrides: any = {}) => ({
    id: 'vault-1',
    service: 'GitHub',
    account: 'user@example.com',
    secret: 'secret',
    // ...
    ...overrides,
});

const expectRecipientSafeDecision = (decision: any) => {
    const serialized = JSON.stringify(decision);
    expect(serialized).not.toContain('ownerId');
    expect(serialized).not.toContain('vaultItemId');
    expect(serialized).not.toContain('tokenHash');
    expect(serialized).not.toContain('accessCodeHash');
    expect(decision.publicHeaders).toEqual({
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        'Referrer-Policy': 'no-referrer',
    });
};
```

Route tests should serialize JSON responses and reject forbidden fields: `tokenHash`, `accessCodeHash`, `rawToken` except create success, `rawAccessCode` except create success, `ownerId`, `sessionId`, `secret`, `otpAuthUri`, `otpauth`, `seed`, full URLs in logs, and passwords on owner endpoints.

**Mock style pattern** (`shareService.test.ts` lines 63-80):
```typescript
beforeEach(() => {
    vaultRepository = {
        findActiveByIdForOwner: vi.fn(),
    };
    shareRepository = {
        createShareLink: vi.fn(),
        findByTokenHash: vi.fn(),
        findByIdForOwner: vi.fn(),
        revokeForOwner: vi.fn(),
        markAccessed: vi.fn(),
        insertAuditEvent: vi.fn(),
        enforceRateLimit: vi.fn(),
    };
    service = new ShareService(
        { SHARE_SECRET_PEPPER: 'pepper', JWT_SECRET: 'jwt' } as any,
        vaultRepository,
        shareRepository,
    );
});
```

If route tests mock `createShareService`, keep mocks close to the test file and reset with `vi.restoreAllMocks()`.

**Test config pattern** (`backend/vitest.config.ts` lines 4-25):
```typescript
export default defineConfig({
    root: '.',
    resolve: {
        alias: [
            {
                find: '@',
                replacement: fileURLToPath(new URL('../src', import.meta.url)),
            },
        ],
    },
    test: {
        environment: 'node',
        include: ['../src/**/*.test.ts'],
    },
});
```

Place route tests under `src/**` and run them with `npm --prefix backend test -- ../src/features/share/shareRoutes.test.ts`.

---

### `src/features/share/shareService.test.ts` (test, CRUD + transform + event-driven audit)

**Analog:** existing `src/features/share/shareService.test.ts`

**Existing public DTO safety pattern** (lines 247-306):
```typescript
it('serializes successful decisions with public headers and no internal share fields', async () => {
    const accessCode = 'correct-code';
    const accessCodeHash = await hashShareSecret('pepper', 'share-access-code', accessCode);
    const rawToken = 'raw-public-token-123';
    const tokenHash = await hashShareSecret('pepper', 'share-token', rawToken);
    shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord({ tokenHash, accessCodeHash }));
    vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem());

    const decision = await service.resolveShareAccess({
        token: rawToken,
        accessCode,
        requestOrigin: 'https://example.test',
        now: 1000,
    } as any);

    expect(decision).toMatchObject({
        accessible: true,
        status: 'active',
        itemView: {
            service: 'GitHub',
            account: 'user@example.com',
        },
    });
    expectRecipientSafeDecision(decision);
});
```

Extend this test to assert OTP `{ code, period, remainingSeconds }` is present when the item has OTP data and that serialized output does not contain decrypted seed material.

**Generic inaccessible pattern** (lines 180-245):
```typescript
it('serializes missing inaccessible decisions with public headers and no internal share fields', async () => {
    shareRepository.findByTokenHash.mockResolvedValue(null);

    const decision = await service.resolveShareAccess({
        token: 'token',
        accessCode: 'code',
        now: 1000,
    } as any);

    expect(decision).toMatchObject({ accessible: false, reason: 'inaccessible' });
    expectRecipientSafeDecision(decision);
});
```

Keep missing, expired, revoked, deleted, and wrong-code cases covered. Add owner metadata tests that prove list/detail/revoke omit hashes and raw one-time values.

---

### `src/shared/db/repositories/shareRepository.test.ts` (test, CRUD)

**Analog:** no repository test exists. Use `shareService.test.ts` style and repository method assertions from `shareRateLimitMiddleware.test.ts`.

**Repository mock assertion pattern** (`shareRateLimitMiddleware.test.ts` lines 202-216):
```typescript
const enforceRateLimit = vi.spyOn(ShareRepository.prototype, 'enforceRateLimit').mockResolvedValue({
    allowed: true,
    attempts: 1,
    lockedUntil: null,
});

await middleware(ctx as any, vi.fn());

const input = enforceRateLimit.mock.calls[0][0];
expect(input.key).not.toContain(rawToken);
expect(input.shareId).not.toContain(rawToken);
```

If planner adds repository tests, build a small fake Drizzle chain and assert new methods call `.where(and(eq(shareLinks.ownerId, ownerId), ...))`, `.orderBy(desc(shareLinks.createdAt))`, and never require token hashes for owner list/detail.

---

### `src/app/index.test.ts` (test, request-response + logging/privacy)

**Analog:** no app-level test exists. Use Vitest conventions from share tests.

**Logging source to test:** `src/app/index.ts` lines 49-50:
```typescript
app.use('*', hLogger((str) => logger.info(str)));
```

Add an app/logger helper unit if logger redaction is extracted. Test that logged strings for `/api/share/public/raw-public-token-123/access` do not contain `raw-public-token-123`, while ordinary paths remain readable.

---

### Generated backend bundles (generated artifact, batch/transform)

**Analogs:** `backend/package.json`, backend build scripts

**Build script commands** (`backend/package.json` lines 4-10):
```json
"scripts": {
  "dev": "wrangler dev --config ../wrangler.dev.toml --ip 0.0.0.0 --port 8787 --test-scheduled",
  "deploy": "wrangler deploy --minify ./src/app/worker.ts",
  "build:docker": "node scripts/build-docker.js",
  "build:worker": "node scripts/build-worker.js",
  "build:netlify": "node scripts/build-netlify.js",
  "test": "vitest run"
}
```

Do not hand-edit `backend/dist/**`. Regenerate through:
```bash
npm --prefix backend run build:worker
npm --prefix backend run build:docker
npm --prefix backend run build:netlify
```

---

### `frontend/dist/**` (generated frontend asset, out of scope)

**Analog:** none.

UI-SPEC says Phase 2 is API-only because editable frontend source is absent. Do not plan direct edits to generated Vue/Vite/Element Plus assets. API responses must provide future UI state: create one-time handoff, owner safe list/detail/revoke metadata, public access-code unlock, `SharedItemView`, and generic public inaccessible response.

## Shared Patterns

### Authentication And CSRF

**Source:** `src/shared/middleware/auth.ts` lines 7-19, 21-46  
**Apply to:** Owner share routes only

```typescript
const token = getCookie(c, 'auth_token');
if (!token) {
    throw new AppError('no_session', 401);
}

const csrfCookie = getCookie(c, 'csrf_token');
const csrfHeader = c.req.header('X-CSRF-Token');
if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    throw new AppError('csrf_mismatch', 403);
}

const payload = await verifySecureJWT(token, c.env.JWT_SECRET);
// ...
c.set('user', payload.userInfo);
c.set('sessionId', sessionId);
await next();
```

### Owner Identity

**Source:** `src/features/vault/vaultRoutes.ts` lines 34-36, 121-125  
**Apply to:** Owner create/list/detail/revoke

```typescript
const user = c.get('user');
const service = getService(c);
const result = await service.getAccountsPaginated(user.email || user.id, page, limit, search, category);
```

Use `ownerId = user.email || user.id`; never accept `ownerId` from request body/query.

### Centralized Errors

**Source:** `src/app/config.ts` lines 191-198 and `src/app/index.ts` lines 136-160  
**Apply to:** Services and route handlers

```typescript
export class AppError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 500) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
    }
}
```

Throw `AppError('share_item_inaccessible', 404)` or `AppError('share_inaccessible', 404)` for expected failures; let `app.onError` format them.

### Public Rate Limiting

**Source:** `src/shared/middleware/shareRateLimitMiddleware.ts` lines 28-47, 49-74  
**Apply to:** Public recipient route

```typescript
const rawToken = c.req.param('token') || '';
const pepper = getShareSecretPepper(c.env);
const tokenHash = rawToken ? await hashShareSecret(pepper, 'share-token', rawToken) : 'missing-token';
const key = [
    'share',
    c.req.header('CF-Connecting-IP') || 'unknown',
    'share-public-access',
    tokenHash,
].filter(Boolean).join(':');
const repository = new ShareRepository(db);
const decision = await repository.enforceRateLimit({
    key,
    shareId: tokenHash,
    windowMs: SHARE_RATE_LIMIT_WINDOW_MS,
    maxAttempts: SHARE_RATE_LIMIT_MAX_ATTEMPTS,
    lockMs: SHARE_RATE_LIMIT_LOCK_MS,
});
```

This limiter intentionally stores a token hash, not a raw token or full path.

### Public Headers

**Source:** `src/features/share/shareSecurity.ts` lines 129-138  
**Apply to:** All public recipient responses

```typescript
return {
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
    'Referrer-Policy': 'no-referrer',
};
```

### Secret Generation And Hashing

**Source:** `src/features/share/shareSecurity.ts` lines 54-92  
**Apply to:** Create-share and access-code verification

```typescript
export function generateShareToken(): string {
    return encodeBase64Url(getRandomBytes(SHARE_TOKEN_BYTES));
}

export function generateAccessCode(): string {
    return encodeBase64Url(getRandomBytes(SHARE_ACCESS_CODE_BYTES));
}

export async function hashShareSecret(pepper: string, purpose: string, value: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(pepper),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    // ...
}
```

### Repository Owner Scoping

**Source:** `src/shared/db/repositories/shareRepository.ts` lines 31-49  
**Apply to:** Owner list/detail/revoke repository methods

```typescript
.where(and(eq(shareLinks.id, id), eq(shareLinks.ownerId, ownerId)))
```

Owner routes must not use unscoped token lookup for management operations.

### DTO Redaction Tests

**Source:** `src/features/share/shareService.test.ts` lines 38-49 and `src/shared/middleware/shareRateLimitMiddleware.test.ts` lines 7-12  
**Apply to:** Route, service, and middleware tests

```typescript
const serialized = JSON.stringify(decision);
expect(serialized).not.toContain('ownerId');
expect(serialized).not.toContain('vaultItemId');
expect(serialized).not.toContain('tokenHash');
expect(serialized).not.toContain('accessCodeHash');
```

Extend these assertions for `rawToken`, `rawAccessCode`, `secret`, `seed`, `otpauth`, `session`, `backup`, and raw public tokens in logs.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/shared/db/repositories/shareRepository.test.ts` | test | CRUD | No repository tests exist in `src/**`; use Vitest style from share service/middleware tests. |
| `src/app/index.test.ts` | test | request-response + logging/privacy | No app-level route/logger tests exist; extract logger redaction helper if needed for targeted testing. |
| `frontend/dist/**` | generated frontend asset | static asset/request-response | UI-SPEC says editable frontend source is absent and generated assets are out of scope. |

## Metadata

**Analog search scope:** `src/app`, `src/features`, `src/shared`, `backend/package.json`, `backend/vitest.config.ts`, `backend/schema.sql`  
**Files scanned:** 70+ source and backend configuration files via `rg --files src backend`  
**Pattern extraction date:** 2026-05-03  
**Frontend source status:** no editable frontend source; do not plan direct `frontend/dist/**` edits  
**Primary validation commands:** `npm --prefix backend test`, targeted share route/service tests, and backend build scripts for worker/docker/netlify
