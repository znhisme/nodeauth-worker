# Phase 04: ui-1-2 - Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 16
**Analogs found:** 12 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/features/share/shareService.ts` | service | request-response + CRUD | `src/features/share/shareService.ts` | exact |
| `src/shared/db/repositories/shareRepository.ts` | repository | CRUD | `src/shared/db/repositories/shareRepository.ts` | exact |
| `src/features/share/shareRoutes.ts` | route/controller | request-response | `src/features/share/shareRoutes.ts` | exact |
| `src/features/share/shareTypes.ts` | model/type | transform | `src/features/share/shareTypes.ts` | exact |
| `src/features/share/shareService.test.ts` | test | request-response + security validation | `src/features/share/shareService.test.ts` | exact |
| `src/features/share/shareRoutes.test.ts` | test | request-response | `src/features/share/shareRoutes.test.ts` | exact |
| `src/shared/db/repositories/shareRepository.test.ts` | test | CRUD | `src/shared/db/repositories/shareRepository.test.ts` | exact |
| `frontend/src/.../ManageShares*.vue` | component/page | request-response | generated `frontend/dist/assets/vaultList-88fb41a5.js` evidence only | blocked |
| `frontend/src/.../navigation/home*.vue` | component/navigation | event-driven | generated `frontend/dist/assets/index-936a7cdd.js` evidence only | blocked |
| `frontend/src/.../vaultList*.vue` | component | event-driven + request-response | generated `frontend/dist/assets/vaultList-88fb41a5.js` evidence only | blocked |
| `backend/dist/worker/worker.js` | generated bundle | build output | `backend/scripts/build-worker.js` | build-analog |
| `backend/dist/docker/server.js` | generated bundle | build output | `backend/scripts/build-docker.js` | build-analog |
| `backend/dist/netlify/api.mjs` | generated bundle | build output | `backend/scripts/build-netlify.js` | build-analog |
| `backend/dist/vercel/index.mjs` | generated bundle | build output | `backend/package.json` declares missing `build-vercel.js` | partial |
| `backend/package.json` | config | batch/build commands | `backend/package.json` | exact |
| `backend/vitest.config.ts` | config | test discovery | `backend/vitest.config.ts` | exact |

## Pattern Assignments

### `src/features/share/shareService.ts` (service, request-response + CRUD)

**Analog:** `src/features/share/shareService.ts`

**Imports pattern** (lines 1-28):
```typescript
import { AppError, type EnvBindings } from '@/app/config';
import { decryptField } from '@/shared/db/db';
import { VaultRepository } from '@/shared/db/repositories/vaultRepository';
import { ShareRepository } from '@/shared/db/repositories/shareRepository';
import { generate } from '@/shared/utils/otp';
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

**Owner-safe metadata pattern** (lines 51-67):
```typescript
private toOwnerMetadataView(share: ShareLinkRecord, vaultItem: { id: string; service: string; account: string }, now: number, publicUrl?: string): OwnerShareMetadataView {
    return {
        id: share.id,
        item: {
            id: vaultItem.id,
            service: vaultItem.service,
            account: vaultItem.account,
        },
        status: toShareStatus(share, now),
        createdAt: String(share.createdAt),
        expiresAt: String(share.expiresAt),
        revokedAt: share.revokedAt != null ? String(share.revokedAt) : null,
        lastAccessedAt: share.lastAccessedAt != null ? String(share.lastAccessedAt) : null,
        accessCount: Number(share.accessCount || 0),
        ...(publicUrl ? { publicUrl } : {}),
    };
}
```

