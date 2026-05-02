# Stack Research

**Domain:** Secure single-account HTTP share links for an existing password/TOTP vault
**Researched:** 2026-05-02
**Confidence:** HIGH for platform/runtime choices, MEDIUM for exact implementation details because editable TypeScript source is missing from this distribution checkout

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Hono | `4.12.16` current, keep existing `^4.12.12` range | Route module and middleware for `/api/share-links/*` and public `/api/shared/*` access | The backend already mounts Hono feature routes and uses centralized error handling. Staying in Hono avoids a second HTTP framework, keeps Cloudflare Worker/Docker/Netlify parity, and supports the needed middleware/cookie/validation patterns directly. Confidence: HIGH. |
| Drizzle ORM | `0.45.2` | Cross-engine schema, repository access, inserts/updates/selects for share links, share audit events, and access attempts | The app already uses Drizzle for D1/SQLite/MySQL/PostgreSQL. Share links need relational state with expiry, revocation, single-use/usage counters, and owner/vault joins, so database-backed state is the right primitive. Confidence: HIGH. |
| Ordered SQL/Drizzle migrations | Drizzle Kit `0.31.9` existing | Add `vault_share_links`, optional `vault_share_access_events`, and indexes | This feature changes persistent schema. Do not rely only on `CREATE TABLE IF NOT EXISTS` in `backend/schema.sql`; existing deployments need versioned additive migrations across D1, SQLite, MySQL, and PostgreSQL. Confidence: HIGH. |
| Web Crypto API | Runtime built-in | Generate high-entropy share tokens, hash tokens and access codes, compare derived hashes, encrypt/decrypt existing vault data through current helpers | Cloudflare Workers and modern Node provide Web Crypto. Built-ins avoid Node-only crypto assumptions and keep the feature portable to Worker, Docker, and Netlify bundles. Use `crypto.getRandomValues`, `crypto.randomUUID`, `crypto.subtle.digest`, `crypto.subtle.importKey`, `crypto.subtle.sign`, and existing AES-GCM helpers. Confidence: HIGH. |
| Existing auth/session middleware | Existing app code | Protect owner-only create/list/revoke endpoints | Owner endpoints must remain session-scoped and CSRF-protected. Public recipient endpoints must not use owner session cookies and must be separate routes with their own access-code verification. Confidence: HIGH. |
| Existing database-backed rate limiter, fixed to fail closed for share routes | Existing app middleware | Throttle share-token lookup and access-code attempts | Shared links are credential disclosure endpoints. Use per-token-hash and per-IP keys. Existing limiter currently logs DB errors and allows traffic; for share access, add a strict variant or option that fails closed on database errors. Confidence: HIGH. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Hono Validator or `@hono/zod-validator` | `@hono/zod-validator` `0.7.6`, Zod `4.4.2` current | Validate create/revoke/list/public-access payloads | Use only if editable source is restored and adding validation dependency is acceptable. Prefer Zod for explicit constraints on `vaultItemId`, `expiresIn`, `maxViews`, `accessCode`, and response shaping. If avoiding new dependencies, use Hono's built-in validator with small local validators. Confidence: MEDIUM. |
| Existing app `AppError` and error envelope | Existing | Return safe, typed errors | Share endpoints should return generic errors for invalid/expired/revoked links and wrong access codes. Do not reveal whether the token exists, which owner created it, or whether an access code was close. Confidence: HIGH. |
| Existing logger with masking helpers | Existing | Security audit trail without secret leakage | Log creation/revocation/access outcomes with masked IP/user agent and share ID. Never log raw tokens, access codes, TOTP secrets, passwords, decrypted vault fields, or full URLs. Confidence: HIGH. |
| Existing crypto utilities | Existing | Decrypt the one vault item and optionally encrypt share metadata | Reuse current vault decryption flow so shared responses match the app's encryption model. Avoid adding separate encryption stacks unless key rotation/share wrapping is introduced in a later milestone. Confidence: HIGH. |
| `jose` | `6.2.3` current | Optional signed short-lived recipient view token after access-code verification | Not required for MVP. Use only if the frontend needs a two-step flow where the access code is submitted once and then a short-lived bearer/cookie token authorizes repeated reads during the link session. Otherwise, database verification per request is simpler. Confidence: MEDIUM. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | Unit and route tests | Add tests for token generation, hashing, expiry, revocation, max views, wrong access code, response redaction, and rate-limit fail-closed behavior. Existing package declares Vitest but this checkout has no tests. |
| Wrangler local D1/dev server | Cloudflare Worker integration testing | Verify D1 schema and Hono routes under Worker runtime, especially Web Crypto and cookie/header behavior. |
| Drizzle Kit | Migration/schema generation | Generate engine-compatible schema changes from source once the real `backend/src/**` and migration directory are restored. |
| Cross-engine repository contract tests | D1/SQLite/MySQL/PostgreSQL behavior | Required because the app supports multiple engines and share state depends on timestamps, booleans, unique constraints, indexes, and atomic usage updates. |

