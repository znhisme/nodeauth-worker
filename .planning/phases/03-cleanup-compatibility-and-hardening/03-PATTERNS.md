# Phase 03: Cleanup, Compatibility, and Hardening - Pattern Map

**Mapped:** 2026-05-03  
**Files analyzed:** 17  
**Analogs found:** 16 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/shared/db/repositories/shareRepository.ts` | repository | CRUD + batch cleanup | `src/shared/db/repositories/sessionRepository.ts` + existing share repository methods | exact |
| `src/features/share/shareService.ts` | service | CRUD + transform + event-driven audit + batch cleanup | existing `src/features/share/shareService.ts` + `src/features/auth/sessionService.ts` | exact |
| `src/features/share/shareTypes.ts` | model/DTO | transform | existing `src/features/share/shareTypes.ts` | exact |
| `src/app/worker.ts` | runtime entrypoint | scheduled + request-response | existing Worker migration/backup scheduled hook | exact |
| `src/app/server.ts` | runtime entrypoint | scheduled + request-response + file-I/O | existing Docker `node-cron` backup hook | exact |
| `src/app/netlify.ts` | runtime entrypoint | request-response + opportunistic batch | existing Netlify cached DB/migration handler | role-match |
| `src/shared/db/migrator.ts` | migration/config | batch SQL transform | existing migration 13 share table block and MySQL index-prefix patterns | exact |
| `scripts/validate_share_schema_alignment.js` | utility/script | file-I/O + validation | existing schema alignment validator | exact |
| `docs/share-link-security-contract.md` | documentation | contract/static | existing security contract sections | exact |
| `src/features/share/shareService.test.ts` | test | CRUD + transform + event-driven audit | existing share service hardening tests | exact |
| `src/features/share/shareRoutes.test.ts` | test | request-response | existing Hono share route tests | exact |
| `src/shared/middleware/shareRateLimitMiddleware.test.ts` | test | request-response + rate-limit state | existing fail-closed limiter tests | exact |
| `src/app/index.test.ts` | test | source-contract + request-response + logging/privacy | existing app source-contract tests | exact |
| `src/shared/db/repositories/shareRepository.test.ts` | test | CRUD + batch cleanup | `src/features/share/shareService.test.ts` + `src/shared/db/repositories/sessionRepository.ts` | role-match |
| `backend/dist/worker/worker.js` and `.map` | generated artifact | batch/transform | `backend/scripts/build-worker.js` | generated |
| `backend/dist/docker/server.js` and `.map` | generated artifact | batch/transform | `backend/scripts/build-docker.js` | generated |
| `backend/dist/netlify/api.mjs` and `.map` | generated artifact | batch/transform | `backend/scripts/build-netlify.js` | generated |

## Pattern Assignments

### `src/shared/db/repositories/shareRepository.ts` (repository, CRUD + batch cleanup)

**Analog:** `src/shared/db/repositories/sessionRepository.ts` and existing `shareRepository.ts`

**Imports pattern** (`src/shared/db/repositories/shareRepository.ts` lines 1-12):
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
import { type ShareRateLimitDecision, type ShareRateLimitInput } from '@/features/share/shareTypes';
```

For cleanup deletes, add `lt` to the Drizzle import, matching the session repository.

**Existing share update/count pattern** (`src/shared/db/repositories/shareRepository.ts` lines 62-73):
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

async insertAuditEvent(input: NewShareAuditEvent): Promise<void> {
    await this.db.insert(shareAuditEvents).values(input);
}
```

Use this style for any idempotent expired-share marking/auditing primitive. Return counts only; do not return secret-bearing rows from cleanup APIs.

**Batch cleanup analog** (`src/shared/db/repositories/sessionRepository.ts` lines 90-100):
```typescript
async cleanupExpired(cutoffTimestamp: number): Promise<number> {
    const conditions = lt(authSessions.lastActiveAt, cutoffTimestamp);

    const countRes = await this.db.select().from(authSessions).where(conditions);

    await this.db
        .delete(authSessions)
        .where(conditions);

    return countRes.length;
}
```

Use the same select-then-delete pattern for `deleteStaleRateLimits(cutoffTimestamp): Promise<number>`, using `lt(shareRateLimits.lastAttemptAt, cutoffTimestamp)`.

**Owner-scope guard pattern** (`src/shared/db/repositories/shareRepository.ts` lines 31-38, 48-59):
```typescript
async findByIdForOwner(id: string, ownerId: string): Promise<ShareLink | null> {
    const result = await this.db
        .select()
        .from(shareLinks)
        .where(and(eq(shareLinks.id, id), eq(shareLinks.ownerId, ownerId)))
        .limit(1);
    return result[0] || null;
}
```

Wrong-owner tests should keep using owner-scoped repository calls instead of adding route-level bypasses.

---

### `src/features/share/shareService.ts` (service, CRUD + transform + event-driven audit + batch cleanup)

**Analog:** existing `shareService.ts` and `src/features/auth/sessionService.ts`

**Imports and constructor pattern** (`src/features/share/shareService.ts` lines 1-27, 42-47):
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

export class ShareService {
    constructor(
        private env: EnvBindings,
        private vaultRepository: VaultRepository,
        private shareRepository: ShareRepository,
    ) {}
```