**Create-share pattern to extend for latest-share-wins** (lines 69-123):
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

    const rawToken = generateShareToken();
    const rawAccessCode = generateAccessCode();
    const pepper = getShareSecretPepper(this.env);
    const tokenHash = await hashShareSecret(pepper, 'share-token', rawToken);
    const accessCodeHash = await hashShareSecret(pepper, 'share-access-code', rawAccessCode);
    const shareId = createId('share');

    const share = await this.shareRepository.createShareLink({
        id: shareId,
        vaultItemId: input.vaultItemId,
        ownerId: input.ownerId,
        tokenHash,
        accessCodeHash,
        expiresAt,
        revokedAt: null,
        createdAt: now,
        lastAccessedAt: null,
        accessCount: 0,
    });

    await this.shareRepository.insertAuditEvent({
        id: createId('share-audit'),
        shareId: share.id,
        eventType: 'created',
        actorType: 'owner',
        eventAt: now,
        ownerId: input.ownerId,
        ipHash: null,
        userAgentHash: null,
        metadata: toMetadata({
            vaultItemId: input.vaultItemId,
            expiresAt,
        }),
    });
}
```

Apply latest-share-wins after owner validation and before returning the new raw link. Add a repository helper that revokes active, unexpired, unrevoked shares for the same `ownerId` + `vaultItemId`, then insert safe `revoked` audit events for old share ids. Do not include raw token, raw access code, token hash, access-code hash, account, password, OTP seed, or full URL in audit metadata.

**Public access generic failure pattern** (lines 264-307):
```typescript
async resolveShareAccess(input: ResolveShareAccessInput): Promise<ShareAccessDecision> {
    const now = input.now ?? Date.now();
    const pepper = getShareSecretPepper(this.env);
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
        return { accessible: false, status: 'expired', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
    }

    const vaultItem = await this.vaultRepository.findActiveByIdForOwner(share.vaultItemId, share.ownerId);
    if (!vaultItem) {
        return { accessible: false, status: 'revoked', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
    }

    const accessCode = input.accessCode || '';
    const accessCodeOk = await verifyShareSecret(pepper, 'share-access-code', accessCode, share.accessCodeHash);
    if (!accessCodeOk) {
        return { accessible: false, status: 'active', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
    }
}
```

### `src/shared/db/repositories/shareRepository.ts` (repository, CRUD)

**Analog:** `src/shared/db/repositories/shareRepository.ts`

**Imports pattern** (lines 1-12):
```typescript
import { and, count, desc, eq, gt, isNull, lt, lte, sql } from 'drizzle-orm';
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
import { type ShareRateLimitDecision, type ShareRateLimitInput } from '@/features/share/shareTypes';
```

**Create/find/list pattern** (lines 17-46):
```typescript
async createShareLink(input: NewShareLink): Promise<ShareLink> {
    await this.db.insert(shareLinks).values(input);
    return await this.findByIdForOwner(input.id as string, input.ownerId as string) as ShareLink;
}

async findByTokenHash(tokenHash: string): Promise<ShareLink | null> {
    const result = await this.db
        .select()
        .from(shareLinks)
        .where(eq(shareLinks.tokenHash, tokenHash))
        .limit(1);
    return result[0] || null;
}

async listForOwner(ownerId: string): Promise<ShareLink[]> {
    return await this.db
        .select()
        .from(shareLinks)
        .where(eq(shareLinks.ownerId, ownerId))
        .orderBy(desc(shareLinks.createdAt));
}
```

**Single revoke pattern to generalize** (lines 48-60):
```typescript
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

For latest-share-wins, copy this update shape into a new owner+vault helper. The condition should include `eq(shareLinks.ownerId, ownerId)`, `eq(shareLinks.vaultItemId, vaultItemId)`, `isNull(shareLinks.revokedAt)`, and `gt(shareLinks.expiresAt, revokedAt)`. If the helper needs ids for audit events, select matching rows before update and return them.

**Cleanup query pattern for active/expired predicates** (lines 76-80):
```typescript
async findExpiredSharesForCleanup(now: number): Promise<ShareLink[]> {
    return await this.db
        .select()
        .from(shareLinks)
        .where(and(lte(shareLinks.expiresAt, now), isNull(shareLinks.revokedAt)));
}
```

### `src/features/share/shareRoutes.ts` (route/controller, request-response)

**Analog:** `src/features/share/shareRoutes.ts`

**Imports and factory pattern** (lines 1-10):
```typescript
import { Hono } from 'hono';
import { EnvBindings } from '@/app/config';
import { authMiddleware } from '@/shared/middleware/auth';
import { createShareService } from '@/features/share/shareService';
import { getSharePublicHeaders } from '@/features/share/shareSecurity';
import { shareRateLimit } from '@/shared/middleware/shareRateLimitMiddleware';

const share = new Hono<{ Bindings: EnvBindings, Variables: { user: any } }>();

const getService = (c: any) => createShareService(c.env);
```

**Owner create route pattern** (lines 12-34):
```typescript
share.post('/', authMiddleware, async (c) => {
    const user = c.get('user');
    const ownerId = user.email || user.id;
    const body = await c.req.json().catch(() => ({}));

    if (typeof body.vaultItemId !== 'string' || body.vaultItemId.trim() === '') {
        return c.json({ success: false, error: 'vaultItemId is required' }, 400);
    }

    const publicOrigin = c.env.NODEAUTH_PUBLIC_ORIGIN || new URL(c.req.url).origin;
    const service = getService(c);
    const ttlSeconds = Number.isFinite(body.ttlSeconds) ? body.ttlSeconds : undefined;
    const expiresAt = Number.isFinite(body.expiresAt) ? body.expiresAt : undefined;
    const share = await service.createShareForOwner({
        ownerId,
        vaultItemId: body.vaultItemId,
        ttlSeconds,
        expiresAt,
        publicOrigin,
    });

    return c.json({ success: true, share });
});
```

Add a batch owner route beside this pattern, e.g. `POST /api/share/batch`. Validate `vaultItemIds` as a non-empty array of strings, derive `ownerId` only from `c.get('user')`, and pass `publicOrigin`, finite TTL, and finite expiration through to the service. Return per-row success objects with one-time `rawToken` and `rawAccessCode`, and per-row generic failures.

**Owner list/detail/revoke pattern** (lines 36-65):
```typescript
share.get('/', authMiddleware, async (c) => {
    const user = c.get('user');
    const ownerId = user.email || user.id;
    const service = getService(c);
    const shares = await service.listSharesForOwner(ownerId);

    return c.json({ success: true, shares });
});

share.delete('/:id', authMiddleware, async (c) => {
    const user = c.get('user');
    const ownerId = user.email || user.id;
    const service = getService(c);
    const share = await service.revokeShareForOwner(ownerId, c.req.param('id'));

    return c.json({
        success: true,
        share,
        message: 'Share link revoked. Future access is blocked, but NodeAuth cannot retract credentials already viewed or copied.',
    });
});
```

**Public access route pattern** (lines 67-87):
```typescript
share.post('/public/:token/access', shareRateLimit(), async (c) => {
    const token = c.req.param('token');
    const body = await c.req.json().catch(() => ({}));
    const accessCode = typeof body.accessCode === 'string' ? body.accessCode : undefined;
    const service = getService(c);
    const decision = await service.resolveShareAccess({
        token,
        accessCode,
        requestOrigin: new URL(c.req.url).origin,
    });

    for (const [name, value] of Object.entries(decision.publicHeaders || getSharePublicHeaders())) {
        c.header(name, value);
    }

    if (!decision.accessible) {
        return c.json({ success: false, message: 'share_inaccessible', data: null }, 404);
    }

    return c.json({ success: true, data: decision.itemView });
});
```

### `src/features/share/shareTypes.ts` (model/type, transform)

**Analog:** `src/features/share/shareTypes.ts`

**Safe DTO pattern** (lines 14-46):
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

export interface OwnerShareMetadataView {
    id: string;
    item: OwnerShareItemReferenceView;
    status: ShareStatus;
    createdAt: string;
    expiresAt: string;
    revokedAt: string | null;
    lastAccessedAt: string | null;
    accessCount: number;
    publicUrl?: string;
}

export interface OwnerShareCreatedView extends OwnerShareMetadataView {
    rawToken: string;
    rawAccessCode: string;
}
```

Batch DTOs should preserve the same allowlist: success rows may include `OwnerShareCreatedView` exactly once; metadata/list rows must not include `rawToken` or `rawAccessCode`; failure rows should use only the requested owner-scoped item id or safe item label plus a generic error such as `share_item_inaccessible` / `could_not_create_share`.

### `src/features/share/shareService.test.ts` (test, request-response + security validation)

**Analog:** `src/features/share/shareService.test.ts`

**Mock setup pattern** (lines 100-127):
```typescript
describe('ShareService', () => {
    let vaultRepository: any;
    let shareRepository: any;
    let service: ShareService;

    beforeEach(() => {
        vaultRepository = {
            findActiveByIdForOwner: vi.fn(),
        };
        shareRepository = {
            createShareLink: vi.fn(),
            findByTokenHash: vi.fn(),
            findByIdForOwner: vi.fn(),
            listForOwner: vi.fn(),
            revokeForOwner: vi.fn(),
            markAccessed: vi.fn(),
            insertAuditEvent: vi.fn(),
            enforceRateLimit: vi.fn(),
            findExpiredSharesForCleanup: vi.fn(),
            insertExpiredAuditEventIfMissing: vi.fn(),
            deleteStaleRateLimits: vi.fn(),
        };
        service = new ShareService(
            { SHARE_SECRET_PEPPER: 'pepper', JWT_SECRET: 'jwt' } as any,
            vaultRepository,
            shareRepository,
        );
    });
});
```

Add new repository mock methods here before testing latest-share-wins, e.g. `revokeActiveForOwnerVaultItem: vi.fn()`.

**Stored secrets test pattern** (lines 160-191):
```typescript
it('stores only hashed share secrets', async () => {
    vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem());
    shareRepository.createShareLink.mockResolvedValue({
        id: 'share-1',
        vaultItemId: 'vault-1',
        ownerId: 'owner-1',
        tokenHash: 'stored-token-hash',
        accessCodeHash: 'stored-access-code-hash',
        expiresAt: 2000,
        revokedAt: null,
        createdAt: 1000,
        lastAccessedAt: null,
        accessCount: 0,
    });

    const result = await service.createShare({
        ownerId: 'owner-1',
        vaultItemId: 'vault-1',
        now: 1000,
        expiresAt: 2000,
    } as any);

    expect(result.rawToken).toBeTruthy();
    expect(result.rawAccessCode).toBeTruthy();
    const createInput = shareRepository.createShareLink.mock.calls[0][0];
    expect(createInput.tokenHash).not.toBe(result.rawToken);
    expect(createInput.accessCodeHash).not.toBe(result.rawAccessCode);
});
```

Add a latest-share-wins service test next to this: mock an older active share returned by the new revoke helper, assert the helper is called with `ownerId`, `vaultItemId`, and `now`, assert old-share audit metadata is safe, and assert the new raw secrets are returned only for the newly created share.

**Public inaccessible test pattern** (lines 420-449):
```typescript
it('revoked share resolves inaccessible without secret processing', async () => {
    const rawToken = 'raw-public-token-123';
    const decryptSpy = vi.spyOn(dbModule, 'decryptField');
    const generateSpy = vi.spyOn(otpModule, 'generate');
    shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord({ revokedAt: 1000 }));

    const decision = await service.resolveShareAccess({
        token: rawToken,
        accessCode: 'correct-code',
        now: 1000,
    } as any);

    expectPublicInaccessibleDecision(decision, rawToken);
    expect(decision.status).toBe('revoked');
    expect(decryptSpy).not.toHaveBeenCalled();
    expect(generateSpy).not.toHaveBeenCalled();
});
```

Use this to prove the older link created before regeneration is inaccessible after latest-share-wins revocation.

### `src/features/share/shareRoutes.test.ts` (test, request-response)

**Analog:** `src/features/share/shareRoutes.test.ts`

**Hoisted route mocks pattern** (lines 6-38):
```typescript
const mocks = vi.hoisted(() => {
    const authMiddleware = vi.fn(async (c: any, next: any) => {
        c.set('user', { id: 'user-id-1', email: 'owner@example.com' });
        await next();
    });
    const createShareForOwner = vi.fn();
    const listSharesForOwner = vi.fn();
    const getShareForOwner = vi.fn();
    const revokeShareForOwner = vi.fn();
    const resolveShareAccess = vi.fn();
    const createShareService = vi.fn(() => ({
        createShareForOwner,
        listSharesForOwner,
        getShareForOwner,
        revokeShareForOwner,
        resolveShareAccess,
    }));

    return {
        authMiddleware,
        createShareForOwner,
        listSharesForOwner,
        getShareForOwner,
        revokeShareForOwner,
        resolveShareAccess,
        createShareService,
    };
});
```

Add `createSharesForOwnerBatch` or equivalent to this hoisted block and service object before testing the new batch route.

**Owner privacy allowlist pattern** (lines 77-111):
```typescript
const expectOwnerResponseIsSafe = (value: unknown, allowCreateSecrets = false) => {
    const serialized = JSON.stringify(value);
    expect(serialized).not.toContain('tokenHash');
    expect(serialized).not.toContain('accessCodeHash');
    expect(serialized).not.toContain('ownerId');
    expect(serialized).not.toContain('session');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('seed');
    expect(serialized).not.toContain('otpauth');
    expect(serialized).not.toContain('backup');
    expect(serialized).not.toContain('password');

    if (!allowCreateSecrets) {
        expect(serialized).not.toContain('rawToken');
        expect(serialized).not.toContain('rawAccessCode');
    }
};

