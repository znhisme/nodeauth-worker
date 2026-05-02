# Architecture Research

**Domain:** Secure single-account HTTP share links in an existing Hono/Drizzle vault app
**Researched:** 2026-05-02
**Confidence:** MEDIUM

Confidence is medium because the repository is distribution-heavy: the real TypeScript source tree is not checked in, but source-map labels, compiled route/service/repository code, `backend/schema.sql`, and `.planning/codebase/*` provide enough architectural signal for roadmap planning.

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         HTTP Clients                         │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐        ┌──────────────────────────┐  │
│  │ Authenticated SPA │        │ Public recipient browser │  │
│  │ owner session     │        │ no NodeAuth account      │  │
│  └─────────┬─────────┘        └────────────┬─────────────┘  │
├────────────┴───────────────────────────────┴────────────────┤
│                         Hono API App                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │ /api/share-links     │  │ /api/share/:token            │  │
│  │ owner management     │  │ recipient access             │  │
│  │ auth + csrf required │  │ code-gated, rate-limited     │  │
│  └──────────┬───────────┘  └──────────────┬───────────────┘  │
├─────────────┴─────────────────────────────┴─────────────────┤
│                       Feature Services                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │ ShareLinkService     │  │ VaultService / OTP utilities │  │
│  │ lifecycle + policy   │  │ decrypt only one vault item  │  │
│  └──────────┬───────────┘  └──────────────┬───────────────┘  │
├─────────────┴─────────────────────────────┴─────────────────┤
│                       Repository Layer                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │ ShareLinkRepository  │  │ VaultRepository              │  │
│  │ share metadata       │  │ existing encrypted account   │  │
│  └──────────┬───────────┘  └──────────────┬───────────────┘  │
├─────────────┴─────────────────────────────┴─────────────────┤
│                         Database                             │
│  ┌─────────────┐ ┌────────────────────┐ ┌─────────────────┐ │
│  │ vault       │ │ vault_share_links  │ │ rate_limits     │ │
│  │ encrypted   │ │ token/code hashes  │ │ abuse control   │ │
│  └─────────────┘ └────────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `shareLinkRoutes.ts` | Own all HTTP endpoints for creating, listing, inspecting, revoking, and consuming share links. Keep owner and recipient route groups visibly separate. | Hono sub-app mounted from `src/app/index.ts` with `authMiddleware` only on owner routes. |
| `ShareLinkService` | Enforce lifecycle rules: one link references one vault item, token generation, access-code verification, expiration, revocation, max-view policy if added, and response minimization. | Feature service under `src/features/share-links/`, injected with `ShareLinkRepository`, `VaultRepository`, and env secrets. |
| `ShareLinkRepository` | Persist and query share-link metadata without exposing raw token or raw access code. | Drizzle repository under `src/shared/db/repositories/shareLinkRepository.ts`. |
| `VaultRepository` | Read the linked vault item by ID and ensure deleted items are not served. | Existing repository. Add a narrow method if needed, such as `findActiveById(id)`, instead of reusing list/export paths. |
| `VaultService` / crypto helpers | Decrypt the one linked secret and normalize the recipient DTO. | Prefer a dedicated service method, such as `getShareableAccountById(vaultItemId)`, over calling broad export/list methods. |
| `rateLimit` middleware | Limit access-code attempts and public token probes. | Existing DB-backed `rate_limits` middleware, but share-link phase should first fix or wrap fail-open behavior for sensitive public access. |
| Scheduled cleanup | Remove or mark expired links and old rate-limit records. | Existing Worker scheduled entry can call share-link cleanup alongside session/backup cleanup. |

## Recommended Project Structure

```text
src/
├── app/
│   ├── index.ts                         # Mount share-link routes and keep health gate behavior centralized
│   └── worker.ts                        # Existing fetch/scheduled bridge; optionally calls share cleanup
├── features/
│   ├── vault/
│   │   ├── vaultRoutes.ts               # Existing authenticated vault CRUD; do not add public share access here
│   │   └── vaultService.ts              # Add narrow single-item share DTO helper if needed
│   └── share-links/
│       ├── shareLinkRoutes.ts           # Owner + recipient HTTP routes
│       ├── shareLinkService.ts          # Policy, token/code validation, DTO minimization
│       └── shareLinkTypes.ts            # Request/response types and status enums
├── shared/
│   ├── db/
│   │   ├── schema/
│   │   │   ├── sqlite.ts                # Add vault_share_links
│   │   │   ├── mysql.ts                 # Keep deployment target parity
│   │   │   ├── pg.ts                    # Keep deployment target parity
│   │   │   └── index.ts                 # Export selected schema by DB_ENGINE
│   │   └── repositories/
│   │       └── shareLinkRepository.ts   # Persistence for share links only
│   ├── middleware/
│   │   └── shareAccessRateLimit.ts      # Optional fail-closed wrapper for public share attempts
│   └── utils/
│       ├── shareToken.ts                # Random token, hashing, constant-time compare helpers
│       └── masking.ts                   # Existing helper; avoid owner/session data leakage
└── tests/
    └── share-links/                     # Add if source tests are restored; route + repository contract tests
```

