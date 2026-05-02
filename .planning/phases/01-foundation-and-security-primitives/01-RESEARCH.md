# Phase 1: Foundation and Security Primitives - Research

**Researched:** 2026-05-02
**Domain:** Brownfield Hono/Drizzle security foundation for account share links
**Confidence:** HIGH for checkout/source/build constraints; MEDIUM for share-link implementation details because editable TypeScript source is missing in this workspace.

## Summary

Phase 1 must start by restoring or locating editable source before feature implementation because this checkout contains generated backend bundles and source maps, but not `src/**`, `backend/scripts/**`, frontend source, TypeScript config, or tests. [VERIFIED: `rg --files`, `backend/package.json`, source maps] The backend package declares source-oriented scripts such as `wrangler deploy --minify ./src/app/worker.ts`, `node scripts/build-worker.js`, `node scripts/build-docker.js`, and `node scripts/build-netlify.js`, but those referenced source files/scripts are not present. [VERIFIED: `backend/package.json`, `find backend frontend scripts`] The planner should treat "recover source/build provenance" as Wave 0 and must not plan hand edits to `backend/dist/**` as the primary path. [VERIFIED: `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `AGENTS.md`]

Once editable source exists, the share-link foundation belongs below routes: schema definitions, migrations, repositories, service-level security decisions, utility functions for token/code hashing, fail-closed rate limiting, and a written security contract. [VERIFIED: `.planning/codebase/ARCHITECTURE.md`, source-map modules `src/shared/db/schema/*`, `src/shared/db/migrator.ts`, `src/features/vault/vaultService.ts`, `src/shared/middleware/rateLimitMiddleware.ts`] The existing route pattern is Hono sub-apps mounted from `src/app/index.ts`, while feature services call repository classes rather than putting persistence logic in routes. [VERIFIED: `backend/dist/worker/worker.js.map` source contents]

**Primary recommendation:** Plan Phase 1 as source/provenance restoration first, then implement `shareLinks`/`shareAuditEvents` schema and repository/service primitives from TypeScript source, with raw tokens and access codes generated once and stored only as keyed hashes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Editable source and reproducible build path | Build / Tooling | Backend runtime | Build scripts and source layout decide whether generated Worker, Docker, and Netlify bundles can be safely produced. [VERIFIED: `backend/package.json`, `.planning/codebase/CONCERNS.md`] |
| Security contract | API / Backend | Frontend/API docs | Token validation, revocation, expiration, TOTP disclosure, logging, and cache/referrer protections are server guarantees; UI only reflects the contract. [VERIFIED: `.planning/REQUIREMENTS.md`] |
| Share durable state | Database / Storage | API / Backend | Share links, token hashes, access-code hashes, status, item references, and audit events must persist across supported runtimes. [VERIFIED: `backend/schema.sql`, source-map schemas] |
| Token/code generation and hashing | API / Backend | Database / Storage | Secrets must be generated, shown once, hashed with server-side material, and compared server-side; the database stores only derived values. [CITED: OWASP Password Storage Cheat Sheet; Cloudflare Workers Web Crypto docs] |
| Expiration/revocation/deleted-item checks | API / Backend | Database / Storage | Public route behavior must depend on service/repository checks, not route-local branching. [VERIFIED: `.planning/REQUIREMENTS.md`, `src/features/vault/vaultService.ts` pattern] |
| Share-specific rate limiting | API / Backend | Database / Storage | Current reusable limiter fails open on DB errors; share access must use a fail-closed variant or option before public endpoints exist. [VERIFIED: `src/shared/middleware/rateLimitMiddleware.ts` lines 101-108] |
| Owner/recipient UI scope identification | Frontend | API / Backend | UX-04 requires identifying UI surfaces if editable frontend source exists; this checkout only has `frontend/dist/**`. [VERIFIED: `rg --files`, `.planning/REQUIREMENTS.md`] |

## Project Constraints (from AGENTS.md)

- Shared links expose sensitive login material, so links need high-entropy tokens, expiration, revocation, and access-code protection by default. [VERIFIED: `AGENTS.md`]
- Sharing is limited to a single account/vault item per link. [VERIFIED: `AGENTS.md`]
- Backend compatibility must continue across Cloudflare Workers, Docker, and Netlify. [VERIFIED: `AGENTS.md`, `wrangler.toml`, `Dockerfile`, `netlify.toml`]
- Avoid platform-specific storage or crypto assumptions unless wrapped in existing abstractions. [VERIFIED: `AGENTS.md`]
- Follow existing Hono route, feature module, repository, and centralized error patterns. [VERIFIED: `AGENTS.md`, `.planning/codebase/ARCHITECTURE.md`]
- Frontend and TypeScript source may be missing; planning must verify available editable source before promising UI changes. [VERIFIED: `AGENTS.md`, `rg --files`]
- Shared-link responses must not leak vault lists, owner identity beyond what is necessary, session cookies, backup data, or internal IDs not needed by the recipient. [VERIFIED: `AGENTS.md`]
- No `CLAUDE.md` exists in this workspace, so there are no additional CLAUDE.md directives. [VERIFIED: `test -f CLAUDE.md`]
- No project skills were found under `.claude/skills/` or `.agents/skills/`. [VERIFIED: `find .claude/skills .agents/skills -name SKILL.md`]

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | Maintainer can identify editable backend source, schema source, build scripts, and tests needed to implement share links without hand-patching generated bundles. | Research verified source is absent and source maps list expected modules to restore. [VERIFIED: `rg --files`, source maps] |
| FND-02 | Maintainer can run or document a reproducible backend build path for Cloudflare Worker, Docker, and Netlify outputs before API work begins. | Research identifies declared but currently broken build scripts and target outputs. [VERIFIED: `backend/package.json`] |
| FND-03 | Written security contract covering token handling, access-code policy, expiration limits, revocation semantics, TOTP disclosure, logging, cache headers, referrer policy, and canonical public origin. | Research defines contract topics and sources for cryptographic/log/cache controls. [CITED: OWASP cheat sheets; Cloudflare Web Crypto docs] |
| STATE-01 | Persist share-link records for exactly one owner-accessible vault/account item per link. | Research recommends `share_links` with one `vault_item_id` and owner identifier. [VERIFIED: `vault` schema; ASSUMED: final owner scoping model] |
| STATE-02 | Store share URL tokens and access codes only as hashes or derived values. | Research recommends keyed SHA-256/HMAC-style hashing with raw values returned once. [CITED: Cloudflare Web Crypto docs; OWASP Password Storage Cheat Sheet] |
| STATE-03 | Enforce expiration, revocation, deleted-item checks, and inaccessible-share status in server repository/service logic. | Research maps checks to repository/service primitives below route layer. [VERIFIED: existing service/repository pattern] |
| STATE-04 | Record safe audit events without logging secrets, raw tokens, access codes, or full share URLs. | Research recommends separate audit table with safe metadata only. [CITED: OWASP Logging Cheat Sheet] |
| STATE-05 | Apply share-specific rate limiting and fail closed when protection cannot be enforced. | Research identifies existing limiter fails open and recommends share-specific fail-closed limiter. [VERIFIED: `rateLimitMiddleware.ts`] |
| UX-04 | Identify owner/recipient UI surfaces if editable frontend source is available; otherwise v1 remains API-only. | Research verifies only `frontend/dist/**` exists in this checkout. [VERIFIED: `rg --files`] |

</phase_requirements>

## Standard Stack

### Core

| Library | Project Version | Registry Version Checked | Purpose | Why Standard |
|---------|-----------------|--------------------------|---------|--------------|
| Hono | `^4.12.12` | `4.12.16`, modified 2026-04-30 [VERIFIED: npm registry] | API routing, middleware, sub-app mounting | Existing backend app uses Hono and mounts feature routes under `/api/*`. [VERIFIED: `src/app/index.ts` source map] |
| Drizzle ORM | `^0.45.2` | `0.45.2`, modified 2026-05-01 [VERIFIED: npm registry] | Cross-dialect schema/query layer | Existing repositories and schemas use Drizzle across SQLite/D1, MySQL, and PostgreSQL. [VERIFIED: source maps] |
| Web Crypto API | Runtime-provided | Runtime API, not npm [CITED: Cloudflare Workers Web Crypto docs] | Random token/code generation and digest/HMAC primitives | Works in Cloudflare Workers and modern Node runtimes through standard `crypto`/`crypto.subtle`. [CITED: Cloudflare Workers Web Crypto docs; VERIFIED: project Node target] |
| Vitest | `^4.1.0` | `4.1.5`, modified 2026-04-23 [VERIFIED: npm registry] | Unit tests for utilities, services, repositories, route contracts | Existing backend test command is `vitest run`. [VERIFIED: `backend/package.json`] |

### Supporting

| Library | Project Version | Registry Version Checked | Purpose | When to Use |
|---------|-----------------|--------------------------|---------|-------------|
| `@hono/node-server` | `^1.19.13` | `2.0.1`, modified 2026-04-30 [VERIFIED: npm registry] | Docker/Node Hono adapter | Existing Docker source-map entrypoint uses `serve`. Keep project version unless Phase 1 explicitly includes dependency upgrades. [VERIFIED: `src/app/server.ts` source map] |
| Wrangler | root `4.75.0`, backend `4.75.0` | `4.87.0`, modified 2026-04-30 [VERIFIED: npm registry] | Cloudflare Worker dev/deploy | Required for Worker deployment/build validation; root installed CLI reports `4.85.0`, project manifests pin `4.75.0`. [VERIFIED: package manifests, `wrangler --version`] |
| tsup | `^8.4.0` | `8.5.1`, modified 2025-11-12 [VERIFIED: npm registry] | Backend bundling scripts | Use only after restoring `backend/scripts/build-*.js`; scripts are missing now. [VERIFIED: `backend/package.json`, `find backend`] |
| TypeScript | `^5.9.3` | `6.0.3`, modified 2026-04-16 [VERIFIED: npm registry] | Backend source language | Source maps show TypeScript source; `tsconfig.json` is missing in this checkout. [VERIFIED: source maps, `find`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing Hono + feature route pattern | New Express/Fastify server | Do not introduce; all deployment bundles and route modules are already Hono. [VERIFIED: source maps] |
| Existing Drizzle schemas/repositories | Raw SQL in route handlers | Avoid; raw route SQL would bypass existing repository pattern and complicate cross-engine behavior. [VERIFIED: `.planning/codebase/ARCHITECTURE.md`] |
| Web Crypto | Node-only `crypto` APIs | Avoid direct Node-only assumptions because Cloudflare Workers are a first-class target. [VERIFIED: `wrangler.toml`; CITED: Cloudflare Workers Web Crypto docs] |
| Reconstruct source from source maps | Hand-patch `backend/dist/**` | Source-map reconstruction can support restoration, but generated bundles should not be the primary implementation surface. [VERIFIED: `.planning/REQUIREMENTS.md`] |

**Installation / restoration baseline:**

```bash
npm install --prefix backend
npm --prefix backend test
npm --prefix backend run build:worker
npm --prefix backend run build:docker
npm --prefix backend run build:netlify
```

These commands are declared but not currently reproducible because `backend/node_modules`, `backend/scripts/build-*.js`, `src/**`, `tsconfig.json`, and test files are missing. [VERIFIED: `backend/package.json`, `find`, environment audit]

## Architecture Patterns

### System Architecture Diagram

```text
Owner authenticated request
    -> Hono app `/api/*` middleware
    -> auth/session/CSRF health gate
    -> future `shareRoutes` owner endpoint
    -> `ShareService.createShare(owner, vaultItemId, options)`
    -> `VaultRepository.findById(...)` + deleted-item/ownership checks
    -> `ShareSecurity.generateRawTokenAndAccessCode()`
    -> hash token/code with server-side key material
    -> `ShareRepository.create(...)`
    -> safe audit event
    -> return raw token/access code exactly once

Recipient public request
    -> Hono app `/api/share/*`
    -> share-specific fail-closed rate limiter
    -> `ShareService.resolveShare(rawToken, accessCode)`
    -> hash lookup + constant-time-style compare
    -> expiration/revocation/deleted-item checks
    -> vault secret decrypt + current TOTP generation only
    -> safe audit event
    -> no-store/no-referrer public `SharedItemView`
```

### Recommended Project Structure

```text
src/
├── app/
│   ├── config.ts                     # EnvBindings, AppError, share config env additions
│   └── index.ts                      # Mount future share routes after health gate review
├── features/share/
│   ├── shareRoutes.ts                # Later phase owner/recipient API routes
│   ├── shareService.ts               # Phase 1 service primitives and security checks
│   ├── shareSecurity.ts              # Token/code generation, hashing, comparison helpers
│   └── shareTypes.ts                 # Security contract DTO/domain types
├── shared/db/
│   ├── migrator.ts                   # Add versioned share tables/indexes for all engines
│   ├── repositories/shareRepository.ts
│   └── schema/{sqlite,mysql,pg,index}.ts
└── shared/middleware/
    └── shareRateLimitMiddleware.ts   # Fail-closed public limiter or explicit option
```

### Pattern 1: Feature Routes Mount Through `src/app/index.ts`

**What:** The app imports feature route modules and mounts them with `app.route('/api/<feature>', routes)`. [VERIFIED: source map `src/app/index.ts`]

**When to use:** Use for Phase 2 routes only after Phase 1 primitives exist. [VERIFIED: roadmap dependency]

**Example:**

```typescript
// Source: backend/dist/worker/worker.js.map, original src/app/index.ts
app.route('/api/vault', vaultRoutes);
app.route('/api/backups', backupRoutes);
```

### Pattern 2: Service Owns Security Logic, Repository Owns Persistence

**What:** Existing routes instantiate repositories from `c.env.DB`, services validate/decrypt/encrypt domain behavior, and repositories hide Drizzle queries. [VERIFIED: source maps `vaultRoutes.ts`, `vaultService.ts`, `vaultRepository.ts`]

**When to use:** Share expiration, revocation, deleted-item checks, hash lookup, and audit recording belong in `ShareService`/`ShareRepository`, not route handlers. [VERIFIED: `.planning/REQUIREMENTS.md`]

**Example:**

```typescript
// Source: backend/dist/worker/worker.js.map, original src/features/vault/vaultRoutes.ts pattern
const getService = (c: Context) => {
    const repository = new VaultRepository(c.env.DB);
    return new VaultService(c.env, repository);
};
```

### Pattern 3: Cross-Engine Schema Must Stay Aligned

**What:** The backend has parallel SQLite, MySQL, and PostgreSQL Drizzle schema files selected by `DB_ENGINE`, while Cloudflare D1 defaults to SQLite schema. [VERIFIED: `src/shared/db/schema/index.ts` source map]

**When to use:** Every share table/column must be added to `sqlite.ts`, `mysql.ts`, `pg.ts`, `index.ts`, `backend/schema.sql`, and `migrator.ts`. [VERIFIED: existing schema/migrator pattern]

**Example:**

```typescript
// Source: backend/dist/worker/worker.js.map, original src/shared/db/schema/index.ts
if (engine === 'mysql') {
    vault = mysqlSchema.vault as any;
} else if (engine === 'postgres' || engine === 'postgresql') {
    vault = pgSchema.vault as any;
} else {
    vault = sqliteSchema.vault;
}
```

### Anti-Patterns to Avoid

- **Editing generated bundles as primary work:** Security-sensitive share code needs TypeScript source, tests, and regenerated outputs. [VERIFIED: `.planning/REQUIREMENTS.md`]
- **Public route does all checks inline:** This makes Phase 2 routes hard to test and can miss deleted/revoked/expired states; put decisions in service/repository logic. [VERIFIED: existing architecture]
- **Reuse current `rateLimit()` unchanged for public share access:** It logs DB errors and continues to `next()`, which violates fail-closed STATE-05. [VERIFIED: `rateLimitMiddleware.ts` lines 101-108]
- **Store raw token, raw access code, or full URL:** Requirement STATE-02 forbids recoverable plaintext after creation. [VERIFIED: `.planning/REQUIREMENTS.md`]
- **Expose raw TOTP seed by default:** v1 recipient access should expose current TOTP code/countdown when applicable, not the long-lived seed. [VERIFIED: `.planning/REQUIREMENTS.md`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP routing/middleware | Custom router or separate server | Existing Hono app | Already supports all deploy targets and centralized errors. [VERIFIED: source maps] |
| SQL query construction | String-concatenated SQL in routes | Drizzle repository + existing executor/migrator pattern | Cross-engine behavior is already abstracted. [VERIFIED: source maps] |
| Cryptographic random bytes | `Math.random()` or predictable IDs | Web Crypto `crypto.getRandomValues()` | Web Crypto is available in Workers and suitable for random byte generation. [CITED: Cloudflare Workers Web Crypto docs] |
| Secret hashing policy from scratch | Unsalted plain SHA token/code storage | Keyed hash or KDF using server secret/pepper, with raw values shown once | OWASP recommends storing passwords with modern hashing/KDF practices and supports peppers as additional secret material. [CITED: OWASP Password Storage Cheat Sheet] |
| TOTP generation | New OTP implementation | Existing `generateTOTP`/OTP utilities | Source maps show existing TOTP/HOTP/Steam/Blizzard utilities. [VERIFIED: source maps] |
| Log redaction policy | Ad hoc per-route console filtering | Central `logger` plus audit allowlists | OWASP logging guidance says secrets/passwords/tokens should be excluded or masked. [CITED: OWASP Logging Cheat Sheet; VERIFIED: `logger.ts` usage] |

**Key insight:** The hard problem is not creating a table or endpoint; it is preserving NodeAuth's security boundary across generated deployment targets while ensuring public link access cannot bypass expiration, revocation, code checks, deleted-item status, or rate limiting.

## Common Pitfalls

### Pitfall 1: Planning Feature Work Before Source Provenance

**What goes wrong:** The plan edits or tests generated bundles directly, producing unreviewable changes across Worker/Docker/Netlify outputs. [VERIFIED: `.planning/codebase/CONCERNS.md`]
**Why it happens:** Source maps include original source text, but actual source files and build scripts are absent. [VERIFIED: `rg --files`, source maps]
**How to avoid:** Make Wave 0 restore `src/**`, `backend/scripts/**`, `tsconfig.json`, lockfile, and tests or document an external upstream source checkout. [VERIFIED: `backend/package.json`, `find`]
**Warning signs:** Tasks mention editing `backend/dist/worker/worker.js` or `frontend/dist/assets/*.js` as normal implementation files.

### Pitfall 2: Fail-Open Rate Limiting on Public Secrets

**What goes wrong:** DB outage or missing rate-limit table lets public share-code guesses proceed. [VERIFIED: existing limiter catches DB errors and calls `next()`]
**Why it happens:** Existing limiter was built to avoid breaking normal app flows on limiter storage failure. [VERIFIED: `rateLimitMiddleware.ts` comments/behavior]
**How to avoid:** Add `failClosed: true` behavior or a separate share limiter that returns generic inaccessible/locked response when storage cannot be updated. [VERIFIED: STATE-05]
**Warning signs:** Share route uses `rateLimit({ ... })` with no explicit fail-closed behavior.

### Pitfall 3: Incomplete Cross-Engine Schema

**What goes wrong:** Share links work on D1/SQLite but fail on Docker MySQL/PostgreSQL or Netlify. [VERIFIED: project supports multiple engines]
**Why it happens:** Existing schema is duplicated across `backend/schema.sql`, Drizzle schema files, and runtime migrations. [VERIFIED: source maps and `backend/schema.sql`]
**How to avoid:** Add every share field/index/migration across SQLite, MySQL, PostgreSQL, and D1-compatible SQL. [VERIFIED: existing migrator pattern]
**Warning signs:** Only `backend/schema.sql` changes, or only `sqlite.ts` changes.

### Pitfall 4: Token or Access Code Leaks Through Logs/URLs

**What goes wrong:** Full share URLs or access codes appear in request logs, audits, browser history, referrers, or copied owner metadata. [VERIFIED: requirements forbid leakage]
**Why it happens:** Hono request logging is global and public links naturally put tokens in paths if not handled carefully. [VERIFIED: `src/app/index.ts` source map]
**How to avoid:** Put token in URL path only, access code in request body, never include raw values in audit records, and redact/avoid full URL logging for share paths. [CITED: OWASP Logging Cheat Sheet; VERIFIED: REC-02/REC-06]
**Warning signs:** Audit rows contain `url`, `token`, `accessCode`, or `Authorization`-like values.

### Pitfall 5: TOTP Current Code Becomes Seed Disclosure

**What goes wrong:** Recipient receives the raw OTP seed and can generate future codes indefinitely. [VERIFIED: requirement says raw seed unsupported by default]
**Why it happens:** Existing vault service can decrypt stored secrets for authenticated vault views/exports. [VERIFIED: `VaultService.getAllAccounts`, export paths]
**How to avoid:** Share service should decrypt only to compute current TOTP code/countdown and omit seed from `SharedItemView`. [VERIFIED: `generateTOTP` utility exists; requirements REC-04]
**Warning signs:** DTO has `secret`, `otpAuthUri`, or raw encrypted secret fields.

## Code Examples

### Fail-Closed Share Limiter Shape

```typescript
// Source basis: existing rateLimitMiddleware.ts verified from source map.
// New share-specific behavior should fail closed instead of swallowing DB errors.
export const shareRateLimit = (options: { windowMs: number; max: number }) => {
    return async (c: Context<{ Bindings: EnvBindings }>, next: Next) => {
        try {
            await enforceShareRateLimit(c.env.DB, buildShareRateKey(c), options);
        } catch (error) {
            logger.warn('[ShareRateLimit] access blocked');
            throw new AppError('share_inaccessible', 404);
        }

        await next();
    };
};
```

### Share Security Helper Shape

```typescript
// Source basis: Web Crypto runtime; use server-side secret material from EnvBindings.
const toBase64Url = (bytes: Uint8Array): string =>
    btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

export const generateShareToken = (): string => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return toBase64Url(bytes);
};

export const hashShareSecret = async (pepper: string, value: string): Promise<string> => {
    const input = new TextEncoder().encode(`${pepper}:${value}`);
    const digest = await crypto.subtle.digest('SHA-256', input);
    return toBase64Url(new Uint8Array(digest));
};
```

Use a keyed HMAC if available in the restored runtime utility layer; the example above is a planning sketch, not a locked implementation. [ASSUMED]

### Cross-Engine Schema Additions

```typescript
// Source basis: src/shared/db/schema/sqlite.ts pattern.
export const shareLinks = sqliteTable('share_links', {
    id: text('id').primaryKey(),
    vaultItemId: text('vault_item_id').notNull(),
    ownerId: text('owner_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    accessCodeHash: text('access_code_hash').notNull(),
    expiresAt: integer('expires_at').notNull(),
    revokedAt: integer('revoked_at'),
    createdAt: integer('created_at').notNull(),
    lastAccessedAt: integer('last_accessed_at'),
    accessCount: integer('access_count').default(0),
});
```

Final column names should be mirrored in MySQL/PostgreSQL schema files and migrations. [VERIFIED: source-map schema pattern]

## State of the Art

| Old Approach | Current Approach | When Checked | Impact |
|--------------|------------------|--------------|--------|
| Store bearer tokens directly | Store only hashed/derived token values; return raw token once | 2026-05-02 [CITED: OWASP Password Storage Cheat Sheet] | DB compromise should not reveal usable share URLs. |
| URL-only public secret access | Token URL plus independent access code in request body | 2026-05-02 [VERIFIED: requirements] | Leaked chat/browser URL alone is insufficient. |
| Route-local access decisions | Service/repository primitives enforce inaccessible states | 2026-05-02 [VERIFIED: architecture] | Easier to test before public endpoints exist. |
| Fail-open limiter for sensitive public endpoint | Fail-closed share-specific limiter | 2026-05-02 [VERIFIED: STATE-05 and existing limiter] | Storage errors deny access instead of allowing guesses. |

**Deprecated/outdated for this phase:**
- Treating `backend/dist/**` as normal source: explicitly out of scope as primary implementation. [VERIFIED: `.planning/REQUIREMENTS.md`]
- Assuming UI work is available: only `frontend/dist/**` exists in this checkout. [VERIFIED: `rg --files`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Final owner scoping can use an `owner_id`/email-style field tied to existing `created_by`/session user identity. | Phase Requirements, Code Examples | If NodeAuth is intentionally a global shared vault, planner must adjust owner enforcement and metadata. |
| A2 | A keyed HMAC should be preferred over simple peppered SHA-256 if restored runtime utilities make it ergonomic across Workers/Node. | Code Examples | Weak token-hash design could reduce protection if DB leaks. |
| A3 | Default max expiration should be short and bounded, but the exact max duration is not locked by current requirements. | Security Domain / Open Questions | Planner needs user/product decision before hardcoding policy. |

## Open Questions

1. **Where is the authoritative editable source?**
   - What we know: Current checkout lacks `src/**`, `backend/scripts/**`, `tsconfig.json`, frontend source, and tests. [VERIFIED: `rg --files`]
   - What's unclear: Whether source should be restored from upstream NodeAuth, reconstructed from source maps, or provided by another checkout.
   - Recommendation: Planner should make source restoration/provenance the first plan and block share feature implementation until resolved.

2. **What is the canonical public origin variable?**
   - What we know: Existing env bindings include many OAuth redirect URIs but no obvious `PUBLIC_ORIGIN`, `APP_URL`, or share base URL setting. [VERIFIED: `rg` env/origin search]
   - What's unclear: Whether share URLs should derive from incoming request origin, a new required env var, or deployment-specific config.
   - Recommendation: Add an explicit `NODEAUTH_PUBLIC_ORIGIN` or similarly named env field to the security contract unless the user chooses request-origin derivation.

3. **What expiration policy is acceptable for v1?**
   - What we know: Expiration is required and must be bounded. [VERIFIED: requirements]
   - What's unclear: Default/max duration.
   - Recommendation: Planner should require a configurable default and maximum with conservative defaults; exact numbers need confirmation. [ASSUMED]

4. **Can source-level tests be restored before share primitives?**
   - What we know: `vitest run` is declared but no tests/config/dependencies are present. [VERIFIED: `backend/package.json`, `.planning/codebase/TESTING.md`]
   - What's unclear: Whether test harness exists upstream.
   - Recommendation: Include a test-harness restoration task in Wave 0.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | npm scripts, backend tests/build | Yes | `v22.22.2` local; deployment targets Node 24 [VERIFIED: environment, Dockerfile/workflows] | Use project-target Node 24 in CI/Docker; local Node may differ. |
| npm | dependency install/test | Yes | `10.9.7` [VERIFIED: environment] | None needed. |
| Docker | Docker build/runtime validation | Yes | `29.2.1` [VERIFIED: environment] | If unavailable in CI, document Docker-only manual validation. |
| Wrangler CLI | Worker deploy/build validation | Yes, globally | `4.85.0`; manifests pin `4.75.0`; registry latest `4.87.0` [VERIFIED: environment, npm registry] | Use `npx wrangler` from project lockfile once dependencies are installed. |
| backend dependencies | Vitest/build scripts | No | `backend/node_modules` missing [VERIFIED: environment] | Run `npm install --prefix backend`; reproducibility requires `backend/package-lock.json`. |
| editable backend source | Feature implementation | No | `src/**` missing [VERIFIED: `rg --files`] | Restore source from upstream/provenance; source maps are reference material only. |
| backend build scripts | Worker/Docker/Netlify bundle generation | No | `backend/scripts/build-*.js` missing [VERIFIED: `backend/package.json`, `find`] | Restore build scripts before FND-02 can pass. |
| frontend source | UX-04 UI implementation | No | only `frontend/dist/**` exists [VERIFIED: `rg --files`] | v1 remains API-only unless source is restored. |

**Missing dependencies with no fallback:**
- Editable backend source and build scripts block safe implementation of share primitives. [VERIFIED: checkout]

**Missing dependencies with fallback:**
- Frontend source is missing; fallback is API-only v1 plus documented UI contracts. [VERIFIED: UX-04]
- Backend dependencies are missing; fallback is install, but without a backend lockfile installs are not reproducible. [VERIFIED: `.planning/codebase/CONCERNS.md`]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | Yes | Owner APIs use existing `authMiddleware`; recipient share access is unauthenticated but token/code gated. [VERIFIED: source maps, requirements] |
| V3 Session Management | Yes | Owner APIs must preserve existing session/CSRF behavior; public recipient routes must not create owner sessions. [VERIFIED: requirements] |
| V4 Access Control | Yes | Creation/list/revoke must verify owner can access the vault item and cannot manage other owners' shares. [VERIFIED: OWN-07, STATE-01] |
| V5 Input Validation | Yes | Validate share creation expiration, item id, access-code policy, and public token/code format server-side. [VERIFIED: requirements] |
| V6 Cryptography | Yes | Use Web Crypto / existing crypto utilities; never store raw token/code/seed; do not hand-roll randomness. [CITED: Cloudflare Web Crypto docs; VERIFIED: STATE-02] |
| V7 Error Handling and Logging | Yes | Generic public inaccessible errors and audit/log allowlists. [CITED: OWASP Logging Cheat Sheet; VERIFIED: REC-05/STATE-04] |
| V9 Data Protection | Yes | No-store/no-referrer headers and minimal DTO. [CITED: OWASP REST Security guidance; VERIFIED: REC-03/REC-06] |

### Known Threat Patterns for Share Links

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token enumeration | Spoofing / Information Disclosure | High-entropy random token, hash lookup, generic errors, fail-closed limiter. [CITED: Cloudflare Web Crypto docs; VERIFIED: requirements] |
| Access-code brute force | Spoofing | Independent code, server-side code hash, share-specific fail-closed limiter and lock state. [VERIFIED: STATE-05] |
| DB leak exposes links | Information Disclosure | Store only token/code hashes or derived values; keep server-side pepper secret. [CITED: OWASP Password Storage Cheat Sheet] |
| Full URL leaked in logs/referrers | Information Disclosure | Access code in body, avoid full URL in audit/log, set no-referrer/no-store on public responses. [CITED: OWASP Logging Cheat Sheet; VERIFIED: REC-06] |
| Deleted or revoked vault item remains accessible | Elevation of Privilege | Service-level checks join/verify vault row `deleted_at IS NULL` and share `revoked_at IS NULL` before any DTO. [VERIFIED: vault schema, STATE-03] |
| Raw TOTP seed exposure | Information Disclosure | Compute current OTP server-side with existing utility and return code/countdown only. [VERIFIED: source-map OTP utilities, REC-04] |

## Sources

### Primary (HIGH confidence)

- `AGENTS.md` - project constraints, architecture, stack, conventions. [VERIFIED: local file]
- `.planning/REQUIREMENTS.md` - Phase 1 requirement IDs and security requirements. [VERIFIED: local file]
- `.planning/ROADMAP.md` - Phase goal, success criteria, dependencies. [VERIFIED: local file]
- `.planning/codebase/ARCHITECTURE.md`, `STACK.md`, `CONVENTIONS.md`, `STRUCTURE.md`, `TESTING.md`, `CONCERNS.md` - existing codebase map. [VERIFIED: local files]
- `backend/package.json`, `package.json`, `backend/schema.sql`, source maps under `backend/dist/**/*.map` - package scripts, schema, and original source patterns. [VERIFIED: local files]
- npm registry `npm view` - current versions and modification timestamps for Hono, Drizzle ORM, Vitest, Wrangler, tsup, TypeScript, and related packages. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)

- Hono official docs/search result - middleware and route mounting concepts. [CITED: https://hono.dev]
- Drizzle ORM official docs/search result - schema/query/index patterns. [CITED: https://orm.drizzle.team/docs/sql-schema-declaration]
- Cloudflare Workers Web Crypto docs - runtime cryptographic API availability. [CITED: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/]
- Vitest official docs/search result - mocking and test patterns. [CITED: https://vitest.dev/guide/mocking.html]
- OWASP Password Storage Cheat Sheet - hashing/KDF/pepper guidance. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html]
- OWASP Logging Cheat Sheet - exclude/mask secrets, tokens, passwords in logs. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html]
- OWASP Session Management / REST / API Security guidance - entropy, cache/no-store, rate-limit themes. [CITED: https://cheatsheetseries.owasp.org/]

### Tertiary (LOW confidence)

- None used as authoritative evidence. Web search was used only to locate official docs. [VERIFIED: web search process]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - package manifests, source maps, and npm registry versions were checked. [VERIFIED]
- Architecture: HIGH - local architecture docs and source-map source contents agree on Hono feature routes, services, repositories, and schema modules. [VERIFIED]
- Security patterns: MEDIUM - requirements and OWASP/Cloudflare docs establish direction, but exact expiration duration, owner model, and hash construction need project decisions. [CITED/ASSUMED as tagged]
- Build/test availability: HIGH - current checkout lacks source/build scripts/tests and backend dependencies. [VERIFIED]

**Research date:** 2026-05-02
**Valid until:** 2026-05-09 for package versions and runtime docs; source checkout findings valid until repository contents change.