const expectOwnerMetadataAllowlist = (share: any, includeCreateSecrets = false) => {
    const expectedKeys = includeCreateSecrets
        ? [...ownerMetadataKeys, 'rawAccessCode', 'rawToken'].sort()
        : ownerMetadataKeys;
    expect(Object.keys(share).sort()).toEqual(expectedKeys);
    expect(Object.keys(share.item).sort()).toEqual(ownerItemKeys);
};
```

Use this exact allowlist for batch success rows, with a separate allowlist for failure rows. Partial failures must not include inaccessible vault service/account labels unless they were owner-scoped and safely resolved.

**Hono `app.request` route test pattern** (lines 123-165):
```typescript
const app = makeApp();
const response = await app.request('https://nodeauth.test/api/share', {
    method: 'POST',
    body: JSON.stringify({
        ownerId: 'attacker@example.com',
        vaultItemId: 'vault-1',
        ttlSeconds: 3600,
    }),
    headers: {
        'Content-Type': 'application/json',
    },
}, {
    NODEAUTH_PUBLIC_ORIGIN: 'https://shares.example',
} as any);
const body = await response.json();

expect(response.status).toBe(200);
expect(mocks.createShareForOwner).toHaveBeenCalledWith({
    ownerId: 'owner@example.com',
    vaultItemId: 'vault-1',
    ttlSeconds: 3600,
    expiresAt: undefined,
    publicOrigin: 'https://shares.example',
});
expectOwnerResponseIsSafe(body, true);
```

Batch route tests should follow this shape: attacker-supplied `ownerId` is ignored; finite TTL/expires values are forwarded; missing or empty id arrays return `400`; success and partial-failure responses are privacy-allowlisted.

### `src/shared/db/repositories/shareRepository.test.ts` (test, CRUD)

**Analog:** `src/shared/db/repositories/shareRepository.test.ts`

**Drizzle mock pattern** (lines 1-16):
```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('drizzle-orm', async () => {
    const actual = await vi.importActual<any>('drizzle-orm');
    return {
        ...actual,
        lte: vi.fn(() => 'lte-cond'),
        lt: vi.fn(() => 'lt-cond'),
        isNull: vi.fn(() => 'is-null-cond'),
        count: vi.fn(() => 'count-sql'),
    };
});