## Installation

Do not install a large sharing framework. The minimal dependency path is:

```bash
# Keep existing core dependencies
npm install --prefix backend hono@^4.12.12 drizzle-orm@^0.45.2

# Optional validation dependency if source-level schemas are added
npm install --prefix backend zod@^4.4.2 @hono/zod-validator@^0.7.6

# Optional only for signed temporary recipient view tokens
npm install --prefix backend jose@^6.2.3

# Existing dev tooling; pin through a backend lockfile before feature work
npm install --prefix backend -D vitest@^4.1.0 drizzle-kit@^0.31.9 wrangler@4.75.0
```

Before implementation, generate and commit `backend/package-lock.json`, then switch Docker/Netlify/CI installs to `npm ci --prefix backend`. The current backend dependency install path is not reproducible.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Opaque random share token stored as a hash in SQL | JWT-only share link | Use JWT-only links only for non-sensitive, non-revocable content. Vault sharing requires revocation, expiry enforcement, max views, audit events, and access-code attempt throttling, all of which are cleaner with database state. |
| Separate access code hashed in SQL | URL token alone | URL-only links are acceptable for low-risk public downloads, not for account credentials and TOTP secrets. Requirement already says leaked URL alone must not be enough. |
| Web Crypto built-ins | `bcrypt`, `argon2`, Node `crypto`-only APIs | Use Argon2 only if the app restores a Worker-compatible server-side Argon2 story and accepts WASM/runtime complexity. For short random access codes, prefer high entropy plus PBKDF2/HMAC via Web Crypto and aggressive rate limiting. |
| Database-backed share state | Cloudflare KV/R2/Durable Objects | Use KV/R2 only for large public objects or cacheable data. Share links must work on Docker and Netlify too, and need relational joins with vault ownership and revocation state. |
| New `shareLinks` feature module | Patching `vaultRoutes` directly | Add to `vaultRoutes` only if source organization demands it. A separate module keeps owner management and public recipient access easier to audit. |
| Existing central error handling | Per-route ad hoc JSON errors | Use ad hoc errors only for throwaway prototypes. Security routes need consistent envelopes and controlled leakage. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Storing raw share tokens or access codes | Database leaks would immediately expose live credentials. OWASP token guidance treats reset-style URL tokens as secrets that should be random, single-purpose, expiring, and stored securely. | Generate random tokens, show once, store only `token_hash`; hash access codes with per-link salt and server pepper. |
| Whole-vault or category share schema | Larger blast radius and outside milestone scope. It also complicates authorization, redaction, and revocation semantics. | One link references exactly one `vault.id`. |
| New recipient account/session system | The requested recipient is a friend opening a link, not a NodeAuth user. A full auth flow increases product and security surface area. | Public route with token plus independent access code, optionally issuing a short-lived recipient view token after verification. |
| Public static asset URLs containing secrets | Static hosting and CDN logs can retain URLs. | Route all share access through Hono API endpoints and avoid placing decrypted data in asset paths, query params, logs, or redirects. |
| Sending decrypted credentials to logs/analytics | Shared data contains passwords/TOTP seeds and must be treated like plaintext export. | Mask logs; audit metadata only. |
| Adding email/SMS delivery as part of stack | Delivery adds abuse, privacy, provider secrets, bounces, and rate limits. It is not required for API support. | Return the link once to the owner; owner sends it out-of-band. |
| Client-side-only enforcement of expiry/access code | Anyone can bypass UI checks and call the API. | Enforce all expiry, revocation, max-view, access-code, and rate-limit checks server-side. |
| Direct edits to `backend/dist/**` as normal development | This checkout is distribution-only; manual bundle patches would have to be duplicated across Worker, Docker, and Netlify outputs. | Restore `backend/src/**`, migrations, and build scripts, then regenerate all platform bundles from one source. |