Keep cleanup inside this service so Worker, Docker, Netlify, and tests all call one method.

**DTO allowlist pattern** (`src/features/share/shareService.ts` lines 49-64):
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

Any cleanup result type should be an explicit allowlist such as `{ expiredAuditsInserted, staleRateLimitsDeleted }`; do not return rows.

**Expired audit analog** (`src/features/share/shareService.ts` lines 244-260):
```typescript
if (share.expiresAt <= now) {
    await this.shareRepository.insertAuditEvent({
        id: createId('share-audit'),
        shareId: share.id,
        eventType: 'expired',
        actorType: 'system',
        eventAt: now,
        ownerId: share.ownerId,
        ipHash: null,
        userAgentHash: null,
        metadata: toMetadata({
            expiredAt: now,
            expiresAt: share.expiresAt,
            status: 'expired',
        }),
    });
    return { accessible: false, status: 'expired', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
}
```

Use the same safe metadata shape for scheduled expired-share marking. If duplicate suppression is needed, implement it in repository/service cleanup instead of public route logic.

**Existing cleanup service analog** (`src/features/auth/sessionService.ts` lines 115-124):
```typescript
async cleanupZombieSessions(): Promise<number> {
    // TTL from ENV or default 30 days
    const ttlDays = this.env.SESSION_TTL_DAYS || 30;
    const cutoffTime = Date.now() - (ttlDays * 24 * 60 * 60 * 1000);

    return await this.repo.cleanupExpired(cutoffTime);
}
```

Add `cleanupShareState(now = Date.now())` with deterministic cutoff calculation and repository calls. Return counts; log only counts in runtime hooks.

**Service factory pattern** (`src/features/share/shareService.ts` lines 322-326):
```typescript
export function createShareService(env: EnvBindings, db: any = env.DB): ShareService {
    const vaultRepository = new VaultRepository(db);
    const shareRepository = new ShareRepository(db);
    return new ShareService(env, vaultRepository, shareRepository);
}
```

Runtime hooks should use this factory, passing the runtime Drizzle DB via `env.DB`.

---

### `src/features/share/shareTypes.ts` (model/DTO, transform)

**Analog:** existing share DTO and constants file

**Constants and audit enums** (`src/features/share/shareTypes.ts` lines 1-11):
```typescript
export const SHARE_TOKEN_BYTES = 32;
export const SHARE_ACCESS_CODE_BYTES = 16;
export const SHARE_DEFAULT_TTL_SECONDS = 24 * 60 * 60;
export const SHARE_MAX_TTL_SECONDS = 7 * 24 * 60 * 60;
export const SHARE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const SHARE_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const SHARE_RATE_LIMIT_LOCK_MS = 15 * 60 * 1000;

export type ShareStatus = 'active' | 'expired' | 'revoked';
export type ShareAuditEventType = 'created' | 'access_granted' | 'access_denied_threshold' | 'expired' | 'revoked';
export type ShareActorType = 'owner' | 'recipient' | 'system';
```

If adding cleanup retention constants or result interfaces, keep them here and keep audit event names stable.

**Public DTO allowlist** (`src/features/share/shareTypes.ts` lines 13-22, 118-125):
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

Cleanup result types must follow the same explicit DTO style and avoid raw IDs unless the caller is authenticated and needs them.

---

### `src/app/worker.ts` (runtime entrypoint, scheduled + request-response)

**Analog:** existing Worker migration and scheduled backup hook