import * as drizzle from 'drizzle-orm';
import { shareAuditEvents, shareLinks, shareRateLimits } from '@/shared/db/schema/index';
import { ShareRepository } from '@/shared/db/repositories/shareRepository';
```

Add `gt` to this mock when testing active-share revocation by expiration.

**DB mock pattern** (lines 18-44):
```typescript
function createDbMock() {
    const selectWhere = vi.fn();
    const selectLimit = vi.fn();
    const selectFrom = vi.fn(() => ({ where: selectWhere, limit: selectLimit }));
    const select = vi.fn(() => ({ from: selectFrom }));

    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn(() => ({ values: insertValues }));

    const deleteWhere = vi.fn().mockResolvedValue({ success: true });
    const deleteFn = vi.fn(() => ({ where: deleteWhere }));

    return {
        db: {
            select,
            insert,
            delete: deleteFn,
        },
        select,
        selectFrom,
        selectWhere,
        selectLimit,
        insert,
        insertValues,
        deleteFn,
        deleteWhere,
    };
}
```

Extend this mock with `update`, `set`, and `where` for the new repository revoke helper, mirroring the update call chain in `shareRepository.ts` lines 54-57.

### Frontend source files (component/page/navigation, event-driven + request-response)

**Analog:** no editable source analog. Generated evidence only:

| Evidence | Lines / Match | Pattern |
|----------|---------------|---------|
| `frontend/dist/assets/index-936a7cdd.js` | `app_active_tab` at line 5371; setter at 5406; exposed state at 5430 | Existing navigation state uses `sessionStorage` key `app_active_tab`. |
| `frontend/dist/assets/vaultList-88fb41a5.js` | `/api/share` at lines 2872 and 2896; revoke at 2945; selected IDs at 2977; `selectAllLoaded` at 2988; `handleBulkDelete` at 2989 | Existing generated vault page already has single-share and selection behavior. |

Do not make generated `frontend/dist/assets/*.js` chunks the primary edit target. The planner should require restored editable frontend source, then map the future implementation to:

| Implied Source File | Role | Data Flow | Required Pattern |
|---------------------|------|-----------|------------------|
| `frontend/src/.../ManageShares*.vue` | component/page | request-response | Fetch `GET /api/share`, render only `OwnerShareMetadataView`, group by item, show no access-code recovery action. |
| `frontend/src/.../navigation/home*.vue` | component/navigation | event-driven | Add `Manage Shares` as an authenticated first-level tab using existing `app_active_tab` pattern. |
| `frontend/src/.../vaultList*.vue` | component | event-driven + request-response | Preserve `selectedIds` and `selectAllLoaded`; add `Share` between `Delete` and `Cancel`; call batch API online-only. |

### Generated backend bundles (build output)

**Analogs:** `backend/scripts/build-worker.js`, `backend/scripts/build-docker.js`, `backend/scripts/build-netlify.js`, `backend/package.json`

**Build command declarations** (`backend/package.json` lines 4-11):
```json
"scripts": {
  "dev": "wrangler dev --config ../wrangler.dev.toml --ip 0.0.0.0 --port 8787 --test-scheduled",
  "deploy": "wrangler deploy --minify ./src/app/worker.ts",
  "build:docker": "node scripts/build-docker.js",
  "build:worker": "node scripts/build-worker.js",
  "build:netlify": "node scripts/build-netlify.js",
  "build:vercel": "node scripts/build-vercel.js",
  "test": "vitest run"
}
```

**Worker build pattern** (`backend/scripts/build-worker.js` lines 22-39):
```javascript
const result = spawnSync('npx', [
    'tsup',
    '--entry.worker',
    '../src/app/worker.ts',
    '--out-dir',
    'dist/worker',
    '--format',
    'esm',
    '--sourcemap',
    '--target',
    'es2022',
    '--clean',
    '--no-splitting',
    '--platform',
    'neutral',
    '--external',
    'cloudflare:sockets',
], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
});
```

**Docker build pattern** (`backend/scripts/build-docker.js` lines 22-39):
```javascript
const result = spawnSync('npx', [
    'tsup',
    '--entry.server',
    '../src/app/server.ts',
    '--out-dir',
    'dist/docker',
    '--format',
    'esm',
    '--sourcemap',
    '--target',
    'es2022',
    '--clean',
    '--no-splitting',
    '--platform',
    'node',
    '--external',
    'cloudflare:sockets',
], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
});
```

**Netlify build pattern** (`backend/scripts/build-netlify.js` lines 22-55):
```javascript
const result = spawnSync('npx', [
    'tsup',
    '--entry.api',
    '../src/app/netlify.ts',
    '--out-dir',
    'dist/netlify',
    '--format',
    'esm',
    '--sourcemap',
    '--target',
    'es2022',
    '--clean',
    '--no-splitting',
    '--platform',
    'node',
    '--external',
    'cloudflare:sockets',
], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
});

renameSync('dist/netlify/api.js', 'dist/netlify/api.mjs');
renameSync('dist/netlify/api.js.map', 'dist/netlify/api.mjs.map');
normalizeSourceMap('dist/netlify/api.mjs.map');

const apiOutput = readFileSync('dist/netlify/api.mjs', 'utf8')
    .replace('//# sourceMappingURL=api.js.map', '//# sourceMappingURL=api.mjs.map');
writeFileSync('dist/netlify/api.mjs', apiOutput);
```

Run `cd backend && npm run build:worker && npm run build:docker && npm run build:netlify` after backend source changes. `backend/package.json` declares `build:vercel`, and `backend/dist/vercel/index.mjs` exists, but `backend/scripts/build-vercel.js` is absent in this checkout; planner must treat Vercel regeneration as blocked until that script is restored or created in a separate planned step.

## Shared Patterns

### Authentication

**Source:** `src/features/share/shareRoutes.ts` lines 12-15 and `src/features/vault/vaultRoutes.ts` lines 24-36

Apply to all owner share routes:
```typescript
share.post('/', authMiddleware, async (c) => {
    const user = c.get('user');
    const ownerId = user.email || user.id;
    const body = await c.req.json().catch(() => ({}));
});
```

Vault route module-wide auth analog:
```typescript
vault.use('/*', authMiddleware);

vault.get('/', async (c) => {
    const user = c.get('user');
    const service = getService(c);
    const result = await service.getAccountsPaginated(user.email || user.id, page, limit, search, category);
});
```

### Error Handling

**Source:** `src/app/index.ts` lines 202-227

Apply by throwing `AppError` from services and letting root `app.onError` format expected failures:
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

### Public Share Token Redaction

**Source:** `src/app/index.ts` lines 42-47 and 91-92

Apply if adding new public token paths:
```typescript
export function redactSharePublicToken(value: string): string {
    return value.replace(
        /\/api\/share\/public\/[^\s/?#]+\/access/g,
        '/api/share/public/[share-token]/access',
    );
}

app.use('*', hLogger((str) => logger.info(redactSharePublicToken(str))));
```

### Owner Vault Access Control

**Source:** `src/shared/db/repositories/vaultRepository.ts` lines 189-206

Use this owner-scoped lookup before creating any single or batch share:
```typescript
async findActiveByIdForOwner(id: string, ownerId: string): Promise<VaultItem | null> {
    const result = await this.db
        .select()
        .from(vault)
        .where(
            and(
                eq(vault.id, id),
                isNull(vault.deletedAt),
                or(isNull(vault.createdBy), eq(vault.createdBy, ownerId))
            )
        )
        .limit(1);

    return result[0] || null;
}
```

### Batch Size / Platform Compatibility

**Source:** `src/shared/db/repositories/vaultRepository.ts` lines 92-128 and 259-270

Use chunked loops for batch DB work; avoid platform-specific transaction assumptions unless already wrapped:
```typescript
const CHUNK_SIZE = 30;

for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);

    if (chunk.length === 1) {
        await this.db
            .update(vault)
            .set({ sortOrder: chunk[0].sortOrder })
            .where(eq(vault.id, chunk[0].id));
        continue;
    }

    const whenClauses = chunk.map(u => sql`WHEN ${u.id} THEN ${u.sortOrder}`);
    const caseExpr = sql`CASE ${vault.id} ${sql.join(whenClauses, sql` `)} ELSE ${vault.sortOrder} END`;

    await this.db
        .update(vault)
        .set({ sortOrder: caseExpr })
        .where(inArray(vault.id, chunk.map(u => u.id)));
}
```

### Test Commands

**Source:** `backend/vitest.config.ts` lines 4-25 and `04-VALIDATION.md`

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

Use:
```bash
cd backend && npm test -- ../src/features/share/shareService.test.ts ../src/features/share/shareRoutes.test.ts
cd backend && npm test
cd backend && npm run build:worker && npm run build:docker && npm run build:netlify
```

## No Analog Found

Files with no close maintainable source match in the codebase:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/src/.../ManageShares*.vue` | component/page | request-response | Editable frontend source is absent; only generated Vite chunks exist. |
| `frontend/src/.../navigation/home*.vue` | component/navigation | event-driven | Editable frontend source is absent; generated navigation chunk is evidence only. |
| `frontend/src/.../vaultList*.vue` | component | event-driven + request-response | Editable frontend source is absent; generated vault chunk is evidence only. |
| `backend/scripts/build-vercel.js` | build script | build output | `backend/package.json` declares `build:vercel`, but this script is missing. |

## Metadata

**Analog search scope:** `src/features/share`, `src/shared/db/repositories`, `src/features/vault`, `src/app`, `backend/scripts`, `backend/package.json`, `backend/vitest.config.ts`, generated `frontend/dist/assets` evidence.

**Files scanned:** 5 planning artifacts/context sources, 13 source/test/config files, 4 build/output paths, generated frontend evidence files.

**Pattern extraction date:** 2026-05-04
