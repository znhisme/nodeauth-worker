# Phase 1: Foundation and Security Primitives - Pattern Map

**Mapped:** 2026-05-03
**Files analyzed:** 4
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/features/share/shareService.ts` | service | request-response / CRUD | `src/features/share/shareService.ts` existing create/revoke audit paths | exact |
| `src/shared/middleware/shareRateLimitMiddleware.ts` | middleware | request-response | `src/shared/middleware/shareRateLimitMiddleware.ts` existing fail-closed limiter | exact |
| `src/features/share/shareService.test.ts` | test | request-response / CRUD | `src/features/share/shareService.test.ts` existing safety and revoke audit tests | exact |
| `src/shared/middleware/shareRateLimitMiddleware.test.ts` | test | request-response | `src/shared/middleware/shareRateLimitMiddleware.test.ts` existing denial and raw-token safety tests | exact |

## Pattern Assignments

### `src/features/share/shareService.ts` (service, request-response / CRUD)

**Analog:** `src/features/share/shareService.ts`

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

**Safe audit insert pattern** (lines 81-94):
```typescript
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
```

**Revocation audit pattern** (lines 115-131):
```typescript
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
```

**Resolve decision pattern to extend** (lines 134-174):
```typescript
const now = input.now ?? Date.now();
const pepper = getShareSecretPepper(this.env);
const publicHeaders = getSharePublicHeaders();
const tokenHash = await hashShareSecret(pepper, 'share-token', input.token);
const share = await this.shareRepository.findByTokenHash(tokenHash);