**Fetch/migration pattern** (`src/app/worker.ts` lines 8-27):
```typescript
async fetch(request: Request, env: any, ctx: any) {
    // Initialize D1 driver
    const db = drizzle(env.DB, { schema });

    // 自愈性迁移逻辑：使用标准的 D1Executor
    const executor = new D1Executor(env.DB);

    // 生产环境使用 waitUntil 异步执行迁移检查
    ctx.waitUntil(migrateDatabase(executor));

    // Pass specialized DB and env vars to agnostic router
    const specializedEnv = {
        ...env,
        DB: db, // Replace D1 with Drizzle ORM instance
        ASSETS: env.ASSETS // Ensure ASSETS exists
    };

    return app.fetch(request, specializedEnv, ctx);
},
```

Do not put cleanup SQL in the Worker. Build `specializedEnv`, call `createShareService(specializedEnv).cleanupShareState()`, and run it in `ctx.waitUntil`.

**Scheduled hook pattern** (`src/app/worker.ts` lines 29-37):
```typescript
// Scheduled Backup trigger via Cloudflare Cron
async scheduled(event: any, env: any, ctx: any) {
    const db = drizzle(env.DB, { schema });
    const specializedEnv = {
        ...env,
        DB: db
    };
    ctx.waitUntil(handleScheduledBackup(specializedEnv));
}
```

Preserve backup. The planner should extend the waitUntil payload to run both backup and share cleanup, e.g. `ctx.waitUntil(Promise.all([...]))`.

---

### `src/app/server.ts` (runtime entrypoint, scheduled + request-response + file-I/O)

**Analog:** existing Docker cron and DB initialization

**DB/env setup pattern** (`src/app/server.ts` lines 38-75, 95-102):
```typescript
const { db, executor } = await DbFactory.create();

// ...
await migrateDatabase(executor);

const envTemplate = {
    DB: db,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',
    JWT_SECRET: process.env.JWT_SECRET || '',
    OAUTH_ALLOWED_USERS: process.env.OAUTH_ALLOWED_USERS || '',
    ...process.env
};
```

Use `envTemplate` when constructing `ShareService` for cron cleanup.

**Cron pattern** (`src/app/server.ts` lines 104-112):
```typescript
// 8. Cron Triggers (Daily at 2 AM)
cron.schedule('0 2 * * *', async () => {
    try {
        logger.info('[Cron] Triggering daily backup...');
        await handleScheduledBackup(envTemplate as any);
    } catch (e) {
        logger.error('[Cron] Backup failed:', e);
    }
});
```

Either add share cleanup inside this daily callback or add a second `cron.schedule` nearby. Log counts only, and keep backup failure logging intact.

**Hono waitUntil pattern** (`src/app/server.ts` lines 135-137):
```typescript
return app.fetch(req, env as any, {
    waitUntil: (p: Promise<any>) => p.catch((e: any) => logger.error('[Hono] waitUntil failed:', e))
} as any);
```

Use this existing error handling shape for any opportunistic cleanup triggered during Docker requests.

---

### `src/app/netlify.ts` (runtime entrypoint, request-response + opportunistic batch)

**Analog:** existing Netlify cached DB/migration handler

**Cached DB and migration pattern** (`src/app/netlify.ts` lines 13-40):
```typescript
let cachedDb: any = null;

export const handler = async (event: any, context: any) => {
    try {
        // --- 1. 数据库初始化与迁移阻断 ---
        if (!cachedDb) {
            console.log('📡 [DB] Initializing new connection pool...');
            const { db, executor } = await DbFactory.create();
            cachedDb = { db, executor };

            if (db && typeof db.on === 'function') {
                db.on('error', (err: any) => {
                    console.error('📡 [DB Pool] Background Error:', err.message);
                    cachedDb = null;
                });
            }

            try {
                await migrateDatabase(executor);
            } catch (err: any) {
                console.error('🗄️ [DB Migrate] Failed:', err.message);
                cachedDb = null;
                return {
                    statusCode: 503,
                    body: JSON.stringify({ success: false, error: 'Database Initialization Failed', detail: err.message })
                };
            }
        }
```

Netlify cleanup should reuse `cachedDb.db` and avoid creating a second connection path. If using opportunistic cleanup, gate it with module-level timestamp state so it does not run on every request.

**Hono env pattern** (`src/app/netlify.ts` lines 60-65):
```typescript
const res = await app.fetch(request, { 
    ...process.env, 
    ...context, 
    DB: cachedDb?.db 
});
```

The cleanup service should receive the same env shape. Keep response semantics unchanged if cleanup fails; log only safe operation names/counts.