### Structure Rationale

- **`src/features/share-links/`:** Share links are a separate domain from vault CRUD. Owner management is authenticated, recipient consumption is public, and mixing both into `vaultRoutes.ts` would make auth boundaries harder to audit.
- **`src/shared/db/repositories/shareLinkRepository.ts`:** Existing code keeps persistence in repositories. Share-link routes should not issue raw SQL except during migrations.
- **`src/shared/utils/shareToken.ts`:** Token and access-code hashing are cross-route security helpers, but not a general vault concern.
- **Schema in all DB engines:** The app supports Cloudflare D1/SQLite, MySQL, and PostgreSQL. Additive schema work must update `backend/schema.sql` and the Drizzle schema variants together.

## Architectural Patterns

### Pattern 1: Split Owner Routes From Recipient Routes

**What:** Provide two route surfaces under one feature: authenticated owner management and unauthenticated recipient access.

**When to use:** Always for share links. Owners use sessions and CSRF; recipients should not need a NodeAuth account but must pass token and access-code controls.

**Trade-offs:** A separate public route adds more policy code, but it prevents accidental reuse of owner-only vault responses and auth/session middleware assumptions.

**Example:**

```typescript
const shareLinks = new Hono<Env>();

shareLinks.use('/owner/*', authMiddleware);
shareLinks.post('/owner', createShareLink);
shareLinks.get('/owner', listShareLinks);
shareLinks.delete('/owner/:id', revokeShareLink);

shareLinks.get('/public/:token', getShareMetadata);
shareLinks.post('/public/:token/access', rateLimitShareAccess(), accessShareLink);

export default shareLinks;
```

Mount as `app.route('/api/share-links', shareLinkRoutes)` or use `/api/shares` consistently. Avoid placing public access below `/api/vault`.

### Pattern 2: Opaque Capability Token Plus Independent Access Code

**What:** The URL contains only a high-entropy opaque token. The database stores `token_hash`, not the token. The access code is delivered out-of-band and stored as `access_code_hash`.

**When to use:** Default for every share link. The project requirement explicitly says leaked URL alone should not reveal credentials.

**Trade-offs:** Recipients have one extra step, but the blast radius is much lower if chat history, browser history, referrers, or logs leak the URL.

**Example:**

```typescript
const token = generateShareToken(); // 128+ bits, URL-safe
const tokenHash = await hashShareSecret(token, env.SHARE_LINK_SECRET || env.JWT_SECRET);
const accessCodeHash = await hashShareSecret(accessCode, tokenHash);

await shareLinkRepo.create({
    id: crypto.randomUUID(),
    vaultItemId,
    tokenHash,
    accessCodeHash,
    createdBy: ownerUserId,
    expiresAt,
    revokedAt: null,
    createdAt: Date.now(),
});

return { url: `${origin}/share/${token}`, accessCode };
```

### Pattern 3: Share DTO Whitelist

**What:** Build a recipient-specific response object field by field. Never return raw vault rows, owner route responses, session payloads, repository entities, or export payloads.

**When to use:** Every public share access response.

**Trade-offs:** More explicit mapping code, but this is the main defense against accidental data leakage from a sensitive app.

**Example:**

```typescript
return {
    service: item.service,
    account: item.account,
    secret: plainSecret,
    otp: currentOtp ? {
        code: currentOtp.code,
        period: item.period,
        digits: item.digits,
        algorithm: item.algorithm,
        expiresAt: currentOtp.expiresAt,
    } : null,
    type: item.type,
};
```

Do not include `id`, `createdBy`, `updatedBy`, `deletedAt`, owner email, session ID, `ENCRYPTION_KEY`, backup metadata, category stats, trash counts, or pagination.

### Pattern 4: Lifecycle State in the Share Table

**What:** Store link status as data: expiration, revocation, creation/update timestamps, optional last access timestamp, and optional access count.

**When to use:** Required for owner inspection, revocation, cleanup, and abuse detection.

**Trade-offs:** A table is heavier than stateless signed URLs, but it enables revocation. For this domain, revocation is non-negotiable.

## Data Flow

### Request Flow

```text
Owner creates link
    ↓
POST /api/share-links/owner
    ↓ authMiddleware + CSRF + health gate
ShareLinkService validates owner intent and vault item existence
    ↓
VaultRepository.findActiveById(vaultItemId)
    ↓
ShareLinkService generates token + access code, stores only hashes
    ↓
ShareLinkRepository.create(...)
    ↓
Response: { url, accessCode, expiresAt } only
```