if (!share) {
    return { accessible: false, status: 'revoked', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
}

if (share.expiresAt <= now) {
    return { accessible: false, status: 'expired', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
}
```

**Planner guidance:**
- Add `expired` audit insertion in the `share.expiresAt <= now` branch after a real share row is found. Use `share.id`, `share.ownerId`, `actorType: 'system'`, and metadata limited to timestamps/status. Do not include `input.token`, `input.accessCode`, `publicUrl`, vault secret data, or full request URL.
- Add `access_granted` audit insertion on the success path after access-code verification and active vault-item check. Call `markAccessed(share.id, now)` there as the existing repository already has the primitive.
- Keep all inaccessible public decisions generic with `share: null`, `itemView: null`, and `publicHeaders`.

### `src/shared/middleware/shareRateLimitMiddleware.ts` (middleware, request-response)

**Analog:** `src/shared/middleware/shareRateLimitMiddleware.ts`

**Imports pattern** (lines 1-10):
```typescript
import { Context, Next } from 'hono';
import { AppError, type EnvBindings } from '@/app/config';
import { ShareRepository } from '@/shared/db/repositories/shareRepository';
import {
    SHARE_RATE_LIMIT_LOCK_MS,
    SHARE_RATE_LIMIT_MAX_ATTEMPTS,
    SHARE_RATE_LIMIT_WINDOW_MS,
} from '@/features/share/shareTypes';
import { getShareSecretPepper, hashShareSecret } from '@/features/share/shareSecurity';
import { logger } from '@/shared/utils/logger';
```

**Fail-closed limiter pattern** (lines 20-48):
```typescript
try {
    const rawToken = c.req.param('token') || '';
    const pepper = getShareSecretPepper(c.env);
    const tokenHash = rawToken ? await hashShareSecret(pepper, 'share-token', rawToken) : 'missing-token';
    const key = options?.keyBuilder
        ? options.keyBuilder(c)
        : [
            'share',
            c.req.header('CF-Connecting-IP') || 'unknown',
            c.req.path,
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

    if (!decision.allowed) {
        logger.warn('[ShareRateLimit] access blocked');
        throw new AppError('share_inaccessible', 404);
    }
} catch {
    logger.warn('[ShareRateLimit] access blocked');
    throw new AppError('share_inaccessible', 404);
}
```

**Planner guidance:**
- Extend the `!decision.allowed` branch to write `access_denied_threshold` before throwing.
- Reuse `tokenHash` and `repository.findByTokenHash(tokenHash)` to get safe `share.id` and `share.ownerId` when a share exists. If no share row exists, keep the same generic denial and do not fabricate an audit row because `share_audit_events.owner_id` is required.
- Audit metadata may include `attempts`, `lockedUntil`, and `windowMs`. It must not include `rawToken`, `c.req.path` if it contains the token, full URL, access code, password, TOTP seed, or headers.
- Preserve fail-closed behavior for missing DB and repository errors.

### `src/features/share/shareService.test.ts` (test, request-response / CRUD)

**Analog:** `src/features/share/shareService.test.ts`

**Mock repository pattern** (lines 56-68):
```typescript
shareRepository = {
    createShareLink: vi.fn(),
    findByTokenHash: vi.fn(),
    findByIdForOwner: vi.fn(),
    revokeForOwner: vi.fn(),
    markAccessed: vi.fn(),
    insertAuditEvent: vi.fn(),
    enforceRateLimit: vi.fn(),
};
```

**Recipient safety assertion pattern** (lines 38-49):
```typescript
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
```

**Successful access test pattern to extend** (lines 240-262):
```typescript
const accessCode = 'correct-code';
const accessCodeHash = await hashShareSecret('pepper', 'share-access-code', accessCode);
shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord({ accessCodeHash }));
vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem());

const decision = await service.resolveShareAccess({
    token: 'token',
    accessCode,
    requestOrigin: 'https://example.com',
    now: 1000,
} as any);

expect(decision).toMatchObject({
    accessible: true,
    status: 'active',
});
expectRecipientSafeDecision(decision);
```

**Existing safe audit assertion pattern** (lines 264-279):
```typescript
expect(shareRepository.insertAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
    eventType: 'revoked',
    actorType: 'owner',
    shareId: 'share-1',
}));
expect(JSON.stringify(shareRepository.insertAuditEvent.mock.calls[0][0])).not.toContain('rawToken');
expect(JSON.stringify(shareRepository.insertAuditEvent.mock.calls[0][0])).not.toContain('rawAccessCode');
expect(JSON.stringify(shareRepository.insertAuditEvent.mock.calls[0][0])).not.toContain('password');
expect(JSON.stringify(shareRepository.insertAuditEvent.mock.calls[0][0])).not.toContain('seed');
```

**Planner guidance:**
- Add regression tests for `access_granted` and `expired` audit insertions in `resolveShareAccess()`.
- Assert `markAccessed('share-1', now)` is called on successful access, if implementing the existing repository primitive at the same time.
- For every new audit test, serialize the audit input and assert it does not contain raw token, access code, password, seed, otpauth URI, or full URL.

### `src/shared/middleware/shareRateLimitMiddleware.test.ts` (test, request-response)

**Analog:** `src/shared/middleware/shareRateLimitMiddleware.test.ts`

**Context factory pattern** (lines 6-27):
```typescript
const makeContext = (overrides: any = {}) => {
    const defaultEnv = {
        DB: {},
        SHARE_SECRET_PEPPER: 'pepper',
        JWT_SECRET: 'jwt',
    };
    return {
        env: {
            ...defaultEnv,
            ...(overrides.env || {}),
        },
        req: {
        header: vi.fn((name: string) => (name === 'CF-Connecting-IP' ? '1.2.3.4' : null)),
        path: '/share/token',
        param: vi.fn((name: string) => (name === 'token' ? 'token-1' : undefined)),
        },
        ...overrides,
    };
};
```

**Denied decision test pattern** (lines 52-69):
```typescript
vi.spyOn(ShareRepository.prototype, 'enforceRateLimit').mockResolvedValue({
    allowed: false,
    attempts: 6,
    lockedUntil: Date.now(),
});
await expect(middleware(ctx as any, vi.fn())).rejects.toMatchObject({ message: 'share_inaccessible' });
```

**Raw-token persistence safety pattern** (lines 88-112):
```typescript
const rawToken = 'raw-public-token-123';
const enforceRateLimit = vi.spyOn(ShareRepository.prototype, 'enforceRateLimit').mockResolvedValue({
    allowed: true,
    attempts: 1,
    lockedUntil: null,
});