**Runtime error pattern** (`src/app/netlify.ts` lines 100-109):
```typescript
} catch (err: any) {
    console.error('🛑 [Architect] Runtime Crash:', err);
    const errorMsg = err.message || '';
    if (errorMsg.includes('terminated') || errorMsg.includes('timeout') || errorMsg.includes('Connection')) {
        cachedDb = null;
    }
    return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: 'Internal Server Error', detail: err.message })
    };
}
```

Do not let cleanup exceptions turn healthy public/owner requests into 500s unless DB initialization itself failed.

---

### `src/shared/db/migrator.ts` (migration/config, batch SQL transform)

**Analog:** existing migration 13 and MySQL index-prefix patterns

**Base schema share tables** (`src/shared/db/migrator.ts` lines 83-114):
```typescript
// Share link tables
`CREATE TABLE IF NOT EXISTS share_links (
    id TEXT PRIMARY KEY,
    vault_item_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    access_code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL,
    last_accessed_at INTEGER,
    access_count INTEGER DEFAULT 0
)`,
```

SQLite/D1 can stay `TEXT`; the compatibility debt is in the MySQL migration block.

**MySQL prefix-index analog** (`src/shared/db/migrator.ts` lines 153-179):
```typescript
{
    version: 3,
    name: 'create_vault_category_sort_index',
    sqlite: `CREATE INDEX IF NOT EXISTS idx_vault_category_sort ON vault (category, sort_order);`,
    mysql: `CREATE INDEX idx_vault_category_sort ON vault (category(100), sort_order);`
},
// ...
mysql: `
    CREATE INDEX idx_vault_created_at ON vault(created_at DESC);
    CREATE INDEX idx_vault_service_created_at ON vault(service(100), created_at DESC);
    CREATE UNIQUE INDEX vault_service_account_uq ON vault(service(100), account(100));
    CREATE INDEX idx_backup_providers_type ON backup_providers(type(50));
    CREATE INDEX idx_passkeys_user_id ON auth_passkeys(user_id(100));
`
```

If a MySQL column remains `TEXT`, indexes must use prefixes. Preferred Phase 3 fix is bounded `VARCHAR(...)` for indexed share identifiers, matching `src/shared/db/schema/mysql.ts`.

**Problem MySQL share migration block** (`src/shared/db/migrator.ts` lines 358-395):
```typescript
mysql: `
    CREATE TABLE IF NOT EXISTS share_links (
        id TEXT PRIMARY KEY,
        vault_item_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        access_code_hash TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        revoked_at BIGINT,
        created_at BIGINT NOT NULL,
        last_accessed_at BIGINT,
        access_count BIGINT DEFAULT 0
    );
    CREATE INDEX idx_share_links_vault_item ON share_links(vault_item_id);
    CREATE INDEX idx_share_links_owner ON share_links(owner_id, created_at DESC);
    CREATE INDEX idx_share_links_token_hash ON share_links(token_hash);
`
```

Replace indexed identifier columns with bounded `VARCHAR` equivalents, consistent with MySQL schema lines 22-54.

**Migration execution pattern** (`src/shared/db/migrator.ts` lines 479-488):
```typescript
for (const m of pending) {
    logger.info(`[Database] Applying v${m.version}: ${m.name}`);
    try {
        // 将复合 SQL 按分号拆分执行
        const engineSql = (m as any)[engine] || m.sqlite;
        const statements = engineSql.split(';').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        for (const rawSql of statements) {
            const sql = transformSqlForDialect(rawSql, engine);
            await db.exec(sql);
        }
```

Keep migration SQL split-safe: one DDL statement per semicolon-delimited statement.

---

### `scripts/validate_share_schema_alignment.js` (utility/script, file-I/O + validation)

**Analog:** existing validator script

**CommonJS file-read pattern** (`scripts/validate_share_schema_alignment.js` lines 1-16, 40-51):
```javascript
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const repoRoot = resolve(__dirname, '..');

const requiredFiles = [
    'src/shared/db/schema/sqlite.ts',
    'src/shared/db/schema/mysql.ts',
    'src/shared/db/schema/pg.ts',
    'src/shared/db/schema/index.ts',
    'src/shared/db/migrator.ts',
    'backend/schema.sql',
    'backend/dist/worker/worker.js',
    'backend/dist/docker/server.js',
    'backend/dist/netlify/api.mjs',
];

const fail = (message) => {
    console.error(message);
    process.exit(1);
};
```

Use this same simple script style. Add MySQL-specific checks here instead of a new validator.