```text
Recipient accesses link
    ↓
POST /api/share-links/public/:token/access
    ↓ health gate + public share rate limit
ShareLinkService hashes token and loads active link
    ↓
Checks revokedAt, expiresAt, deleted vault item, access-code hash
    ↓
VaultRepository.findActiveById(vaultItemId)
    ↓
VaultService decrypts only that item's secret
    ↓
Share DTO whitelist
    ↓
Response: one account's login/TOTP details only
```

```text
Owner revokes link
    ↓
DELETE /api/share-links/owner/:id
    ↓ authMiddleware + CSRF
ShareLinkService confirms link exists and belongs to same owner context
    ↓
ShareLinkRepository.revoke(id, ownerUserId, now)
    ↓
Future recipient requests fail with not_found_or_expired
```

### State Management

```text
vault_share_links
    ↓ references one active vault.id
vault
    ↓ encrypted secret decrypted only inside service layer
recipient response
    ↓ minimized DTO, no reusable owner state
```

Recommended table:

```sql
CREATE TABLE IF NOT EXISTS vault_share_links (
    id TEXT PRIMARY KEY,
    vault_item_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    access_code_hash TEXT NOT NULL,
    created_by TEXT,
    label TEXT,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    last_accessed_at INTEGER,
    access_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vault_share_links_vault_item_id
    ON vault_share_links(vault_item_id);
CREATE INDEX IF NOT EXISTS idx_vault_share_links_created_by
    ON vault_share_links(created_by);
CREATE INDEX IF NOT EXISTS idx_vault_share_links_expires_at
    ON vault_share_links(expires_at);
```

Do not add recipient identity columns in v1 unless the product explicitly adds recipient authentication. IP/user-agent logs are sensitive and should be avoided or heavily minimized.

### Key Data Flows

1. **Owner management flow:** SPA calls authenticated `/api/share-links/owner/*`; route uses existing session user from `authMiddleware`; service persists share metadata and returns only owner-safe management details.
2. **Recipient preview flow:** Optional `GET /api/share-links/public/:token` returns only non-secret metadata such as `service`, `account` masked if desired, and `requiresAccessCode: true`; it must not reveal whether an access code is close or valid.
3. **Recipient secret flow:** `POST /api/share-links/public/:token/access` validates token hash, access-code hash, expiration, revocation, and vault item state before decrypting exactly one secret.
4. **Cleanup flow:** Scheduled job or opportunistic cleanup marks/removes expired share links and deletes expired rate-limit rows. Cleanup should never touch `vault` rows.
5. **Vault deletion flow:** If a vault item is deleted or moved to trash, public access should fail. A later phase can optionally auto-revoke links for that item.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k share links | Single `vault_share_links` table with indexes is sufficient. Add route/service/repository tests before optimizing. |
| 1k-100k share links | Index `token_hash`, `created_by`, `expires_at`, and `vault_item_id`; add scheduled cleanup; keep response DTOs small; monitor rate-limit table growth. |
| 100k+ share links | Add retention policy, audit/event table only if required, and partition cleanup by time windows. Consider a stronger abuse-control layer at the edge before splitting services. |

### Scaling Priorities

1. **First bottleneck:** Public token/access-code attempts can grow `rate_limits` and increase DB writes. Fix with fail-closed sensitive rate limiting, expiry indexes, and cleanup.
2. **Second bottleneck:** Owner listing can scan many links if `created_by` is unindexed. Add indexes before adding filters, analytics, or audit history.

## Anti-Patterns

### Anti-Pattern 1: Public Share Access Inside `vaultRoutes.ts`

**What people do:** Add `GET /api/vault/share/:token` beside authenticated vault CRUD and work around `authMiddleware` with route exceptions.

**Why it's wrong:** Vault routes are session-scoped and currently return list/pagination/category/trash shapes. Public share access has a different trust boundary and response contract.

**Do this instead:** Create a dedicated `share-links` feature module with owner and recipient route groups.

### Anti-Pattern 2: Storing Raw URL Tokens or Access Codes

**What people do:** Store `token` and `access_code` directly in the database for easy lookup and support.

**Why it's wrong:** A database read or log leak becomes direct access to account secrets.

**Do this instead:** Store keyed hashes. Return the raw token and access code only once at creation.

### Anti-Pattern 3: Reusing Export or Full Vault DTOs

**What people do:** Call `exportAccounts()` or `getAccountsPaginated()` and filter down to one item.

**Why it's wrong:** Those methods are designed for owners and include broader vault behavior, category stats, trash counts, and plaintext export paths.

**Do this instead:** Add a narrow service method that loads one active vault item and maps a share-specific DTO.

### Anti-Pattern 4: Stateless Signed Share URLs

**What people do:** Put vault item ID, expiry, and a signature into a JWT-style URL and avoid a table.