## Stack Patterns by Variant

**If implementing API MVP:**
- Add `src/features/share/shareRoutes.ts`, `shareService.ts`, and `shareRepository.ts`.
- Add authenticated owner routes:
  - `POST /api/share-links` create link for one vault item.
  - `GET /api/share-links` list active/revoked/expired links.
  - `DELETE /api/share-links/:id` revoke link.
- Add public recipient routes:
  - `POST /api/shared/:token/verify` verifies access code and returns either the one shared item or a short-lived view token.
  - `GET /api/shared/:token` returns only safe link metadata such as service/account label and whether an access code is required; it must not reveal secrets before verification.
- Because this keeps public and authenticated flows distinct and makes security review tractable.

**If frontend source is not restored:**
- Build the backend API and tests first.
- Do not promise production UI work against generated Vue chunks.
- Because the current checkout only contains `frontend/dist/**`; modifying generated assets is brittle and not reviewable.

**If using database-backed access-code verification:**
- Store `access_code_salt`, `access_code_hash`, `access_code_attempts`, `locked_until`, and `last_accessed_at`.
- Use `crypto.getRandomValues` for salts and Web Crypto PBKDF2/HMAC-SHA-256 for derived hashes, with a server-side pepper from existing secret material or a new `SHARE_LINK_PEPPER`.
- Because access codes may be human-entered and lower entropy than the URL token; they require stronger storage and strict attempt limits.

**If exposing TOTP details:**
- Return only the fields needed to log in: service name, account identifier, password/secret material for that one row, TOTP parameters, and current TOTP code if the existing vault API already supports server-side generation.
- Do not return owner user ID, internal session data, backup metadata, full vault list, deleted rows, device salts, or encryption keys.
- Because the share endpoint is a controlled plaintext export of one vault item.

**If supporting max views or one-time links:**
- Use an atomic database update that checks `revoked_at IS NULL`, `expires_at > now`, and `views_used < max_views` in the same operation that increments `views_used`.
- Because separate read-then-update logic can allow concurrent overuse.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Hono `^4.12.12` | Cloudflare Workers, `@hono/node-server` `^1.19.13`, Netlify Functions | Current npm is `4.12.16`. Keep the existing range unless a security fix requires a direct bump. |
| Drizzle ORM `0.45.2` | Drizzle Kit `0.31.9` | Current app already declares these versions. Add migrations and indexes through source, not by hand-editing only generated bundles. |
| Web Crypto API | Cloudflare Workers runtime and Node 24 | Use `globalThis.crypto` APIs that exist in both runtimes. Avoid Node-only `crypto.createHash`/`randomBytes` in shared Worker code. |
| Zod `4.4.2` | `@hono/zod-validator` `0.7.6` | Optional. Current backend does not declare either dependency, so adding them requires lockfile/provenance work. |
| `jose` `6.2.3` | Web Crypto runtimes | Optional. Useful for signed temporary recipient tokens, not needed for simple database-backed verification. |
| Wrangler `4.75.0` | `@cloudflare/workers-types` `^4.20260411.1` | Existing repo pins Wrangler. Keep workflow and package versions aligned. |