**Required source/generated string pattern** (`scripts/validate_share_schema_alignment.js` lines 18-38, 66-82):
```javascript
const requiredSourceStrings = [
    'share_links',
    'share_audit_events',
    'share_rate_limits',
    'token_hash',
    'access_code_hash',
    'vault_item_id',
    'owner_id',
    'expires_at',
    'revoked_at',
    'create_share_link_tables',
    'version: 13',
];

for (const requiredString of requiredSourceStrings) {
    if (!sourceContents.includes(requiredString)) {
        fail(`Missing required source string: ${requiredString}`);
    }
}
```

Extend this with negative assertions for MySQL migration regressions, e.g. fail when the MySQL share migration block contains indexed `TEXT` identifiers like `id TEXT PRIMARY KEY`, `token_hash TEXT`, or `share_rate_limits ( key TEXT PRIMARY KEY )`.

---

### `docs/share-link-security-contract.md` (documentation, contract/static)

**Analog:** existing contract sections

**Revocation section to extend** (`docs/share-link-security-contract.md` lines 20-25):
```markdown
## Revocation Semantics

- A share can be revoked by the owner at any time.
- Revocation wins over any remaining TTL.
- Revoked shares must not be usable for access, token lookup, or code verification.
- Revocation state is authoritative even if derived secrets remain present in storage.
```

Add the UX-03 limitation here: revocation stops future access only and cannot retract credentials or OTP codes already copied from a previous response.

**Public response protections section** (`docs/share-link-security-contract.md` lines 39-44):
```markdown
## Public Response Protections

- Public responses use `Cache-Control: no-store`.
- Public responses use `Pragma: no-cache`.
- Public responses use `Referrer-Policy: no-referrer`.
- Recipient-facing responses must not leak unrelated vault entries, owner session data, or internal administrative metadata.
```

Keep docs aligned with exact route/test allowlists.

---

### `src/features/share/shareService.test.ts` (test, CRUD + transform + event-driven audit)

**Analog:** existing service hardening tests

**Test setup pattern** (`src/features/share/shareService.test.ts` lines 60-83):
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
        };
        service = new ShareService(
            { SHARE_SECRET_PEPPER: 'pepper', JWT_SECRET: 'jwt' } as any,
            vaultRepository,
            shareRepository,
        );
    });
```

Add cleanup repository fakes here before testing `cleanupShareState()`.

**Public decision safety helper** (`src/features/share/shareService.test.ts` lines 40-51):
```typescript
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

Use exact key allowlists where possible, but keep this helper for secret absence and headers.

**Wrong-code secret-processing regression** (`src/features/share/shareService.test.ts` lines 418-442):
```typescript
it('wrong-code access does not decrypt or generate OTP output', async () => {
    const decryptSpy = vi.spyOn(dbModule, 'decryptField');
    const generateSpy = vi.spyOn(otpModule, 'generate');
    shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord());
    vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem());

    const decision = await service.resolveShareAccess({
        token: 'token',
        accessCode: 'wrong-code',
        now: 1000,
    } as any);

    expect(decision).toMatchObject({
        accessible: false,
        status: 'active',
        reason: 'inaccessible',
        itemView: null,
    });
    expect(decryptSpy).not.toHaveBeenCalled();
    expect(generateSpy).not.toHaveBeenCalled();
    expect(shareRepository.markAccessed).not.toHaveBeenCalled();
});
```

Preserve this pattern when splitting HARD-02 cases by expired, revoked, deleted-item, wrong-code, token enumeration, and repeated expired cleanup.

**Expired audit test pattern** (`src/features/share/shareService.test.ts` lines 488-538):
```typescript
it('records an expired audit event before returning an inaccessible expired decision', async () => {
    const rawToken = 'raw-public-token-123';
    const tokenHash = await hashShareSecret('pepper', 'share-token', rawToken);
    shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord({
        tokenHash,
        expiresAt: 999,
    }));

    const decision = await service.resolveShareAccess({
        token: rawToken,
        accessCode: 'correct-code',
        now: 1000,
    } as any);

    expect(decision).toMatchObject({
        accessible: false,
        status: 'expired',
        reason: 'inaccessible',
        share: null,
        itemView: null,
    });
    expect(vaultRepository.findActiveByIdForOwner).not.toHaveBeenCalled();
});
```

Use this as the seed for idempotent cleanup tests: repeated cleanup/access must not produce unsafe metadata or duplicate status effects.

---

### `src/features/share/shareRoutes.test.ts` (test, request-response)

**Analog:** existing Hono route tests