**Why it's wrong:** Revocation becomes hard, access attempts cannot be tracked cleanly, and token leakage remains enough if access-code handling is skipped.

**Do this instead:** Use an opaque token backed by `vault_share_links`.

### Anti-Pattern 5: Platform-Specific Crypto or Storage

**What people do:** Use Cloudflare-only KV, Workers-specific APIs, or Node-only crypto paths directly in feature code.

**Why it's wrong:** The project supports Cloudflare Workers, Docker, and Netlify. Platform-specific assumptions will break alternate bundles.

**Do this instead:** Use Web Crypto-compatible helpers and existing env/database abstractions.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Cloudflare D1 | Add `vault_share_links` DDL to `backend/schema.sql` and Drizzle SQLite schema. | D1 has bind-parameter limits; keep repository methods simple and indexed. |
| Docker SQLite/MySQL/PostgreSQL | Add matching schema variants in `src/shared/db/schema/mysql.ts` and `src/shared/db/schema/pg.ts`. | Cross-engine boolean/timestamp behavior is already fragile; include repository contract tests. |
| Cloudflare Worker scheduled event | Optional cleanup job through existing `scheduled` entry. | Cleanup expired links and stale rate-limit rows; do not make cleanup required for correctness. |
| Frontend SPA | Owner UI calls authenticated owner endpoints; recipient page calls public endpoints. | Frontend source is not present in this checkout, so roadmap should build API first unless source is restored. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `app/index.ts` -> `shareLinkRoutes` | Hono `app.route(...)` | Mount after health middleware. Public share endpoints should still pass deployment health checks unless explicitly designed otherwise. |
| `shareLinkRoutes` -> `ShareLinkService` | Direct service call | Routes parse request bodies and return JSON only; service owns policy decisions. |
| `ShareLinkService` -> `ShareLinkRepository` | Repository methods | Repository owns token-hash lookup, owner listing, revocation, and cleanup queries. |
| `ShareLinkService` -> `VaultRepository` | Narrow single-item read | Share service must never call vault list/export flows for recipient access. |
| `ShareLinkService` -> crypto helpers | Utility functions | Token generation, hashing, and constant-time compare should be centralized and tested. |
| `ShareLinkService` -> rate-limit middleware | Hono middleware before service | Public access-code attempts should be rate-limited by IP plus token hash or token prefix hash, without logging raw tokens. |

## Build Order Implications

1. **Restore/source-readiness gate:** Do not implement feature work directly in `backend/dist/**` except as an emergency hotfix. Restore `backend/src/**`, schema source, and build scripts or confirm this repo can regenerate all three backend bundles from source.
2. **Schema and repository first:** Add `vault_share_links` to `backend/schema.sql` and Drizzle schema variants, then implement `ShareLinkRepository` with tests for create, lookup by token hash, list by owner, revoke, expire, and cleanup.
3. **Security utilities next:** Implement token generation, keyed hashing, access-code hashing, and constant-time compare helpers. Decide whether to add `SHARE_LINK_SECRET`; if not, use `JWT_SECRET` as the keyed hash secret with a clear migration note.
4. **Service layer before routes:** Implement `ShareLinkService` lifecycle methods and a narrow vault-item DTO path. This is where data minimization is enforced.
5. **Owner routes:** Add authenticated create/list/inspect/revoke endpoints. Verify CSRF/session behavior uses existing `authMiddleware`.
6. **Recipient public routes:** Add preview/access endpoints with fail-closed rate limiting. Return generic errors such as `share_not_found_or_expired` to avoid token enumeration signals.
7. **Cleanup and deletion behavior:** Add scheduled cleanup and define what happens when a shared vault item is trashed or deleted. v1 should deny access to deleted/trashed items even if the share row remains.
8. **Frontend last:** Add owner management UI and recipient page only after API contracts are stable. This checkout may not contain editable frontend source.

## Sources

- `.planning/PROJECT.md` - milestone scope, constraints, and validated requirements.
- `.planning/codebase/ARCHITECTURE.md` - existing Hono app, feature layer, repository layer, health gate, and runtime shape.
- `.planning/codebase/STRUCTURE.md` - source-map-derived file layout and where new code belongs.
- `.planning/codebase/CONVENTIONS.md` - route/service/repository naming, error handling, import, and style conventions.
- `.planning/codebase/CONCERNS.md` - distribution-only risk, auth/vault fragility, schema management, rate-limit fail-open concern, and cross-engine issues.
- `backend/schema.sql` - current persisted tables and absence of share-link schema.
- `backend/dist/worker/worker.js` - compiled evidence for `authMiddleware`, `rateLimit`, `VaultService`, `VaultRepository`, and app route mounting.

---
*Architecture research for: secure single-account HTTP share links in NodeAuth*
*Researched: 2026-05-02*