await middleware(ctx as any, vi.fn());

const input = enforceRateLimit.mock.calls[0][0];
expect(input.key).not.toContain(rawToken);
expect(input.shareId).not.toContain(rawToken);
expect(input.key).toMatch(/^share:1\.2\.3\.4:\/api\/share\/public:[A-Za-z0-9_-]+$/);
expect(input.shareId).toMatch(/^[A-Za-z0-9_-]+$/);
```

**Planner guidance:**
- Add a denied-threshold audit test by spying on `ShareRepository.prototype.findByTokenHash` and `insertAuditEvent`.
- Assert the thrown error remains `share_inaccessible`.
- Assert the audit event is `eventType: 'access_denied_threshold'`, `actorType: 'recipient'`, and uses the real share id/owner id from the hashed-token lookup.
- Assert serialized audit input does not contain the raw token, full path containing token, access code, password, seed, or URL.

## Shared Patterns

### Share Repository Persistence

**Source:** `src/shared/db/repositories/shareRepository.ts`
**Apply to:** service and middleware audit writes

**Repository imports and table access** (lines 1-12):
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

**Existing helpers to reuse** (lines 22-65):
```typescript
async findByTokenHash(tokenHash: string): Promise<ShareLink | null> {
    const result = await this.db
        .select()
        .from(shareLinks)
        .where(eq(shareLinks.tokenHash, tokenHash))
        .limit(1);
    return result[0] || null;
}

async markAccessed(id: string, accessedAt: number): Promise<void> {
    await this.db
        .update(shareLinks)
        .set({
            lastAccessedAt: accessedAt,
            accessCount: sql<number>`coalesce(${shareLinks.accessCount}, 0) + 1`,
        })
        .where(eq(shareLinks.id, id));
}

async insertAuditEvent(input: NewShareAuditEvent): Promise<void> {
    await this.db.insert(shareAuditEvents).values(input);
}
```

### Audit Schema Allowlist

**Source:** `backend/schema.sql`
**Apply to:** all share audit events

**Audit columns** (lines 91-101):
```sql
CREATE TABLE IF NOT EXISTS share_audit_events (
    id TEXT PRIMARY KEY,
    share_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    event_at INTEGER NOT NULL,
    owner_id TEXT NOT NULL,
    ip_hash TEXT,
    user_agent_hash TEXT,
    metadata TEXT
);
```

### Security Contract

**Source:** `docs/share-link-security-contract.md`
**Apply to:** service, middleware, and tests

**Audit/logging rule** (lines 33-37):
```markdown
- Audit and log records must never include raw share tokens, raw access codes, full share URLs, passwords, TOTP seeds, otpauth URIs, session cookies, backup payloads, or owner email.
- Audit events may record status transitions such as created, access granted, access denied due to threshold, expired, and revoked.
- Derived identifiers may be logged only when they cannot be reversed into raw secrets.
```

**Fail-closed limiter rule** (lines 53-58):
```markdown
- Share access attempts must be rate limited per share and per access code.
- The limiter must fail closed on storage, parsing, or lookup errors.
- Failed threshold checks are security events and must not expose the underlying share content.
- The limiter window is 15 minutes with a maximum of 5 attempts before lockout.
```

### Central Error Handling

**Source:** `src/app/index.ts`
**Apply to:** share service and share middleware

**Global AppError conversion** (lines 136-160):
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

### Owner/Deleted-Item Guard

**Source:** `src/shared/db/repositories/vaultRepository.ts`
**Apply to:** successful and deleted-item share access checks

**Owner-accessible active item lookup** (lines 189-206):
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

## No Analog Found

None. The gap closes by extending existing Phase 1 share primitives and tests. No new source module is required by the current verification gap.

## Metadata

**Analog search scope:** `src/features/share`, `src/shared/middleware`, `src/shared/db/repositories`, `src/features/vault`, `src/app`, `backend/schema.sql`, `docs/share-link-security-contract.md`
**Files scanned:** 12 focused files plus phase research/verification/roadmap/requirements
**Pattern extraction date:** 2026-05-03