**Hoisted mock pattern** (`src/features/share/shareRoutes.test.ts` lines 5-52):
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
    const shareRateLimitMiddleware = vi.fn(async (_c: any, next: any) => {
        await next();
    });
    const shareRateLimit = vi.fn(() => shareRateLimitMiddleware);

    return {
        authMiddleware,
        createShareForOwner,
        listSharesForOwner,
        getShareForOwner,
        revokeShareForOwner,
        resolveShareAccess,
        createShareService,
        shareRateLimitMiddleware,
        shareRateLimit,
    };
});
```

If routes call cleanup opportunistically, add a mocked `cleanupShareState` method to the mocked service object.

**Hono app.request pattern** (`src/features/share/shareRoutes.test.ts` lines 54-58):
```typescript
const makeApp = () => {
    const app = new Hono<{ Bindings: EnvBindings, Variables: { user: any } }>();
    app.route('/api/share', shareRoutes);
    return app;
};
```

Use this for all public route response allowlist/generic-error cases.

**Public success response pattern** (`src/features/share/shareRoutes.test.ts` lines 222-274):
```typescript
const response = await app.request('https://nodeauth.test/api/share/public/raw-token-123/access?accessCode=query-code', {
    method: 'POST',
    body: JSON.stringify({ accessCode: 'code-123' }),
    headers: {
        'Content-Type': 'application/json',
    },
});
const body = await response.json();

expect(response.status).toBe(200);
expect(body).toEqual({
    success: true,
    data: {
        service: 'GitHub',
        account: 'friend@example.com',
        otp: {
            code: '123456',
            period: 30,
            remainingSeconds: 12,
        },
    },
});
expect(mocks.authMiddleware).not.toHaveBeenCalled();
expect(mocks.shareRateLimitMiddleware).toHaveBeenCalledTimes(1);
expect(JSON.stringify(mocks.resolveShareAccess.mock.calls)).not.toContain('query-code');
```

Add exact `Object.keys(...).sort()` assertions for public success and failure response allowlists.

**Generic inaccessible response pattern** (`src/features/share/shareRoutes.test.ts` lines 276-305):
```typescript
expect(response.status).toBe(404);
expect(body).toEqual({ success: false, message: 'share_inaccessible', data: null });
expect(JSON.stringify(body)).not.toContain('revoked');
expect(JSON.stringify(body)).not.toContain('wrong-code');
expectPublicHeaders(response);
```

Reuse this for expired, revoked, wrong-code, locked, deleted-item, and token enumeration route tests.

---

### `src/shared/middleware/shareRateLimitMiddleware.test.ts` (test, request-response + rate-limit state)

**Analog:** existing fail-closed limiter tests

**Generic fail-closed helper** (`src/shared/middleware/shareRateLimitMiddleware.test.ts` lines 45-59):
```typescript
const expectShareInaccessibleResponse = async (response: Response) => {
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
        success: false,
        message: 'share_inaccessible',
        data: null,
    });

    for (const [name, value] of Object.entries(getSharePublicHeaders())) {
        expect(response.headers.get(name)).toBe(value);
    }
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Pragma')).toBe('no-cache');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
};
```

Use this for locked/rate-limited HARD-02/HARD-03 tests.

**Safe audit/log-redaction pattern** (`src/shared/middleware/shareRateLimitMiddleware.test.ts` lines 106-175):
```typescript
const rawToken = 'raw-public-token-123';
const rawAccessCode = 'raw-access-code-123';
const tokenHash = await hashShareSecret('pepper', 'share-token', rawToken);
const middleware = shareRateLimit();

const enforceRateLimit = vi.spyOn(ShareRepository.prototype, 'enforceRateLimit').mockResolvedValue({
    allowed: false,
    attempts: 6,
    lockedUntil: 2000,
});
const findByTokenHash = vi.spyOn(ShareRepository.prototype, 'findByTokenHash').mockResolvedValue({
    id: 'share-1',
    ownerId: 'owner-1',
} as any);
const insertAuditEvent = vi.spyOn(ShareRepository.prototype, 'insertAuditEvent').mockResolvedValue();

