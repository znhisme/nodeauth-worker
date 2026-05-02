# Phase 2: Share Link API - Research

**Researched:** 2026-05-03  
**Domain:** Brownfield Hono/Drizzle owner and public recipient share-link API  
**Confidence:** HIGH for current source/API primitives; MEDIUM for final route paths because no Phase 2 CONTEXT.md locked endpoint names. [VERIFIED: `gsd-sdk query init.phase-op "2"`, `rg --files src`, `.planning/ROADMAP.md`]

## User Constraints

No `.planning/phases/02-share-link-api/*-CONTEXT.md` exists, so there are no phase-specific locked decisions to copy. [VERIFIED: `find .planning/phases/02-share-link-api`]

Applicable project constraints: share links must use high-entropy tokens, bounded expiration, revocation, and independent access-code protection by default. [VERIFIED: `AGENTS.md`, `docs/share-link-security-contract.md`] Sharing is limited to exactly one vault/account item per link. [VERIFIED: `AGENTS.md`, `.planning/REQUIREMENTS.md`] Backend compatibility must remain Cloudflare Workers, Docker, and Netlify through existing abstractions. [VERIFIED: `AGENTS.md`, `wrangler.toml`, `Dockerfile`, `netlify.toml`] Do not hand-edit `backend/dist/**` as primary implementation; edit `src/**` and rebuild outputs. [VERIFIED: `.planning/STATE.md`, `01-VERIFICATION.md`] Recipient responses must not leak vault lists, owner identity, session cookies, backup data, raw internal IDs, raw tokens, access-code hashes, passwords outside the allowlisted shared item view, or raw TOTP seeds. [VERIFIED: `AGENTS.md`, `.planning/REQUIREMENTS.md`, `docs/share-link-security-contract.md`]

## Summary

Phase 2 should implement API routes on top of the Phase 1 share primitives, not rebuild share security from scratch. [VERIFIED: `src/features/share/shareService.ts`, `src/shared/db/repositories/shareRepository.ts`, `src/shared/middleware/shareRateLimitMiddleware.ts`] Phase 1 already provides HMAC-derived token/code storage, one-item share persistence, expiration/revocation/deleted-item/wrong-code decisions, safe audit events, and fail-closed public rate limiting. [VERIFIED: `01-VERIFICATION.md`, `01-SECURITY.md`] The missing Phase 2 work is route mounting, owner-safe create/list/inspect/revoke responses, repository list/inspect queries, public recipient POST access with access code in the body, and `SharedItemView` construction that decrypts only the shared item and exposes password/current OTP by allowlist. [VERIFIED: `src/features/share/shareService.ts`, `src/features/share/shareTypes.ts`, `.planning/REQUIREMENTS.md`]

The existing app mounts Hono feature sub-apps from `src/app/index.ts` under `/api/*`, uses `authMiddleware` for cookie JWT, CSRF, and DB session validation, and centralizes expected failures through `AppError`. [VERIFIED: `src/app/index.ts`, `src/shared/middleware/auth.ts`, `src/app/config.ts`] Public recipient routes must bypass `authMiddleware` but still pass the global health gate and use the share-specific fail-closed limiter. [VERIFIED: `src/app/index.ts`, `src/shared/middleware/shareRateLimitMiddleware.ts`] Owner routes must use the same `authMiddleware` pattern as vault routes and derive `ownerId` as `user.email || user.id`. [VERIFIED: `src/features/vault/vaultRoutes.ts`, `src/shared/middleware/auth.ts`]

