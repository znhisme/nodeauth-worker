# Phase 03: Cleanup, Compatibility, and Hardening - Research

**Researched:** 2026-05-03 [VERIFIED: system date]  
**Domain:** Brownfield Hono/Drizzle share-link cleanup, runtime compatibility, and security regression coverage [VERIFIED: `.planning/ROADMAP.md`, `src/features/share/*`]  
**Confidence:** HIGH for source/test/build constraints; MEDIUM for live MySQL/PostgreSQL runtime execution because client CLIs are not installed locally. [VERIFIED: local environment audit]

## User Constraints

No `.planning/phases/03-cleanup-compatibility-and-hardening/*-CONTEXT.md` exists, so there are no phase-specific locked decisions, discretion areas, or deferred ideas to copy verbatim. [VERIFIED: `gsd-sdk query init.phase-op "3"`, `find .planning/phases/03-cleanup-compatibility-and-hardening`]

Applicable milestone constraints: share links must keep high-entropy token handling, expiration, revocation, access-code protection by default, single-item scope, cross-target backend compatibility, no platform-specific storage/crypto assumptions outside existing abstractions, and privacy-preserving responses. [VERIFIED: `AGENTS.md`, `.planning/REQUIREMENTS.md`]

## Summary

Phase 3 should close two implementation gaps before broadening tests: expired shares are currently detected and audited on access but not durably marked, and `share_rate_limits` has no stale-row cleanup path. [VERIFIED: `src/features/share/shareService.ts`, `src/shared/db/repositories/shareRepository.ts`] The standard implementation shape is a small cleanup primitive in `ShareRepository`, an idempotent `ShareService.cleanupShareState(now)` method, and runtime hooks that call the same method from Cloudflare scheduled events, Docker `node-cron`, and Netlify/request-time opportunistic paths. [VERIFIED: `src/app/worker.ts`, `src/app/server.ts`, `src/app/netlify.ts`; CITED: Cloudflare scheduled handler docs, Netlify scheduled functions docs, node-cron docs]

The compatibility risk called out by Phase 2 is real: the source Drizzle MySQL schema uses `varchar` for share indexed identifiers, but migration version 13 still creates MySQL `TEXT` columns and indexes them without prefixes. [VERIFIED: `src/shared/db/schema/mysql.ts`, `src/shared/db/migrator.ts`, `02-VERIFICATION.md`; CITED: MySQL 8.4 Column Indexes docs] Phase 3 should fix migration SQL and extend the schema validator so this cannot recur in generated Worker, Docker, and Netlify bundles. [VERIFIED: `scripts/validate_share_schema_alignment.js`, `backend/scripts/build-*.js`]