const limiterInput = enforceRateLimit.mock.calls[0][0];
expect(limiterInput.key).not.toContain(rawToken);
expect(limiterInput.shareId).not.toContain(rawToken);
expect(findByTokenHash).toHaveBeenCalledWith(tokenHash);
expect(findByTokenHash).not.toHaveBeenCalledWith(rawToken);
```

Use this shape for log payload redaction checks: assert raw token/access code/full URLs never enter repository inputs, audit metadata, or logger calls.

**Durable limiter identifier pattern** (`src/shared/middleware/shareRateLimitMiddleware.test.ts` lines 221-245):
```typescript
const input = enforceRateLimit.mock.calls[0][0];
expect(input.key).not.toContain(rawToken);
expect(input.shareId).not.toContain(rawToken);
expect(input.key).toMatch(/^share:1\.2\.3\.4:share-public-access:[A-Za-z0-9_-]+$/);
expect(input.shareId).toMatch(/^[A-Za-z0-9_-]+$/);
expect(input.shareId).not.toBe('');
```

Keep token-enumeration tests generic and hash-based.

---

### `src/app/index.test.ts` (test, source-contract + request-response + logging/privacy)

**Analog:** existing app tests

**Source-contract pattern** (`src/app/index.test.ts` lines 19-27):
```typescript
describe('share route mounting', () => {
    it('imports and mounts share routes before the API fallback', () => {
        const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

        expect(source).toContain("import shareRoutes from '@/features/share/shareRoutes';");
        expect(source).toContain("app.route('/api/share', shareRoutes);");
        expect(source.indexOf("app.route('/api/share', shareRoutes);"))
            .toBeLessThan(source.indexOf("app.all('/api/*'"));
    });
});
```

Use this same source-read style for Worker scheduled, Docker cron, Netlify opportunistic cleanup, and backup preservation assertions.

**Log redaction pattern** (`src/app/index.test.ts` lines 5-16):
```typescript
describe('redactSharePublicToken', () => {
    it('redacts public share access tokens from logged request paths', () => {
        const redacted = redactSharePublicToken('POST /api/share/public/raw-public-token-123/access 404');

        expect(redacted).toContain('/api/share/public/[share-token]/access');
        expect(redacted).toContain('[share-token]');
        expect(redacted).not.toContain('raw-public-token-123');
    });

    it('preserves ordinary API paths', () => {
        expect(redactSharePublicToken('GET /api/vault?page=1 200')).toBe('GET /api/vault?page=1 200');
    });
});
```

Extend this with generated/runtime marker assertions only where source-contract tests cannot instantiate the runtime safely.

**CORS/source guard pattern** (`src/app/index.test.ts` lines 60-68):
```typescript
describe('API CORS source contract', () => {
    it('does not reflect arbitrary origins and delegates to resolveApiCorsOrigin', () => {
        const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

        expect(source).not.toContain('origin: (origin) => origin');
        expect(source).not.toMatch(/origin:\s*['"]\*['"]/);
        expect(source).toContain('origin: (origin, c) => resolveApiCorsOrigin(origin, c.env)');
        expect(source).toContain('credentials: true');
    });
});
```

Use negative assertions for regressions such as exempting `/api/share` from the health gate or replacing backup cron.

---

### `src/shared/db/repositories/shareRepository.test.ts` (test, CRUD + batch cleanup)

**Analog:** no existing repository test file; use service test style plus repository cleanup analog

**Test framework style** (`src/features/share/shareService.test.ts` lines 1-7):
```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AppError } from '@/app/config';
import { ShareService } from '@/features/share/shareService';
import { hashShareSecret } from '@/features/share/shareSecurity';
import * as dbModule from '@/shared/db/db';
import * as otpModule from '@/shared/utils/otp';
```

For repository tests, import `ShareRepository`, schema tables, and fake/SQLite DB helpers already available in the backend test environment.

**Repository cleanup behavior to copy** (`src/shared/db/repositories/sessionRepository.ts` lines 90-100):
```typescript
async cleanupExpired(cutoffTimestamp: number): Promise<number> {
    const conditions = lt(authSessions.lastActiveAt, cutoffTimestamp);

    const countRes = await this.db.select().from(authSessions).where(conditions);

    await this.db
        .delete(authSessions)
        .where(conditions);

    return countRes.length;
}
```

Tests should prove stale limiter rows before cutoff are deleted, fresh/locked rows inside retention survive, and returned counts do not expose row contents.

## Shared Patterns

### Authentication And Ownership

**Source:** `src/features/share/shareRoutes.ts` lines 12-18, 34-58

**Apply to:** owner share routes, wrong-owner tests
```typescript
share.post('/', authMiddleware, async (c) => {
    const user = c.get('user');
    const ownerId = user.email || user.id;
    const body = await c.req.json().catch(() => ({}));

    if (typeof body.vaultItemId !== 'string' || body.vaultItemId.trim() === '') {
        return c.json({ success: false, error: 'vaultItemId is required' }, 400);
    }
```

Owner APIs derive `ownerId` from authenticated user context and use service/repository owner-scoped calls. Public routes remain unauthenticated.

### Centralized Error Handling

**Source:** `src/app/index.ts` lines 178-203

**Apply to:** service methods, owner route errors
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

Throw `AppError` for expected owner/service failures; public recipient inaccessible states should return generic 404 bodies directly.

### Public Share Failure Envelope

**Source:** `src/features/share/shareRoutes.ts` lines 72-80 and `src/shared/middleware/shareRateLimitMiddleware.ts` lines 20-25

**Apply to:** public route tests, rate-limit tests, token-enumeration tests
```typescript
for (const [name, value] of Object.entries(decision.publicHeaders || getSharePublicHeaders())) {
    c.header(name, value);
}

if (!decision.accessible) {
    return c.json({ success: false, message: 'share_inaccessible', data: null }, 404);
}

return c.json({ success: true, data: decision.itemView });
```

### Runtime Cleanup Dispatch

**Source:** `src/app/worker.ts` lines 29-37, `src/app/server.ts` lines 104-112, `src/app/netlify.ts` lines 13-40

**Apply to:** Worker scheduled, Docker cron, Netlify opportunistic cleanup
```typescript
async scheduled(event: any, env: any, ctx: any) {
    const db = drizzle(env.DB, { schema });
    const specializedEnv = {
        ...env,
        DB: db
    };
    ctx.waitUntil(handleScheduledBackup(specializedEnv));
}
```

The planner should preserve existing backup behavior and call one shared `ShareService.cleanupShareState()` from all runtime hooks.

### Safe Logging

**Source:** `src/app/index.ts` lines 41-46, 90-91 and `src/shared/middleware/shareRateLimitMiddleware.ts` lines 76-80

**Apply to:** runtime cleanup logs, public route logs, limiter logs
```typescript
export function redactSharePublicToken(value: string): string {
    return value.replace(
        /\/api\/share\/public\/[^\s/?#]+\/access/g,
        '/api/share/public/[share-token]/access',
    );
}

app.use('*', hLogger((str) => logger.info(redactSharePublicToken(str))));
```

Cleanup logs should include operation names and counts only, never share IDs, token hashes, access-code hashes, vault labels, owner emails, or URLs.

### MySQL Compatibility Guard

**Source:** `src/shared/db/schema/mysql.ts` lines 22-54 and `src/shared/db/migrator.ts` lines 358-395

**Apply to:** migrator, validator, generated bundle checks
```typescript
export const shareLinks = mysqlTable('share_links', {
    id: varchar('id', { length: 36 }).primaryKey(),
    vaultItemId: varchar('vault_item_id', { length: 36 }).notNull(),
    ownerId: varchar('owner_id', { length: 255 }).notNull(),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    accessCodeHash: varchar('access_code_hash', { length: 255 }).notNull(),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
    revokedAt: bigint('revoked_at', { mode: 'number' }),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    lastAccessedAt: bigint('last_accessed_at', { mode: 'number' }),
    accessCount: bigint('access_count', { mode: 'number' }).notNull().default(0),
});
```

Use bounded `VARCHAR` in MySQL migration SQL for indexed identifiers. Do not leave indexed `TEXT` share columns in fresh MySQL migrations.

### Generated Bundle Handling

**Source:** Phase 2 pattern and research; generated output files are `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, and `backend/dist/netlify/api.mjs`

**Apply to:** generated artifacts
```text
Edit source under src/** and scripts/**, then rebuild Worker, Docker, and Netlify bundles.
Use generated bundle greps/source-map verification as validation, not as primary implementation.
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/shared/db/repositories/shareRepository.test.ts` | test | CRUD + batch cleanup | No repository test file currently exists; use Vitest service test structure and repository cleanup method analog. |

## Metadata

**Analog search scope:** `src/app`, `src/features/share`, `src/shared/db`, `src/shared/middleware`, `scripts`, `docs`, Phase 2 planning artifacts  
**Files scanned:** 80+ source, script, doc, backend artifact, and planning files via `rg --files` and targeted `rg`  
**Pattern extraction date:** 2026-05-03  
**Project instructions:** `AGENTS.md` read; no `CLAUDE.md`, `.claude/skills/`, or `.agents/skills/` present.  
**Implementation warning:** Do not hand-edit `backend/dist/**`; regenerate bundles from source after Phase 3 source changes.