**Primary recommendation:** Add `src/features/share/shareRoutes.ts`, mount it at `/api/share`, and extend `ShareRepository`/`ShareService` with owner metadata methods and recipient DTO generation while preserving Phase 1 secret, audit, limiter, and header primitives. [VERIFIED: existing route/service/repository pattern in `src/features/vault/vaultRoutes.ts`, `src/features/share/shareService.ts`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Owner share create/list/inspect/revoke | API / Backend | Database / Storage | Owner auth, CSRF, ownership checks, metadata serialization, and revocation are backend decisions backed by `share_links`. [VERIFIED: `authMiddleware`, `ShareService`, `ShareRepository`] |
| Public recipient token/code access | API / Backend | Database / Storage | Recipient access must be unauthenticated but rate-limited, access-code protected, and resolved through hashed token lookup. [VERIFIED: `shareRateLimit`, `ShareService.resolveShareAccess`] |
| Share durable metadata | Database / Storage | API / Backend | `share_links` already stores owner, item, token hash, code hash, expiration, revocation, last access, and access count. [VERIFIED: `src/shared/db/schema/*.ts`, `backend/schema.sql`] |
| Shared item DTO allowlist | API / Backend | Browser / Client | The server must decrypt and reduce the vault item to `SharedItemView`; the client only renders the response. [VERIFIED: `SharedItemView` type, `VaultService` decrypt patterns] |
| Current TOTP code/countdown | API / Backend | Browser / Client | Existing OTP utilities generate current codes from decrypted secrets; v1 must not expose raw seeds. [VERIFIED: `src/shared/utils/otp/index.ts`, `docs/share-link-security-contract.md`] |
| Public no-store/no-referrer headers | API / Backend | Browser / Client | `getSharePublicHeaders()` defines the response protections; routes must apply those headers to Hono responses. [VERIFIED: `src/features/share/shareSecurity.ts`; CITED: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html] |
| Generated deployment bundles | Build / Tooling | API / Backend | Worker, Docker, and Netlify bundles are regenerated from `src/**` by backend build scripts. [VERIFIED: `backend/scripts/build-*.js`, `01-VERIFICATION.md`] |

## Project Constraints (from AGENTS.md)

- Shared links expose sensitive login material and require high-entropy tokens, expiration, revocation, and access-code protection by default. [VERIFIED: `AGENTS.md`]
- Sharing is limited to a single account/vault item per link. [VERIFIED: `AGENTS.md`]
- Backend compatibility must continue across Cloudflare Workers, Docker, and Netlify. [VERIFIED: `AGENTS.md`]
- Avoid platform-specific storage or crypto assumptions unless wrapped in existing abstractions. [VERIFIED: `AGENTS.md`]
- Follow existing Hono route, feature module, repository, and centralized error patterns. [VERIFIED: `AGENTS.md`, `.planning/codebase/ARCHITECTURE.md`]
- Frontend source is absent in this checkout, so Phase 2 should remain API-only and must not promise generated frontend edits. [VERIFIED: `.planning/source-provenance.md`, `rg --files frontend src`]
- Shared-link responses must avoid unrelated vault data, owner identity beyond necessity, session cookies, backup data, and unnecessary internal IDs. [VERIFIED: `AGENTS.md`]
- No project skills were found under `.claude/skills/` or `.agents/skills/`. [VERIFIED: `find .claude/skills .agents/skills -name SKILL.md`]

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OWN-01 | Authenticated owner can create a share link for one vault/account item they are allowed to access. | Use authenticated `POST /api/share` route calling `ShareService.createShare()`, which already checks `findActiveByIdForOwner()`. [VERIFIED: `shareService.ts`, `vaultRepository.ts`] |
| OWN-02 | Link creation requires expiration within max and access code by default. | `createShare()` clamps TTL and rejects out-of-bounds `expiresAt`; `generateAccessCode()` always creates a code. [VERIFIED: `shareService.ts`, `shareSecurity.ts`] |
| OWN-03 | Link creation returns raw token and access code exactly once. | `CreateShareResult` includes `rawToken` and `rawAccessCode`; list/inspect methods must omit them. [VERIFIED: `shareTypes.ts`, `shareService.ts`] |
| OWN-04 | Owner can list links with safe metadata. | Add `ShareRepository.listForOwner()` and `ShareService.listSharesForOwner()` returning id, item reference/display, status, created/expires/revoked/last-access/access-count only. [VERIFIED: `share_links` columns] [ASSUMED] |
| OWN-05 | Owner can inspect one link without raw token/code or credential values. | Add `findByIdForOwner()` serialization wrapper; existing repository lookup already scopes by owner. [VERIFIED: `shareRepository.ts`] |
| OWN-06 | Owner can revoke one share and revoked links immediately stop working. | `revokeShare()` sets `revokedAt` through `revokeForOwner()`; `resolveShareAccess()` rejects revoked rows before code verification. [VERIFIED: `shareService.ts`, `shareRepository.ts`] |
| OWN-07 | Owner APIs enforce auth/session/CSRF/ownership protections. | Apply `authMiddleware` to owner routes; use `ownerId = user.email || user.id`; do not expose unscoped repository methods. [VERIFIED: `authMiddleware.ts`, `vaultRoutes.ts`] |
| REC-01 | Friend can open public share link without NodeAuth account. | Mount a public route family under `/api/share/public/:token` without `authMiddleware`. [VERIFIED: `app.index.ts` route pattern] [ASSUMED] |
| REC-02 | Recipient access requires independent access code through non-URL channel. | Use `POST` with JSON body `{ accessCode }`; Hono request docs support path params and JSON body parsing. [CITED: https://hono.dev/docs/api/request; VERIFIED: `shareService.resolveShareAccess()` input] |
| REC-03 | Recipient response returns minimal `SharedItemView` only. | Extend `resolveShareAccess()` to construct allowlisted `SharedItemView`; tests must serialize response and reject internal fields. [VERIFIED: `shareTypes.ts`, `shareService.test.ts`] |
| REC-04 | Recipient response includes current TOTP code/countdown when item has TOTP data, not raw seed. | Use existing decrypt + OTP `generate()` helpers and compute `remainingSeconds = period - floor(now/1000) % period`. [VERIFIED: `vaultService.ts`, `otp/index.ts`, `totp.ts`] |
| REC-05 | Public endpoints use generic inaccessible-share errors. | Preserve `share_inaccessible`/generic inaccessible responses for missing, invalid, expired, revoked, deleted, locked, and wrong-code states. [VERIFIED: `shareService.ts`, `shareRateLimitMiddleware.ts`] |
| REC-06 | Public endpoints set no-store/no-referrer protections and avoid URL/log leakage. | Apply `getSharePublicHeaders()` to every public response; avoid query-string codes and address Hono logger path-token leakage. [VERIFIED: `shareSecurity.ts`, `hono logger local source`; CITED: OWASP REST/Logging cheat sheets] |
| UX-02 | API exposes enough safe status for future UI. | Owner metadata should include `status`, `createdAt`, `expiresAt`, `revokedAt`, `lastAccessedAt`, `accessCount`, and safe item label fields. [VERIFIED: `share_links` columns; `.planning/REQUIREMENTS.md`] |

</phase_requirements>

## Standard Stack

### Core

| Library | Project Version | Current Version | Purpose | Why Standard |
|---------|-----------------|-----------------|---------|--------------|
| Hono | `^4.12.12` | `4.12.16`, npm modified 2026-04-30 [VERIFIED: npm registry] | Route modules, middleware, path params, JSON responses, response headers | Existing app uses Hono and Hono docs support context headers and request params/JSON body parsing. [VERIFIED: `src/app/index.ts`; CITED: https://hono.dev/docs/api/context, https://hono.dev/docs/api/request] |
| Drizzle ORM | `^0.45.2` | `0.45.2`, npm modified 2026-05-01 [VERIFIED: npm registry] | Cross-dialect repository queries and updates | Existing repositories use Drizzle; official docs cover TypeScript `select`, `insert`, and `update` query builders. [VERIFIED: `shareRepository.ts`; CITED: https://orm.drizzle.team/docs/select] |
| Web Crypto API | Runtime API | Runtime API [CITED: Cloudflare Workers docs] | Token/code generation and HMAC secret derivation | Phase 1 uses `crypto.getRandomValues()` and `crypto.subtle.sign()`; Cloudflare Workers documents Web Crypto support. [VERIFIED: `shareSecurity.ts`; CITED: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/] |
| Vitest | `^4.1.0` | `4.1.5`, npm modified 2026-04-23 [VERIFIED: npm registry] | Focused service, repository, middleware, and route tests | Existing backend test command is `vitest run` and Phase 1 tests are under `src/**/*.test.ts`. [VERIFIED: `backend/package.json`, `backend/vitest.config.ts`] |
| TypeScript | `^5.9.3` | `6.0.3`, npm modified 2026-04-16 [VERIFIED: npm registry] | Source implementation and type contracts | Restored source is TypeScript and `tsconfig.json` maps `@/*` to `src/*`. [VERIFIED: `tsconfig.json`, `src/**`] |

### Supporting

| Library | Project Version | Current Version | Purpose | When to Use |
|---------|-----------------|-----------------|---------|-------------|
| Wrangler | `4.75.0` | `4.87.0`, npm modified 2026-04-30 [VERIFIED: npm registry] | Worker build/deploy validation | Use project-pinned backend/root scripts unless a separate upgrade phase exists. [VERIFIED: `package.json`, `backend/package.json`] |
| `@hono/node-server` | `^1.19.13` | `2.0.1`, npm modified 2026-04-30 [VERIFIED: npm registry] | Docker/Node Hono adapter | Keep for generated Docker server target; do not change for API routes. [VERIFIED: `src/app/server.ts`, `backend/package.json`] |
| Existing OTP utilities | Internal | Internal [VERIFIED: source] | Current TOTP/HOTP/Steam/Blizzard code generation | Use for `SharedItemView.otp`; do not add a new OTP library. [VERIFIED: `src/shared/utils/otp/index.ts`] |
| Existing crypto utilities | Internal | Internal [VERIFIED: source] | Decrypt vault secret with `ENCRYPTION_KEY` | Use `decryptField()` pattern from `VaultService`; do not expose decrypted seed. [VERIFIED: `src/features/vault/vaultService.ts`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing `src/features/share/shareRoutes.ts` Hono sub-app | Add owner endpoints under `vaultRoutes` | Avoid: share has public unauthenticated routes and share-specific limiter/header behavior; a dedicated feature route matches existing module boundaries. [VERIFIED: `app/index.ts`, `vaultRoutes.ts`] |
| Extending `ShareService` | Put serialization and OTP logic in routes | Avoid: Phase 1 intentionally keeps share decisions below routes; route-local logic would duplicate security checks. [VERIFIED: `01-PATTERNS.md`, `shareService.ts`] |
| Existing OTP generator | New TOTP implementation or npm package | Avoid: current app already handles TOTP/HOTP/Steam/Blizzard variants. [VERIFIED: `otp/index.ts`] |
| Hono `c.header()` | Hand-construct every `Response` | Hono docs support setting headers on context; use context headers for consistency unless returning a raw `Response` is simpler. [CITED: https://hono.dev/docs/api/context] |

**Installation:**

```bash
npm ci --prefix backend
```

**Validation commands:**

```bash
npm --prefix backend test -- src/features/share/shareService.test.ts src/shared/middleware/shareRateLimitMiddleware.test.ts
npm --prefix backend test
npm --prefix backend run build:worker
npm --prefix backend run build:docker
npm --prefix backend run build:netlify
node scripts/restore_backend_source_from_sourcemaps.js --verify
```

## Architecture Patterns

### System Architecture Diagram

```text
Owner browser/API client
    -> POST/GET/DELETE /api/share/*
    -> global health gate
    -> authMiddleware (JWT cookie + CSRF header + DB session)
    -> shareRoutes owner handlers
    -> ShareService owner methods
    -> VaultRepository owner/deleted-item checks
    -> ShareRepository create/list/find/revoke
    -> safe owner metadata JSON

Friend browser/API client
    -> POST /api/share/public/:token/access with { accessCode }
    -> global health gate
    -> shareRateLimit() fail-closed middleware
    -> ShareService.resolveShareAccess(token, accessCode)
    -> token hash lookup + expiration/revocation/deleted-item/code checks
    -> decrypt one vault item secret
    -> generate current OTP code/countdown when supported
    -> c.header(no-store/no-referrer)
    -> minimal SharedItemView JSON or generic inaccessible JSON

Source implementation
    -> npm --prefix backend run build:worker/build:docker/build:netlify
    -> regenerated backend/dist/* outputs
```

### Recommended Project Structure

```text
src/
├── app/
│   └── index.ts                         # Mount /api/share after existing feature routes
├── features/share/
│   ├── shareRoutes.ts                   # New owner + public recipient Hono routes
│   ├── shareRoutes.test.ts              # Route contract tests for auth/public/header behavior
│   ├── shareService.ts                  # Extend with owner metadata + SharedItemView generation
│   ├── shareService.test.ts             # Extend existing service tests
│   ├── shareTypes.ts                    # Add owner metadata DTO/input contracts
│   └── shareSecurity.ts                 # Reuse existing token/code/header/origin helpers
└── shared/db/repositories/
    └── shareRepository.ts               # Add list/find metadata queries
```

### Pattern 1: Hono Feature Route Mount

**What:** Create a feature sub-app and mount it in `src/app/index.ts`. [VERIFIED: `src/app/index.ts`]

**When to use:** Use for all Phase 2 share API endpoints. [VERIFIED: `.planning/ROADMAP.md`]

**Example:**

```typescript
// Source: existing pattern in src/app/index.ts
app.route('/api/vault', vaultRoutes);
app.route('/api/share', shareRoutes);
```

### Pattern 2: Owner Routes Use Existing Auth/CSRF Middleware

**What:** Apply `authMiddleware` only to owner management routes and derive owner id from `c.get('user')`. [VERIFIED: `vaultRoutes.ts`, `auth.ts`]

**When to use:** `POST /api/share`, `GET /api/share`, `GET /api/share/:id`, and `DELETE /api/share/:id`. [ASSUMED]

**Example:**

```typescript
// Source basis: src/features/vault/vaultRoutes.ts
share.use('/owner/*', authMiddleware);
const user = c.get('user');
const ownerId = user.email || user.id;
```

### Pattern 3: Public Route Applies Headers From Service Decision

**What:** Convert `decision.publicHeaders` into Hono response headers before returning any public JSON. [VERIFIED: `getSharePublicHeaders()`; CITED: Hono context docs]

**When to use:** Every public recipient success and inaccessible response. [VERIFIED: REC-06]

**Example:**

```typescript
for (const [name, value] of Object.entries(decision.publicHeaders || {})) {
    c.header(name, value);
}
return c.json({ success: decision.accessible, data: decision.itemView });
```

### Pattern 4: SharedItemView Is an Explicit Allowlist

**What:** Build a new object from selected fields instead of spreading a vault item. [VERIFIED: `SharedItemView`, `VaultService` decrypted item patterns]

**When to use:** Recipient success response only. [VERIFIED: REC-03, REC-04]

**Example:**

```typescript
const itemView: SharedItemView = {
    service: vaultItem.service,
    account: vaultItem.account,
    password: decryptedSecret,
    otp: otpCode ? {
        code: otpCode,
        period,
        remainingSeconds,
    } : undefined,
};
```

### Anti-Patterns to Avoid

- **Adding access code to query strings:** OWASP REST guidance says sensitive values should not appear in URLs; use JSON body or header. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html]
- **Spreading `vaultItem` into recipient JSON:** Vault rows contain internal IDs, encrypted secret fields, owner fields, timestamps, and operational metadata. [VERIFIED: `src/shared/db/schema/*.ts`, `vaultRepository.ts`]
- **Returning raw token or raw access code from list/inspect:** OWN-03 allows raw values only at create time. [VERIFIED: `.planning/REQUIREMENTS.md`, `CreateShareResult`]
- **Mounting public share routes behind `authMiddleware`:** REC-01 requires no NodeAuth account. [VERIFIED: `.planning/REQUIREMENTS.md`]
- **Skipping the Hono logger leak check:** Hono logger logs method and path, so token-in-path routes can put raw tokens in request logs unless share paths are excluded or redacted. [VERIFIED: local `backend/node_modules/hono/dist/middleware/logger/index.js`; CITED: OWASP Logging Cheat Sheet]
- **Implementing cleanup:** Expired share cleanup and stale rate-limit maintenance are Phase 3, not Phase 2. [VERIFIED: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Routing and middleware | Custom router or separate API server | Existing Hono app | App already handles global middleware, deployment targets, and centralized errors. [VERIFIED: `src/app/index.ts`] |
| Owner auth/session/CSRF | New share-only auth checks | `authMiddleware` | Existing middleware verifies JWT cookie, CSRF double-submit, and DB session validity. [VERIFIED: `auth.ts`] |
| Share token/code generation | Random strings via `Math.random()` | `generateShareToken()` / `generateAccessCode()` | Phase 1 uses Web Crypto random bytes and HMAC storage. [VERIFIED: `shareSecurity.ts`; CITED: Cloudflare Web Crypto docs] |
| Public share rate limiting | Existing fail-open `rateLimit()` | `shareRateLimit()` | Share limiter fails closed and avoids raw-token persistence. [VERIFIED: `shareRateLimitMiddleware.ts`] |
| OTP calculation | New TOTP implementation | Existing `generate()`/`generateTOTP()` utilities | Current app already supports protocol variants and period/digit/algorithm options. [VERIFIED: `otp/index.ts`] |
| Owner metadata calculation | Raw SQL in route | `ShareRepository` methods | Existing architecture keeps persistence in repositories. [VERIFIED: `.planning/codebase/ARCHITECTURE.md`, `shareRepository.ts`] |
| Response redaction | Ad hoc route deletes after object spread | Construct DTO allowlists | Secret-bearing rows should never be copied into public responses. [VERIFIED: `docs/share-link-security-contract.md`; CITED: OWASP Logging Cheat Sheet] |

**Key insight:** Phase 2 is an API contract and serialization phase; the highest-risk work is preventing route responses and logs from undoing the Phase 1 secret-storage guarantees. [VERIFIED: Phase 1 verification + current route/logger code]

## Common Pitfalls

### Pitfall 1: Owner List/Inspect Leaks One-Time Secrets

**What goes wrong:** Raw token, raw access code, token hash, access-code hash, or public URL appears outside the create response. [VERIFIED: OWN-03, OWN-05]  
**Why it happens:** `ShareService.createShare()` currently returns internal `ShareLinkRecord` fields including hashes to its caller. [VERIFIED: `shareService.ts`]  
**How to avoid:** Add route-facing DTOs such as `OwnerShareCreatedView` and `OwnerShareMetadataView`; never return `ShareLinkRecord` directly from routes. [VERIFIED: `shareTypes.ts`] [ASSUMED]  
**Warning signs:** Tests serialize owner list/inspect responses and find `tokenHash`, `accessCodeHash`, `rawToken`, `rawAccessCode`, `password`, or `secret`. [VERIFIED: existing serialization test pattern]

### Pitfall 2: Public Token Appears In Logs

**What goes wrong:** `/api/share/public/:token` path is logged by global Hono logger. [VERIFIED: `src/app/index.ts`, local Hono logger source]  
**Why it happens:** Hono logger derives `path` from the full request URL and logs it. [VERIFIED: `backend/node_modules/hono/dist/middleware/logger/index.js`]  
**How to avoid:** Exclude or redact public share paths before Hono logger logs them, or mount a share-safe logger strategy before public routes ship. [VERIFIED: current app logs all `*`; CITED: OWASP Logging Cheat Sheet]  
**Warning signs:** Test or manual request logs include a raw token substring. [VERIFIED: REC-06]

### Pitfall 3: TOTP DTO Accidentally Shares The Seed

**What goes wrong:** Recipient can generate future codes indefinitely because the raw seed or otpauth URI is returned. [VERIFIED: REC-04, contract]  
**Why it happens:** Existing export paths intentionally decrypt and expose full secret material for authenticated owners. [VERIFIED: `VaultService.exportAccounts()`]  
**How to avoid:** For recipients, decrypt only inside the service, compute current code/countdown, and omit seed/otpauth URI. [VERIFIED: `otp/index.ts`, `shareTypes.ts`]  
**Warning signs:** `SharedItemView` or public tests contain `secret`, `otpAuthUri`, `otpauth`, `seed`, `counter` for TOTP, or encrypted DB fields. [VERIFIED: existing redaction tests]

### Pitfall 4: Wrong Public Status Semantics

**What goes wrong:** Missing, invalid, expired, revoked, deleted, locked, and wrong-code states reveal which state occurred to recipients. [VERIFIED: REC-05]  
**Why it happens:** Service decisions internally know `status` and branch details. [VERIFIED: `resolveShareAccess()`]  
**How to avoid:** Public route should collapse all inaccessible outcomes to a generic `share_inaccessible` JSON envelope and status code; owner list/inspect can show safe status separately. [VERIFIED: `docs/share-link-security-contract.md`, `.planning/REQUIREMENTS.md`]  
**Warning signs:** Public response body says `expired`, `revoked`, `wrong_code`, `not_found`, or `locked`. [VERIFIED: REC-05]

### Pitfall 5: Owner Route Ownership Is Incomplete

**What goes wrong:** An authenticated user lists, inspects, or revokes another owner's share. [VERIFIED: OWN-07]  
**Why it happens:** Repository methods without `ownerId` filters are convenient but unsafe. [VERIFIED: `ShareRepository.findByTokenHash()` is public-token oriented]  
**How to avoid:** Owner routes must use owner-scoped repository/service methods only, especially `findByIdForOwner()` and new `listForOwner()`. [VERIFIED: `shareRepository.ts`]  
**Warning signs:** Route accepts `ownerId` from request body or calls unscoped `findByTokenHash()` for owner inspect/revoke. [VERIFIED: `authMiddleware` user context pattern]

## Code Examples

### Owner Route Shape

```typescript
// Source basis: src/features/vault/vaultRoutes.ts and src/features/share/shareService.ts
share.post('/', authMiddleware, async (c) => {
    const user = c.get('user');
    const ownerId = user.email || user.id;
    const body = await c.req.json();
    const service = createShareService(c.env);
    const result = await service.createShare({
        ownerId,
        vaultItemId: body.vaultItemId,
        ttlSeconds: body.ttlSeconds,
        expiresAt: body.expiresAt,
        publicOrigin: c.env.NODEAUTH_PUBLIC_ORIGIN || new URL(c.req.url).origin,
    });

    return c.json({
        success: true,
        share: toOwnerCreatedView(result),
    });
});
```

### Public Recipient Route Shape

```typescript
// Source basis: shareRateLimit() and Hono request/context docs
share.post('/public/:token/access', shareRateLimit(), async (c) => {
    const token = c.req.param('token');
    const body = await c.req.json().catch(() => ({}));
    const decision = await createShareService(c.env).resolveShareAccess({
        token,
        accessCode: typeof body.accessCode === 'string' ? body.accessCode : '',
        requestOrigin: new URL(c.req.url).origin,
    });

    for (const [name, value] of Object.entries(decision.publicHeaders || {})) {
        c.header(name, value);
    }

    if (!decision.accessible) {
        return c.json({ success: false, message: 'share_inaccessible', data: null }, 404);
    }

    return c.json({ success: true, data: decision.itemView });
});
```

### TOTP Current-Code Construction

```typescript
// Source basis: src/shared/utils/otp/index.ts and src/shared/utils/otp/protocols/totp.ts
const period = Number(vaultItem.period || 30);
const code = await generate(
    decryptedSecret,
    period,
    Number(vaultItem.digits || 6),
    vaultItem.algorithm || 'SHA1',
    vaultItem.type || 'totp',
    now,
);
const remainingSeconds = period - (Math.floor(now / 1000) % period);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generated backend bundles as only editable code | Restored `src/**` source with build scripts and source-map verification | Phase 1 Plan 01, 2026-05-02 [VERIFIED: `01-01-SUMMARY.md`] | Phase 2 must edit TypeScript source and rebuild bundles. [VERIFIED: `01-VERIFICATION.md`] |
| No share state/API primitives | `share_links`, `share_audit_events`, `share_rate_limits`, `ShareService`, `ShareRepository`, `shareRateLimit()` | Phase 1 Plans 02-07, 2026-05-02 [VERIFIED: summaries] | Phase 2 should add route/API behavior only. [VERIFIED: `01-VERIFICATION.md`] |
| Existing generic rate limiter fails open | Dedicated share limiter fails closed | Phase 1 Plan 03/05/07 [VERIFIED: summaries, middleware source] | Public recipient route must use `shareRateLimit()`, not `rateLimit()`. [VERIFIED: middleware tests] |
| Public share decisions could carry internal share record | Public decisions now return `share: null` and public headers | Phase 1 Plan 05 [VERIFIED: `01-05-SUMMARY.md`] | Routes need safe response envelopes and owner-specific DTOs. [VERIFIED: `shareTypes.ts`] |

**Deprecated/outdated:**
- Hand-patching `backend/dist/**` for share APIs is out of bounds. [VERIFIED: `.planning/REQUIREMENTS.md`, `.planning/STATE.md`]
- Exposing raw TOTP seeds to recipients is unsupported by default. [VERIFIED: `.planning/REQUIREMENTS.md`, `docs/share-link-security-contract.md`]
- Adding frontend UI edits is out of current checkout scope because editable frontend source is absent. [VERIFIED: `.planning/source-provenance.md`, `rg --files frontend`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended endpoint names are `POST /api/share`, `GET /api/share`, `GET /api/share/:id`, `DELETE /api/share/:id`, and `POST /api/share/public/:token/access`. | Phase Requirements / Patterns | Planner may need to rename route paths if user expects a different API contract. |
| A2 | DTO names such as `OwnerShareMetadataView` and `OwnerShareCreatedView` are acceptable. | Common Pitfalls / Patterns | Planner may choose different names, but behavior remains required. |
| A3 | `/api/share/public/:token/access` should be the API-only recipient access endpoint while `/share/:token` remains the future UI URL generated by `buildShareUrl()`. | Open Questions | Planner may need to add a different public route or adjust URL generation. |
| A4 | Current backend schema has no separate password/login-secret column, so Phase 2 should map only available fields and not invent a password schema. | Open Questions | Product expectations may require a schema/model clarification before recipient password disclosure can be implemented. |
| A5 | Logger redaction belongs in Phase 2, not Phase 3, because REC-06 includes log leakage prevention. | Open Questions | Planner could defer logger work and leave REC-06 incomplete for this phase. |
| A6 | Research validity window is 30 days for codebase-specific patterns and package/docs should be rechecked after 2026-06-02. | Metadata | Planner may rely on stale package/doc versions if planning happens much later. |

## Open Questions

1. **Public route token placement**
   - What we know: public share URLs currently build as `/share/:token`, while API calls are mounted under `/api/*`. [VERIFIED: `buildShareUrl()`, `app/index.ts`]
   - What's unclear: whether Phase 2 should serve an API-only `/api/share/public/:token/access` endpoint, add a `/share/:token` API fallback, or leave `/share/:token` to future frontend/static handling. [ASSUMED]
   - Recommendation: implement API-only recipient access under `/api/share/public/:token/access` and keep `/share/:token` as the future UI URL generated by `buildShareUrl()`. [ASSUMED]

2. **Password field semantics in `SharedItemView`**
   - What we know: current vault `secret` stores OTP secret material, and `SharedItemView.password` exists as an optional field. [VERIFIED: `shareTypes.ts`, `vaultService.ts`]
   - What's unclear: whether this NodeAuth vault item also has a separate password/login-secret field in the frontend model that is absent from restored backend source. [VERIFIED: current `vault` schema lacks a separate password column]
   - Recommendation: map only available backend fields in Phase 2 and document that current OTP code is supported when OTP data exists; do not invent schema for a separate password field in this API phase. [VERIFIED: `backend/schema.sql`] [ASSUMED]

3. **Logger redaction implementation**
   - What we know: current global Hono logger logs full path, which can include the raw token. [VERIFIED: local Hono logger source]
   - What's unclear: whether planner should add logger redaction in Phase 2 or defer to Phase 3 hardening. [ASSUMED]
   - Recommendation: include it in Phase 2 because REC-06 explicitly requires avoiding sensitive values in logs for public endpoints. [VERIFIED: REC-06]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Backend tests/build scripts | Yes | `v22.22.2` local; project targets Node 24 for Docker/Netlify [VERIFIED: `node --version`, `Dockerfile`, workflow docs] | Use Docker/CI Node 24 for final compatibility if local mismatch matters. [VERIFIED: `Dockerfile`] |
| npm | Dependency install and scripts | Yes | `10.9.7` [VERIFIED: `npm --version`] | None needed. |
| npx | Registry/doc fallback commands | Yes | `10.9.7` [VERIFIED: `npx --version`] | Use installed package docs/source where available. |
| Wrangler | Worker build/deploy validation | Yes | global `4.85.0`; project pins `4.75.0` [VERIFIED: `wrangler --version`, package manifests] | Use `npm --prefix backend run build:worker` and project-pinned dependencies. |
| Docker | Optional runtime compatibility validation | Yes | `29.2.1` [VERIFIED: `docker --version`] | Use backend build scripts if container execution is not needed in Phase 2. |
| Context7 CLI docs lookup | Library docs lookup | No | `ctx7` fetch failed during research [VERIFIED: `npx --yes ctx7@latest ...` failure] | Official docs and installed package source were used. |

**Missing dependencies with no fallback:** None for research and normal Phase 2 source/test/build planning. [VERIFIED: environment audit]

**Missing dependencies with fallback:** Context7 docs lookup failed; official Hono, Drizzle, Cloudflare, and OWASP docs plus local installed Hono source were used. [VERIFIED: command failure; CITED: docs URLs in Sources]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V6 Authentication | Yes for owner APIs; no for recipient account login | Owner routes use existing JWT cookie + CSRF + DB session middleware; recipient route uses possession of token plus independent access code. [VERIFIED: `authMiddleware.ts`, `shareService.ts`; CITED: OWASP ASVS 5.0 categories] |
| V7 Session Management | Yes for owner APIs | Existing session validation must remain in `authMiddleware`; public recipient route must not set or require session cookies. [VERIFIED: `authMiddleware.ts`, REC-01] |
| V8 Authorization | Yes | Owner operations must filter by `ownerId`; share creation must verify vault item access; recipient access must resolve one share only. [VERIFIED: `vaultRepository.findActiveByIdForOwner`, `shareRepository.findByIdForOwner`] |
| V2 Validation and Business Logic | Yes | Validate TTL bounds, body access-code presence/type, route ids/tokens, and one-item scope server-side. [VERIFIED: `shareService.createShare`; CITED: OWASP ASVS taxonomy] |
| V4 API and Web Service | Yes | Use explicit JSON envelopes, no sensitive values in URLs except high-entropy token path component, no raw code in query, and no-store public responses. [VERIFIED: requirements; CITED: OWASP REST Security Cheat Sheet] |
| V11 Cryptography | Yes | Reuse Web Crypto HMAC/token primitives and existing AES-GCM vault decryption; never add custom crypto. [VERIFIED: `shareSecurity.ts`, `crypto.ts`; CITED: Cloudflare Web Crypto docs] |
| V16 Security Logging and Error Handling | Yes | Keep generic public errors and audit/log allowlists; redact public token paths. [VERIFIED: `shareService.ts`, `docs/share-link-security-contract.md`; CITED: OWASP Logging Cheat Sheet] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Broken owner authorization | Elevation of Privilege | Require `authMiddleware` and owner-scoped repository/service calls for every owner route. [VERIFIED: `auth.ts`, `shareRepository.ts`] |
| Access-code brute force | Spoofing / DoS | Use `shareRateLimit()` before public access resolution and keep generic inaccessible responses. [VERIFIED: `shareRateLimitMiddleware.ts`] |
| Token/code leakage through URLs/logs | Information Disclosure | Put access code in body, redact/exclude public token paths from logger, never audit full URLs. [VERIFIED: Hono logger source, contract; CITED: OWASP REST and Logging cheat sheets] |
| DTO overexposure | Information Disclosure | Build owner and recipient DTO allowlists; serialize tests should reject forbidden fields. [VERIFIED: `shareService.test.ts` pattern] |
| TOTP seed disclosure | Information Disclosure | Generate current OTP code from decrypted secret and omit raw seed/otpauth URI. [VERIFIED: REC-04, `otp/index.ts`] |
| Cache/referrer leakage | Information Disclosure | Apply `Cache-Control: no-store`, `Pragma: no-cache`, and `Referrer-Policy: no-referrer` to public responses. [VERIFIED: `getSharePublicHeaders()`; CITED: OWASP REST Security Cheat Sheet, MDN Referrer-Policy] |

## Sources

### Primary (HIGH confidence)

- `AGENTS.md` - project constraints, API-only/frontend-source warning, security posture. [VERIFIED]
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` - phase scope, requirement IDs, deferred Phase 3 work. [VERIFIED]
- `.planning/phases/01-foundation-and-security-primitives/01-RESEARCH.md`, `01-PATTERNS.md`, `01-SECURITY.md`, `01-VERIFICATION.md`, `01-01-SUMMARY.md` through `01-07-SUMMARY.md` - Phase 1 primitives and validation evidence. [VERIFIED]
- `src/app/index.ts`, `src/shared/middleware/auth.ts`, `src/features/vault/vaultRoutes.ts` - route, health, auth, CSRF, session patterns. [VERIFIED]
- `src/features/share/shareTypes.ts`, `shareSecurity.ts`, `shareService.ts`, `sharePrimitives.ts`, `src/shared/middleware/shareRateLimitMiddleware.ts`, `src/shared/db/repositories/shareRepository.ts` - share primitives to extend. [VERIFIED]
- `src/shared/utils/otp/index.ts`, `src/shared/utils/otp/protocols/totp.ts`, `src/features/vault/vaultService.ts`, `src/shared/utils/crypto.ts` - decrypt and OTP behavior. [VERIFIED]
- npm registry checks for Hono, Drizzle ORM, Vitest, Wrangler, TypeScript, and `@hono/node-server`. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)

- Hono Context docs - `c.header()` and response helpers. [CITED: https://hono.dev/docs/api/context]
- Hono Request docs - path params and JSON body parsing. [CITED: https://hono.dev/docs/api/request]
- Drizzle ORM Select docs - query-builder patterns. [CITED: https://orm.drizzle.team/docs/select]
- Cloudflare Workers Web Crypto docs - Worker `crypto.subtle` and `crypto.getRandomValues()` support. [CITED: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/]
- OWASP REST Security Cheat Sheet - `Cache-Control: no-store` and sensitive data outside URLs. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html]
- OWASP Logging Cheat Sheet - exclude/mask access tokens, passwords, session IDs, and secrets in logs. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html]
- MDN Referrer-Policy docs - `no-referrer` behavior. [CITED: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy]
- OWASP ASVS 5.0 project/taxonomy - applicable security categories. [CITED: https://owasp.org/www-project-application-security-verification-standard/, https://cornucopia.owasp.org/taxonomy/asvs-5.0]

### Tertiary (LOW confidence)

- None. [VERIFIED: all recommendations are based on local source or official docs except assumptions logged above]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions were checked through npm registry and current manifests/source were read. [VERIFIED: npm registry, package manifests]
- Architecture: HIGH - Phase 1 restored source and current Hono/Drizzle route/service/repository patterns are present. [VERIFIED: `src/**`, `01-VERIFICATION.md`]
- Pitfalls: HIGH - risks are tied to explicit requirements, current Hono logger behavior, and existing DTO/test patterns. [VERIFIED: requirements, local Hono source, tests]
- Public endpoint names: MEDIUM - recommended paths are not locked by CONTEXT.md. [ASSUMED]

**Research date:** 2026-05-03  
**Valid until:** 2026-06-02 for codebase-specific patterns; re-check npm/doc versions after 30 days. [ASSUMED]