**Primary recommendation:** Plan Phase 3 as cleanup primitives first, MySQL/cross-runtime migration compatibility second, and security/regression test expansion plus regenerated bundle assertions last. [VERIFIED: `.planning/ROADMAP.md`, `.planning/phases/02-share-link-api/02-VERIFICATION.md`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Expired-share marking | API / Backend | Database / Storage | Expiration status is computed in `ShareService`, while durable state and audit rows live in `share_links` and `share_audit_events`. [VERIFIED: `src/features/share/shareService.ts`, `src/shared/db/repositories/shareRepository.ts`] |
| Stale share rate-limit cleanup | Database / Storage | API / Backend | `share_rate_limits` stores attempts, windows, and lock timestamps; cleanup should be a repository delete bounded by timestamps. [VERIFIED: `src/shared/db/schema/*.ts`, `src/shared/db/repositories/shareRepository.ts`] |
| Scheduled cleanup dispatch | Runtime entrypoints | API / Backend | Cloudflare has `scheduled()`, Docker already schedules backup with `node-cron`, and Netlify has no current scheduled cleanup function in this checkout. [VERIFIED: `src/app/worker.ts`, `src/app/server.ts`, `src/app/netlify.ts`; CITED: platform docs] |
| Revocation limitation contract | API docs / Project docs | API / Backend | Revocation stops future access in service logic but cannot erase credential material already copied from a prior response. [VERIFIED: `docs/share-link-security-contract.md`, `.planning/REQUIREMENTS.md`] |
| Public share hardening tests | Test suite | API / Backend | Existing Vitest tests cover many share cases; Phase 3 adds the full HARD-02/HARD-03 matrix and generated-output assertions. [VERIFIED: `src/**/*.test.ts`, `02-VALIDATION.md`] |
| Existing feature regression | Test suite | API / Backend | Auth, vault, backup, health, and deployment behavior are existing NodeAuth surfaces and must remain green after share changes. [VERIFIED: `.planning/REQUIREMENTS.md`, `.planning/codebase/CONCERNS.md`] |

## Project Constraints (from AGENTS.md)

- Shared links expose sensitive login material, so tokens, expiration, revocation, and access-code protection remain mandatory. [VERIFIED: `AGENTS.md`]
- Sharing remains limited to one vault/account item per link. [VERIFIED: `AGENTS.md`]
- Backend compatibility must cover Cloudflare Workers, Docker, and Netlify. [VERIFIED: `AGENTS.md`, `wrangler.toml`, `Dockerfile`, `netlify.toml`]
- Implementation must use Hono route modules, feature services, repositories, and centralized error handling. [VERIFIED: `AGENTS.md`, `.planning/codebase/ARCHITECTURE.md`, `src/app/index.ts`]
- Do not hand-edit `backend/dist/**` as the primary implementation path; edit `src/**` and regenerate bundles. [VERIFIED: `AGENTS.md`, `.planning/STATE.md`, `backend/scripts/build-*.js`]
- Editable frontend source is still absent; keep Phase 3 API/docs/backend-test focused unless source appears. [VERIFIED: `.planning/source-provenance.md`, `rg --files frontend src`]
- Public share responses must not leak unrelated vault lists, owner identity, session cookies, backup data, raw internal IDs, raw tokens, or access-code hashes. [VERIFIED: `AGENTS.md`, `docs/share-link-security-contract.md`]
- No `CLAUDE.md` exists in this workspace. [VERIFIED: `test -f CLAUDE.md`]
- No project skills exist under `.claude/skills/` or `.agents/skills/`. [VERIFIED: `find .claude/skills .agents/skills -name SKILL.md`]

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | System can clean up or mark expired shares and stale share rate-limit state through scheduled or opportunistic backend work. | Add repository/service cleanup methods and call them from Cloudflare/Docker scheduled paths plus Netlify opportunistic request/startup path. [VERIFIED: `src/app/worker.ts`, `src/app/server.ts`, `src/app/netlify.ts`; CITED: Cloudflare/Netlify/node-cron docs] |
| UX-03 | API contract and project notes explain revocation limits. | Extend `docs/share-link-security-contract.md` and owner-facing route/API notes with "revocation stops future access only". [VERIFIED: `docs/share-link-security-contract.md`, `.planning/REQUIREMENTS.md`] |
| HARD-01 | Share schema, repository, and route behavior are tested against available database/runtime paths. | Fix MySQL migration SQL, extend schema alignment checks, run SQLite/source tests locally, and add Docker/MySQL/PostgreSQL commands as conditional gates. [VERIFIED: `src/shared/db/migrator.ts`, `docker-compose-*.yml`, local environment audit] |
| HARD-02 | Tests cover expired, revoked, wrong-code, locked, deleted-item, wrong-owner, and token-enumeration scenarios. | Existing tests partially cover these; Phase 3 should split and name each scenario explicitly, including token enumeration and wrong-owner route/repository coverage. [VERIFIED: `src/features/share/shareService.test.ts`, `src/features/share/shareRoutes.test.ts`] |
| HARD-03 | Tests verify public allowlists, secure headers, generic errors, and log redaction. | Existing tests cover headers/redaction partially; Phase 3 should add response-key allowlist tests and log payload redaction checks for route and middleware paths. [VERIFIED: `src/app/index.test.ts`, `src/shared/middleware/shareRateLimitMiddleware.test.ts`] |
| HARD-04 | Existing auth, vault, backup, health, and deployment behavior does not regress. | Add smoke/source-contract tests around route mounting, health gate, auth middleware preservation, backup cron preservation, and generated bundle markers. [VERIFIED: `.planning/REQUIREMENTS.md`, `src/app/index.ts`, `src/features/backup/backupRoutes.ts`] |

</phase_requirements>

## Standard Stack

### Core

| Library | Project Version | Verified Current Version | Purpose | Why Standard |
|---------|-----------------|--------------------------|---------|--------------|
| Hono | `^4.12.12` | `4.12.16`, modified 2026-04-30 [VERIFIED: npm registry] | Route and middleware tests through `app.request()` | Existing API uses Hono; Hono docs support testing by sending requests to the app and passing `c.env` as the third argument. [VERIFIED: `src/app/index.ts`; CITED: https://hono.dev/docs/guides/testing] |
| Drizzle ORM | `^0.45.2` | `0.45.2`, modified 2026-05-01 [VERIFIED: npm registry] | Repository selects, updates, and deletes | Existing repositories use Drizzle; Drizzle docs support `delete(...).where(...)`, which fits stale limiter cleanup. [VERIFIED: `src/shared/db/repositories/shareRepository.ts`; CITED: https://orm.drizzle.team/docs/delete] |
| Vitest | `^4.1.0` | `4.1.5`, modified 2026-04-23 [VERIFIED: npm registry] | Unit, route, middleware, and source-contract tests | Backend test command is `vitest run`; current full suite passes 5 files / 48 tests. [VERIFIED: `backend/package.json`, `backend/vitest.config.ts`, local test run] |
| Web Crypto API | runtime-provided | runtime API [CITED: Cloudflare Web Crypto docs from prior research] | Existing share HMAC and random tokens | Share token/code primitives already use Web Crypto and must not be replaced during hardening. [VERIFIED: `src/features/share/shareSecurity.ts`] |

### Supporting

| Library/Tool | Project Version | Verified Current Version | Purpose | When to Use |
|--------------|-----------------|--------------------------|---------|-------------|
| Wrangler | `4.75.0` in manifests | `4.87.0` registry; local CLI `4.85.0` [VERIFIED: npm registry, local environment audit] | Worker build/dev/scheduled testing | Use project scripts for builds; note local CLI drift when testing `--test-scheduled`. [VERIFIED: `package.json`, `backend/package.json`] |
| `node-cron` | `^4.2.1` | project dependency [VERIFIED: `backend/package.json`] | Docker scheduled cleanup | Existing Docker server already schedules daily backup with `cron.schedule('0 2 * * *', ...)`. [VERIFIED: `src/app/server.ts`; CITED: https://nodecron.com/api-reference] |
| `better-sqlite3` | `^12.8.0` | `12.9.0`, modified 2026-04-12 [VERIFIED: npm registry] | Docker SQLite runtime | Available through backend dependency for local SQLite repository/runtime checks. [VERIFIED: `backend/package.json`, `src/shared/db/factory.ts`] |
| `mysql2` | `^3.20.0` | `3.22.3`, modified 2026-04-27 [VERIFIED: npm registry] | Docker MySQL runtime | Required for MySQL compatibility validation; MySQL CLI is missing locally, so Docker Compose is the likely path. [VERIFIED: `backend/package.json`, environment audit] |
| `pg` | `^8.20.0` | `8.20.0`, modified 2026-03-04 [VERIFIED: npm registry] | Docker PostgreSQL runtime | Required for PostgreSQL compatibility validation; `psql` CLI is missing locally, so Docker Compose is the likely path. [VERIFIED: `backend/package.json`, environment audit] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Repository/service cleanup method | Route-local cleanup in public access handler | Avoid because cleanup belongs below routes and must be reused by scheduled/opportunistic hooks. [VERIFIED: existing service/repository architecture] |
| Opportunistic-only cleanup | Platform-specific cron only | Avoid because Netlify has no current scheduled function file and Cloudflare/Docker scheduling differs by runtime. [VERIFIED: `src/app/*`; CITED: platform docs] |
| Deleting expired shares | Marking with a new status column | Do not add a status column unless necessary; current status is derived from `revoked_at` and `expires_at`, and marking can be represented by audit rows or optional nullable marker if the planner chooses. [VERIFIED: `src/features/share/shareTypes.ts`, `src/features/share/shareService.ts`] |
| Live database smoke only | Source/generator assertions only | Use both where available; source/generator checks catch bundle drift, while live DB checks catch dialect SQL errors. [VERIFIED: `02-VERIFICATION.md`, local environment audit] |

**Installation:**

```bash
npm ci --prefix backend
```

**Version verification:** `npm view hono drizzle-orm vitest wrangler @hono/node-server better-sqlite3 mysql2 pg version time.modified` was run during research. [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```text
Scheduled trigger or opportunistic request
    -> runtime entrypoint (Worker scheduled / Docker cron / Netlify request startup)
    -> create ShareService from env.DB
    -> ShareService.cleanupShareState(now)
    -> ShareRepository.markExpiredShares(now) or audit expired shares
    -> ShareRepository.deleteStaleRateLimits(cutoff)
    -> logger safe summary with counts only

Owner/public share API request
    -> existing Hono app and health gate
    -> existing share routes and fail-closed limiter
    -> cleanup may run in waitUntil/opportunistic guard without changing response semantics
    -> public responses keep generic errors and no-store/no-referrer headers

Source change
    -> Vitest focused/full tests
    -> schema alignment validator
    -> build Worker/Docker/Netlify bundles
    -> source-map verifier and generated marker assertions
```

### Recommended Project Structure

```text
src/
├── app/
│   ├── worker.ts                     # Add share cleanup to scheduled(), preserve backup
│   ├── server.ts                     # Add Docker cron cleanup beside backup cron
│   └── netlify.ts                    # Add opportunistic cleanup guard or scheduled-function note
├── features/share/
│   ├── shareService.ts               # cleanupShareState(), docs-safe revoke semantics
│   ├── shareService.test.ts          # cleanup + hardening matrix
│   ├── shareRoutes.test.ts           # public/owner route contract matrix
│   └── shareTypes.ts                 # cleanup result type if needed
├── shared/db/repositories/
│   ├── shareRepository.ts            # mark/list/delete cleanup primitives
│   └── shareRepository.test.ts       # repository contract with fake or SQLite DB
└── shared/db/
    └── migrator.ts                   # MySQL TEXT index compatibility fix
```

### Pattern 1: Idempotent Cleanup Below Routes

**What:** Add cleanup as repository/service methods that can run repeatedly and return counts, not secret-bearing rows. [VERIFIED: existing repository/service pattern]

**When to use:** Use for UX-01 scheduled cleanup, opportunistic cleanup, and tests. [VERIFIED: `.planning/REQUIREMENTS.md`]

**Example:**

```typescript
// Source basis: Drizzle delete docs + current ShareRepository style.
async deleteStaleRateLimits(cutoff: number): Promise<void> {
    await this.db
        .delete(shareRateLimits)
        .where(lt(shareRateLimits.lastAttemptAt, cutoff));
}
```

### Pattern 2: Runtime Hooks Call One Shared Function

**What:** Runtime entrypoints should call the same cleanup service method rather than duplicating SQL per platform. [VERIFIED: `src/app/worker.ts`, `src/app/server.ts`, `src/app/netlify.ts`]

**When to use:** Worker `scheduled()`, Docker `cron.schedule()`, and Netlify opportunistic startup/request guard. [CITED: Cloudflare scheduled handler docs, Netlify scheduled functions docs, node-cron docs]

**Example:**

```typescript
// Source basis: src/app/worker.ts existing scheduled backup pattern.
ctx.waitUntil(Promise.all([
    handleScheduledBackup(specializedEnv),
    cleanupShareState(specializedEnv),
]));
```

### Pattern 3: Public Response Allowlist Tests

**What:** Assert exact top-level response keys and nested `SharedItemView` keys instead of only checking forbidden substrings. [VERIFIED: existing tests currently use serialized forbidden-value checks]

**When to use:** HARD-03 public success, inaccessible, locked, missing-token, wrong-code, expired, revoked, and deleted-item route tests. [VERIFIED: `.planning/REQUIREMENTS.md`]

**Example:**

```typescript
expect(Object.keys(body).sort()).toEqual(['data', 'success']);
expect(Object.keys(body.data).sort()).toEqual(['account', 'otp', 'service']);
```

### Anti-Patterns to Avoid

- **Cleanup in route handlers only:** It will miss scheduled/runtime contexts and make Netlify/Docker/Worker behavior diverge. [VERIFIED: `src/app/*`, architecture docs]
- **Publicly distinguishing expired/revoked/wrong-code/locked:** REC-05 requires generic public errors, and Phase 3 hardening must preserve that. [VERIFIED: `.planning/REQUIREMENTS.md`, `shareRoutes.ts`]
- **Logging cleanup row details:** Cleanup logs should contain counts and operation names only, not share IDs, token hashes, owner IDs, access codes, or vault labels. [VERIFIED: `docs/share-link-security-contract.md`]
- **Fixing only Drizzle schema but not runtime migration SQL:** Phase 2 debt is in `src/shared/db/migrator.ts` and generated Docker bundle, not only schema definitions. [VERIFIED: `02-VERIFICATION.md`, `src/shared/db/migrator.ts`]
- **Treating generated bundle grep as sufficient:** It confirms presence, not runtime behavior; use source tests plus live/conditional DB smoke where available. [VERIFIED: `02-VALIDATION.md`, environment audit]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scheduled dispatch | New custom scheduler abstraction | Worker `scheduled()`, existing Docker `node-cron`, Netlify opportunistic/scheduled function support | Each runtime already has a standard scheduling path. [VERIFIED: `src/app/*`; CITED: platform docs] |
| Repository cleanup SQL string concatenation | Raw dynamic SQL in services/routes | Drizzle delete/update in `ShareRepository` | Existing persistence layer is Drizzle repositories. [VERIFIED: `shareRepository.ts`; CITED: Drizzle delete docs] |
| Public response redaction by deleting keys after spreading | Spread vault/share rows then remove fields | Explicit DTO allowlists | Existing contract forbids internal IDs/secrets and tests already use allowlist-style DTOs. [VERIFIED: `shareTypes.ts`, `docs/share-link-security-contract.md`] |
| Token/code hardening changes | New token format or hashing scheme | Existing `shareSecurity.ts` primitives | Phase 1/2 already verified Web Crypto token/code/HMAC behavior. [VERIFIED: `01-SECURITY.md`, `02-SECURITY.md`] |
| Cross-engine schema detection by eyeballing | Manual review only | Extend `scripts/validate_share_schema_alignment.js` | Existing validator already gates share schema/generated markers. [VERIFIED: `scripts/validate_share_schema_alignment.js`] |

**Key insight:** Phase 3 should harden and prove the already-built share feature; it should not redesign token, code, DTO, or route contracts. [VERIFIED: Phase 1/2 verification artifacts]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `share_links` can contain expired rows; `share_rate_limits` can contain stale limiter windows/locks. [VERIFIED: `src/shared/db/schema/*.ts`, `shareRepository.ts`] | Add cleanup/marking repository methods and tests. [VERIFIED: UX-01] |
| Live service config | Cloudflare cron exists in `wrangler.toml`; Docker cron exists in `src/app/server.ts`; Netlify has no checked-in scheduled cleanup function. [VERIFIED: `wrangler.toml`, `src/app/server.ts`, `src/app/netlify.ts`] | Wire cleanup into existing scheduled paths and use opportunistic Netlify fallback unless adding Netlify scheduled function files. [CITED: Netlify docs] |
| OS-registered state | None found in repo-managed process managers or OS scheduler files. [VERIFIED: `rg --files`, `docker-compose*.yml`, `.github/workflows/*`] | No OS re-registration task; Docker image rebuild is enough for `node-cron` changes. [VERIFIED: Dockerfile/runtime source] |
| Secrets/env vars | Cleanup requires existing `DB`; share hashing uses existing `SHARE_SECRET_PEPPER`/`JWT_SECRET`; no new secret is required by research. [VERIFIED: `shareSecurity.ts`, `app/*`] | Do not add new secrets for cleanup. [VERIFIED: existing design] |
| Build artifacts | Worker, Docker, and Netlify generated bundles embed runtime migration and app code. [VERIFIED: `backend/dist/*`] | Rebuild all three bundles after source/migration changes and run source-map verifier. [VERIFIED: `backend/scripts/build-*.js`, `scripts/restore_backend_source_from_sourcemaps.js`] |

## Common Pitfalls

### Pitfall 1: MySQL Migration Still Uses Indexed TEXT

**What goes wrong:** Fresh MySQL runtime migration can fail when creating indexes on `TEXT` columns without prefix lengths. [VERIFIED: `src/shared/db/migrator.ts`; CITED: MySQL 8.4 docs]  
**Why it happens:** Drizzle MySQL schema is already `varchar`, but migration version 13 manually creates `TEXT` columns. [VERIFIED: `src/shared/db/schema/mysql.ts`, `src/shared/db/migrator.ts`]  
**How to avoid:** Change MySQL migration SQL to bounded `VARCHAR(...)` for indexed identifiers and extend validator checks for `TEXT PRIMARY KEY` / `TEXT NOT NULL` in MySQL share migration blocks. [VERIFIED: `scripts/validate_share_schema_alignment.js`]  
**Warning signs:** `src/shared/db/migrator.ts` MySQL share block contains `id TEXT PRIMARY KEY`, `owner_id TEXT`, `token_hash TEXT`, or `CREATE INDEX ... ON share_links(token_hash)`. [VERIFIED: local grep]

### Pitfall 2: Expiration Is Audited Repeatedly But Never Marked

**What goes wrong:** Every access to the same expired share can insert another `expired` audit event and leave owner metadata dependent only on computed status. [VERIFIED: `resolveShareAccess()`]  
**Why it happens:** There is no `expired_at` or idempotent expiration marker; current schema derives expired status from `expires_at`. [VERIFIED: `share_links` schema, `shareTypes.ts`]  
**How to avoid:** Use idempotent cleanup semantics, either by inserting one safe audit event per share through a repository guard or by adding a nullable marker only if the planner accepts the schema change. [ASSUMED]  
**Warning signs:** Tests only assert one expired access path and do not assert repeated cleanup/access behavior. [VERIFIED: `shareService.test.ts`]

### Pitfall 3: Netlify Cleanup Is Forgotten

**What goes wrong:** Worker and Docker clean stale state, while Netlify deployments only clean during user traffic or never clean. [VERIFIED: `src/app/netlify.ts`]  
**Why it happens:** Current Netlify adapter initializes DB/migrations but has no scheduler hook. [VERIFIED: `src/app/netlify.ts`]  
**How to avoid:** Either add a Netlify scheduled function in `backend/dist/netlify` build output or add a low-frequency opportunistic cleanup guard in the Netlify handler. [CITED: Netlify scheduled functions docs; ASSUMED: preferred fallback]  
**Warning signs:** Plan tasks mention only `worker.ts` and `server.ts`. [VERIFIED: runtime entrypoint inventory]

### Pitfall 4: Hardening Tests Assert Forbidden Substrings Only

**What goes wrong:** A response can add a new sensitive key whose value is not in the forbidden string list. [VERIFIED: existing test pattern]  
**Why it happens:** Current tests frequently serialize responses and check absent substrings. [VERIFIED: `shareService.test.ts`, `shareRoutes.test.ts`]  
**How to avoid:** Add exact key allowlist tests for public success/failure and owner metadata responses. [VERIFIED: HARD-03]  
**Warning signs:** Tests use only `not.toContain(...)` for public DTO safety. [VERIFIED: existing tests]

### Pitfall 5: Regression Scope Is Too Narrow

**What goes wrong:** Share cleanup modifies app entrypoints and accidentally breaks backup cron, health gates, CORS, auth mounting, or generated deployment bundles. [VERIFIED: `src/app/worker.ts`, `src/app/server.ts`, `src/app/index.ts`]  
**Why it happens:** Cleanup touches cross-cutting runtime files, not just share modules. [VERIFIED: Phase 3 scope]  
**How to avoid:** Include source-contract tests for app route order, health gate preservation, backup scheduled path preservation, generated bundle markers, and full backend tests. [VERIFIED: `02-VALIDATION.md`]  
**Warning signs:** Plan verification only runs `shareService.test.ts`. [VERIFIED: current test commands]

## Code Examples

### Repository Cleanup Primitive

```typescript
// Source: Drizzle delete docs + current ShareRepository constructor pattern.
async deleteStaleRateLimits(cutoff: number): Promise<void> {
    await this.db
        .delete(shareRateLimits)
        .where(lt(shareRateLimits.lastAttemptAt, cutoff));
}
```

### Worker Scheduled Hook

```typescript
// Source: Cloudflare scheduled handler docs + current src/app/worker.ts backup hook.
async scheduled(event: any, env: any, ctx: any) {
    const db = drizzle(env.DB, { schema });
    const specializedEnv = { ...env, DB: db };
    ctx.waitUntil(Promise.all([
        handleScheduledBackup(specializedEnv),
        cleanupShareState(specializedEnv),
    ]));
}
```

### Public Response Key Allowlist

```typescript
// Source: current shareRoutes.test.ts Hono app.request pattern.
expect(body).toEqual({
    success: true,
    data: {
        service: 'GitHub',
        account: 'friend@example.com',
        otp: {
            code: expect.any(String),
            period: 30,
            remainingSeconds: expect.any(Number),
        },
    },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-patching generated bundles | Restore `src/**`, edit source, rebuild three backend targets | Phase 1, 2026-05-02 [VERIFIED: `01-VERIFICATION.md`] | Phase 3 must include source-map and generated-output gates. [VERIFIED: `scripts/restore_backend_source_from_sourcemaps.js`] |
| Fail-open general rate limiter | Share-specific fail-closed limiter | Phase 1/2, 2026-05-02/03 [VERIFIED: `01-SECURITY.md`, `02-SECURITY.md`] | Locked/rate-limited tests must expect generic public 404 and headers. [VERIFIED: `shareRateLimitMiddleware.ts`] |
| Reflected credentialed CORS | Exact `NODEAUTH_PUBLIC_ORIGIN` CORS allowlist | Phase 2, 2026-05-03 [VERIFIED: `02-VERIFICATION.md`, `src/app/index.ts`] | Regression tests must keep arbitrary origins denied. [VERIFIED: `src/app/index.test.ts`] |
| Access-code check after secret work | Access-code check before decrypt/OTP generation | Phase 2, 2026-05-03 [VERIFIED: `02-SECURITY.md`] | Wrong-code hardening must keep decrypt/generate spies untouched. [VERIFIED: `shareService.test.ts`] |

**Deprecated/outdated:**
- MySQL share migration using indexed `TEXT` columns is outdated relative to the source Drizzle MySQL schema and MySQL index requirements. [VERIFIED: `src/shared/db/schema/mysql.ts`, `src/shared/db/migrator.ts`; CITED: MySQL docs]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Idempotent expired-share marking can be implemented without adding a new `expired_at` column. | Common Pitfalls | Planner may need a schema migration if duplicate expired audit rows must be prevented at DB level. |
| A2 | Netlify opportunistic cleanup is acceptable if a dedicated scheduled function is not added in Phase 3. | Common Pitfalls | Netlify stale state may persist during no-traffic periods. |
| A3 | Stale `share_rate_limits` retention can use a conservative cutoff based on last attempt plus limiter window/lock duration. | Architecture Patterns | Product may require longer forensic retention for rate-limit evidence. |

## Open Questions (RESOLVED)

1. **Should expired shares get a durable `expired_at` marker?**  
   - What we know: Owner status can already be derived from `expires_at`, and expired audit events exist. [VERIFIED: `shareService.ts`, `shareTypes.ts`]  
   - RESOLVED: Phase 03 plans and execution avoided an `expired_at` schema change. Expired status remains derived from `expires_at`, while cleanup uses idempotent expired audit insertion and stale limiter deletion below the route layer. [VERIFIED: `03-01-SUMMARY.md`, `03-02-SUMMARY.md`, `src/shared/db/repositories/shareRepository.ts`, `src/features/share/shareService.ts`]

2. **Should Netlify use a real Scheduled Function or opportunistic cleanup only?**  
   - What we know: Netlify docs support scheduled functions, and current checkout only has `backend/dist/netlify/api.mjs` generated from `src/app/netlify.ts`. [VERIFIED: `src/app/netlify.ts`; CITED: Netlify docs]  
   - RESOLVED: Phase 03 uses an hourly warm-instance opportunistic cleanup guard in `src/app/netlify.ts` instead of adding separate Netlify scheduled-function plumbing to this distribution checkout. [VERIFIED: `03-02-SUMMARY.md`, `src/app/netlify.ts`]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Tests/build scripts | yes [VERIFIED: local audit] | `v22.22.2` [VERIFIED: local audit] | Deployment targets still use Node 24 for Docker/Netlify. [VERIFIED: Dockerfile, workflow] |
| npm | Dependency/test/build commands | yes [VERIFIED: local audit] | `10.9.7` [VERIFIED: local audit] | none |
| Docker | MySQL/PostgreSQL runtime smoke | yes [VERIFIED: local audit] | `29.2.1` [VERIFIED: local audit] | Use source/migration assertions if daemon/services are unavailable. [VERIFIED: local audit] |
| Wrangler | Worker scheduled/build validation | yes [VERIFIED: local audit] | local `4.85.0`; project pins `4.75.0` [VERIFIED: local audit, package manifests] | Use `npm --prefix backend run build:worker` for project-pinned build path. [VERIFIED: backend scripts] |
| MySQL CLI | Direct MySQL smoke | no [VERIFIED: local audit] | none | Use Docker Compose service and app startup logs, or Node/mysql2 smoke. [VERIFIED: docker-compose-mysql-local.yml, `mysql2`] |
| PostgreSQL CLI | Direct PostgreSQL smoke | no [VERIFIED: local audit] | none | Use Docker Compose service and app startup logs, or Node/pg smoke. [VERIFIED: docker-compose-postgresql-local.yml, `pg`] |
| sqlite3 CLI | Direct SQLite shell smoke | no [VERIFIED: local audit] | none | Use `better-sqlite3`/Drizzle tests. [VERIFIED: backend dependencies] |

**Missing dependencies with no fallback:** None identified for planning; live database CLIs are missing but Docker/Node clients provide fallback paths. [VERIFIED: environment audit]

**Missing dependencies with fallback:** MySQL CLI, PostgreSQL CLI, and SQLite CLI are missing; use Docker Compose plus `mysql2`/`pg`/`better-sqlite3` or source-level SQL assertions. [VERIFIED: environment audit]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.5` [VERIFIED: npm registry, local test run] |
| Config file | `backend/vitest.config.ts` [VERIFIED: `rg --files`] |
| Quick run command | `npm --prefix backend test -- src/features/share/shareService.test.ts src/features/share/shareRoutes.test.ts src/shared/middleware/shareRateLimitMiddleware.test.ts src/app/index.test.ts` [VERIFIED: local test run] |
| Full suite command | `npm --prefix backend test` [VERIFIED: local test run] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| UX-01 | Expired share cleanup/marking and stale limiter cleanup are idempotent. [VERIFIED: requirement] | unit/repository/runtime source contract | `npm --prefix backend test -- src/features/share/shareService.test.ts src/shared/db/repositories/shareRepository.test.ts` | partial; repository test is Wave 0 [VERIFIED: `rg --files`] |
| UX-03 | Revocation limitation is documented and route/API notes do not imply retroactive recall. [VERIFIED: requirement] | docs/source contract | `rg -n "cannot retract|already copied|future access" docs .planning src` | docs update needed [VERIFIED: docs current text] |
| HARD-01 | Schema/repository/routes pass available runtime paths. [VERIFIED: requirement] | schema validator + build + conditional DB smoke | `node scripts/validate_share_schema_alignment.js && npm --prefix backend run build:worker && npm --prefix backend run build:docker && npm --prefix backend run build:netlify` | yes [VERIFIED: local files] |
| HARD-02 | Expired/revoked/wrong-code/locked/deleted/wrong-owner/token-enumeration scenarios are covered. [VERIFIED: requirement] | unit/route/middleware | quick run command above | partial [VERIFIED: existing tests] |
| HARD-03 | Public allowlists, headers, generic errors, log redaction. [VERIFIED: requirement] | route/middleware/app tests | quick run command above | partial [VERIFIED: existing tests] |
| HARD-04 | Auth/vault/backup/health/deployment regressions. [VERIFIED: requirement] | source-contract/smoke/generated assertions | `npm --prefix backend test && node scripts/restore_backend_source_from_sourcemaps.js --verify` | partial [VERIFIED: current tests] |

### Sampling Rate

- **Per task commit:** Run the focused test file for the touched module plus `node scripts/validate_share_schema_alignment.js` for schema/migration edits. [VERIFIED: existing validation pattern]
- **Per wave merge:** Run `npm --prefix backend test`. [VERIFIED: `02-VALIDATION.md`]
- **Phase gate:** Run full tests, schema validator, Worker/Docker/Netlify builds, source-map verifier, and generated bundle security assertions. [VERIFIED: `02-VALIDATION.md`, backend build scripts]

### Wave 0 Gaps

- [ ] `src/shared/db/repositories/shareRepository.test.ts` - covers cleanup delete/mark repository behavior for UX-01. [VERIFIED: file absent]
- [ ] Extend `scripts/validate_share_schema_alignment.js` - detects MySQL share migration `TEXT` indexed-column regression for HARD-01. [VERIFIED: current validator lacks dialect-specific TEXT index checks]
- [ ] Extend `src/features/share/shareService.test.ts` - explicit repeated-expired cleanup, token-enumeration, and exact allowlist cases for HARD-02/HARD-03. [VERIFIED: current tests partial]
- [ ] Add app/runtime source-contract tests for preserving backup cron, Worker scheduled handler, Netlify opportunistic cleanup, and route health gate behavior for HARD-04. [VERIFIED: current app tests partial]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Owner routes keep `authMiddleware`; public routes stay unauthenticated but token/code protected. [VERIFIED: `shareRoutes.ts`, `auth.ts`] |
| V3 Session Management | yes | Owner API regression tests must preserve cookie/JWT/CSRF session enforcement. [VERIFIED: `authMiddleware.ts`, `shareRoutes.ts`] |
| V4 Access Control | yes | Owner repository methods must remain owner-scoped; wrong-owner tests must use owner-scoped calls only. [VERIFIED: `shareRepository.ts`] |
| V5 Input Validation | yes | Public access code remains body-only; owner item id must be string; no query-code fallback. [VERIFIED: `shareRoutes.ts`, `shareRoutes.test.ts`] |
| V6 Cryptography | yes | Existing Web Crypto HMAC/random primitives remain unchanged; do not hand-roll new crypto. [VERIFIED: `shareSecurity.ts`] |
| V7 Error Handling and Logging | yes | Public errors remain generic and logs redact public share tokens. [VERIFIED: `shareRoutes.ts`, `app/index.ts`] |
| V8 Data Protection | yes | Public DTO allowlist and no-store/no-referrer headers remain mandatory. [VERIFIED: `shareTypes.ts`, `shareSecurity.ts`] |

### Known Threat Patterns for Hono/Drizzle Share Routes

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token enumeration through distinguishable public errors | Information Disclosure | Collapse missing/expired/revoked/wrong-code/locked/deleted states to `share_inaccessible`. [VERIFIED: `shareRoutes.ts`] |
| Share token leakage through logs | Information Disclosure | `redactSharePublicToken()` before centralized logger receives Hono log string. [VERIFIED: `src/app/index.ts`] |
| Brute-force access-code attempts | Spoofing / DoS | Fail-closed `shareRateLimit()` with durable limiter rows. [VERIFIED: `shareRateLimitMiddleware.ts`] |
| Wrong-code secret processing | Information Disclosure | Verify access code before `decryptField()` or OTP generation. [VERIFIED: `shareService.ts`, `02-SECURITY.md`] |
| Cross-owner share management | Elevation of Privilege | Use `findByIdForOwner`, `listForOwner`, and `revokeForOwner`. [VERIFIED: `shareRepository.ts`] |
| MySQL runtime migration failure | Denial of Service | Use bounded `VARCHAR` for indexed share identifiers in MySQL migration SQL. [VERIFIED: `src/shared/db/migrator.ts`; CITED: MySQL docs] |

## Sources

### Primary (HIGH confidence)

- `AGENTS.md` - project security, compatibility, architecture, privacy, and generated-bundle constraints. [VERIFIED: local file]
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` - Phase 3 scope and requirement IDs. [VERIFIED: local files]
- Phase 1/2 research, security, validation, and verification artifacts - prior decisions, gaps, and accepted debt. [VERIFIED: local files]
- `src/features/share/*`, `src/shared/db/repositories/shareRepository.ts`, `src/shared/middleware/shareRateLimitMiddleware.ts`, `src/app/*` - current implementation and test surface. [VERIFIED: local source]
- npm registry - current package versions for Hono, Drizzle, Vitest, Wrangler, database drivers. [VERIFIED: npm registry]
- Cloudflare Workers scheduled handler docs - scheduled handler and `ctx.waitUntil` behavior. [CITED: https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/]
- Netlify scheduled functions docs - cron support and limitations. [CITED: https://docs.netlify.com/functions/scheduled-functions/]
- Hono testing docs - `app.request` and test env pattern. [CITED: https://hono.dev/docs/guides/testing]
- Drizzle delete docs - `db.delete(...).where(...)` cleanup pattern. [CITED: https://orm.drizzle.team/docs/delete]
- MySQL 8.4 Column Indexes docs - indexed `TEXT`/`BLOB` prefix requirement. [CITED: https://dev.mysql.com/doc/en/column-indexes.html]

### Secondary (MEDIUM confidence)

- node-cron docs - `cron.schedule()` API and standard cron syntax. [CITED: https://nodecron.com/api-reference]

### Tertiary (LOW confidence)

- None. [VERIFIED: source list]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions verified against npm registry and local manifests. [VERIFIED: npm registry, `backend/package.json`]
- Architecture: HIGH - based on current source files and prior verified phase artifacts. [VERIFIED: `src/**`, Phase 1/2 artifacts]
- Cleanup policy details: MEDIUM - mechanism is clear, but retention/marker policy has product choices. [ASSUMED]
- Live MySQL/PostgreSQL compatibility: MEDIUM - schema debt is verified, but local MySQL/PostgreSQL CLIs are missing. [VERIFIED: `src/shared/db/migrator.ts`, environment audit]
- Pitfalls: HIGH - grounded in current code and prior verification warnings. [VERIFIED: local source, `02-VERIFICATION.md`]

**Research date:** 2026-05-03 [VERIFIED: system date]  
**Valid until:** 2026-06-02 for local codebase facts; re-check npm/platform docs before dependency or deployment changes. [ASSUMED]