## Recommended Data Model

Add schema through source-level Drizzle definitions plus SQL migrations:

```sql
CREATE TABLE vault_share_links (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  access_code_salt TEXT NOT NULL,
  access_code_hash TEXT NOT NULL,
  access_code_required BOOLEAN DEFAULT 1,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  max_views INTEGER,
  views_used INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  last_accessed_at INTEGER
);

CREATE INDEX idx_vault_share_links_vault_id ON vault_share_links(vault_id);
CREATE INDEX idx_vault_share_links_owner_user_id ON vault_share_links(owner_user_id);
CREATE INDEX idx_vault_share_links_expires_at ON vault_share_links(expires_at);
CREATE INDEX idx_vault_share_links_revoked_at ON vault_share_links(revoked_at);
```

Optional but recommended audit table:

```sql
CREATE TABLE vault_share_access_events (
  id TEXT PRIMARY KEY,
  share_link_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_vault_share_access_events_share_link_id
  ON vault_share_access_events(share_link_id);
```

Do not store raw IP or full user agent unless the project has an explicit retention policy. Hash or mask metadata for abuse detection and audit value.

## Source-Level Implementation Pattern

Use this module boundary once source is restored:

| Module | Responsibility |
|--------|----------------|
| `src/features/share/shareRoutes.ts` | Hono route definitions, auth/public route split, request validation. |
| `src/features/share/shareService.ts` | Business rules: owner checks, token generation, access-code verification, revocation, expiry/max-view enforcement, response redaction. |
| `src/shared/db/repositories/shareRepository.ts` | Cross-engine DB operations and atomic consume/update methods. |
| `src/shared/db/schema/shareLinks.ts` | Drizzle schema for all supported engines. |
| `src/shared/utils/shareToken.ts` | Generate URL-safe random tokens, hash tokens, derive access-code hashes, constant-time compare helpers. |
| `src/features/share/shareRoutes.test.ts` | Route-level security tests. |

Keep decrypted vault material inside `shareService`. Route handlers should never assemble decrypted response objects directly.

## Sources

- Existing project context: `.planning/PROJECT.md`, `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md` - confirmed Hono, Drizzle, Worker/Docker/Netlify, security concerns, missing source, and backend dependency versions. Confidence: HIGH.
- npm package metadata checked 2026-05-02: Hono `4.12.16`, Drizzle ORM `0.45.2`, Zod `4.4.2`, `@hono/zod-validator` `0.7.6`, `jose` `6.2.3`, `argon2-browser` `1.18.0`. Confidence: HIGH.
- Hono official docs: middleware, validation, cookies, secure headers, CSRF, and bearer auth patterns. Confidence: HIGH.
- Drizzle official docs: schema definitions, indexes/constraints, transactions, migrations, and Cloudflare D1 driver patterns. Confidence: HIGH.
- Cloudflare Workers official docs: Web Crypto runtime API, Node.js compatibility, compatibility dates/flags, and D1 prepared/batch behavior. Confidence: HIGH.
- MDN Web Crypto docs: `crypto.getRandomValues`, `crypto.randomUUID`, `SubtleCrypto.digest`, `importKey`, `sign`, PBKDF2, and AES-GCM browser/runtime semantics. Confidence: HIGH.
- OWASP Cheat Sheet Series: Forgot Password Cheat Sheet for URL token lifecycle, Password Storage Cheat Sheet for PBKDF2/HMAC guidance, Session Management Cheat Sheet for cookie attributes, Logging Cheat Sheet for avoiding secret leakage, and Secrets Management Cheat Sheet for secret lifecycle/audit considerations. Confidence: HIGH.
- Context7 CLI fallback attempted for Hono and Drizzle but failed with `fetch failed`; official docs and npm metadata were used instead. Confidence impact: LOW because primary official sources were available.

---
*Stack research for: secure single-account share links*
*Researched: 2026-05-02*
