# Project Research Summary

**Project:** NodeAuth Account Share Links
**Domain:** Secure single-account HTTP share links for a self-hosted password/TOTP vault
**Researched:** 2026-05-02
**Confidence:** MEDIUM/HIGH

## Executive Summary

NodeAuth is a high-security self-hosted TOTP/vault application that needs API support for sharing exactly one account item through an HTTP link. Expert implementations treat this as a controlled plaintext export, not a normal vault read: the owner flow stays authenticated and CSRF-protected, while the recipient flow is public, token-gated, access-code-gated, rate-limited, and limited to a strict response allowlist.

The recommended approach is API-first and source-first. Restore or confirm editable backend source, migrations, build scripts, lockfile, and tests before implementation; do not hand-patch `backend/dist/**` for a security feature. Build a dedicated Hono share-link feature module backed by Drizzle schema/repositories, opaque high-entropy URL tokens stored only as hashes, independent access-code hashing, required expiration, owner revocation, audit events, and minimal shared-item DTOs. Keep the implementation compatible with Cloudflare Workers, Docker, and Netlify by using Web Crypto and existing database abstractions.

The main risks are URL-only bearer sharing, secret leakage through logs/browser mechanics, raw TOTP seed disclosure, broken object authorization, non-atomic expiration/revocation/view enforcement, fail-open rate limiting, and generated-bundle drift. Mitigate them with a threat-model/security-contract phase, separate owner and recipient route groups, fail-closed share-specific rate limiting, no-store/no-referrer headers, generic public errors, repository-level lifecycle predicates, response allowlist tests, and cross-engine migration/repository tests.

## Key Findings

### Recommended Stack

Keep the existing Hono/Drizzle/Web Crypto architecture. The app already has Hono route modules, auth/session middleware, centralized errors, Drizzle-backed repositories, and multi-target deployment; share links should fit that shape rather than adding a new framework or storage service. The stack research is strongest on platform/runtime choices and weaker only where exact source-level implementation details depend on restoring the missing TypeScript source.

**Core technologies:**
- Hono `^4.12.12` — route module and middleware surface for authenticated owner endpoints and public recipient endpoints.
- Drizzle ORM `0.45.2` plus Drizzle Kit `0.31.9` — schema, migrations, indexes, and cross-engine repository access for share state.
- Web Crypto API — portable token generation, keyed hashing, PBKDF2/HMAC, and constant-time comparison helpers across Workers and modern Node.
- Existing auth/session/CSRF middleware — protects owner create/list/inspect/revoke operations.
- Existing rate limiter with a strict share variant — throttles public token and access-code attempts, but must fail closed for share access.
- Optional Zod/`@hono/zod-validator` — useful for request validation if dependency provenance and lockfile work are accepted.
- Optional `jose` — only needed if a later phase issues short-lived recipient view tokens after access-code verification.

### Expected Features

The MVP must include the security and control-plane features users expect from password-manager share links: one-item links, no recipient account requirement, independent access code, expiration, revocation, owner list/inspect, minimal recipient response, current TOTP usability, rate limiting, audit events, and generic public errors.

**Must have (table stakes):**
- Create a link for exactly one owner-accessible vault item.
- Recipient can open the link without a NodeAuth account.
- URL token is high entropy, opaque, and stored only as a hash.
- Independent access code is required by default and never passed in a URL.
- Expiration is required with a hard maximum.
- Owner can list, inspect, and revoke active/expired/revoked links.
- Public response is a dedicated `SharedItemView` DTO, not a vault row or export DTO.
- TOTP behavior supports login by returning a current OTP code by default, not the raw seed.
- Public token/code access is rate-limited and returns generic inaccessible-share errors.
- Audit events record create/access/failure-threshold/expiry/revoke without logging secrets.

**Should have (competitive):**
- Limited-view or one-view links once atomic access counting is implemented.
- Short share access session for bounded TOTP refresh without repeated access-code entry.
- Field-scope controls such as password-only or OTP-only sharing after the DTO stabilizes.
- Copy-safe reveal controls and owner-visible history in UI work.
- Access notifications after audit history and notification providers are understood.

**Defer (v2+):**
- Device-bound access because it has high edge-case complexity.
- Recipient email verification because it adds delivery and identity flows beyond quick sharing.
- Secure reply/collaborative update flows because recipients should not mutate vault records.
- Client-side encrypted share payloads with URL fragments because they require deeper frontend and cryptographic design.
- Whole-vault sharing, public directories, never-expiring links, and URL-only sharing should remain out of scope.

### Architecture Approach

Implement a dedicated `share-links` feature module with visibly separate owner and recipient route groups. Owner routes use auth/session/CSRF and operate on share metadata. Recipient routes are public but token/code-gated, rate-limited, no-store/no-referrer, and never accept vault item IDs after link creation. Business rules live in `ShareLinkService`; persistence lives in `ShareLinkRepository`; vault access is a narrow single-item read/decrypt path; response shaping is an allowlisted DTO.

**Major components:**
1. `shareLinkRoutes.ts` — Hono route definitions, owner/public route split, request validation, secure headers.
2. `ShareLinkService` — lifecycle policy, token/code generation and verification, owner checks, expiry/revocation, DTO minimization.
3. `ShareLinkRepository` — create, lookup by token hash, owner list/detail, revoke, cleanup, and atomic access-count operations.
4. Vault repository/service helper — load and decrypt exactly one active vault item without using list/export flows.
5. `shareToken`/crypto utilities — random URL-safe tokens, keyed hashes, access-code derivation, constant-time comparisons.
6. Share-specific rate limiter — fail-closed throttling keyed by token/share and IP/fingerprint.
7. Migrations/schema variants — `vault_share_links` and optional `vault_share_access_events` across D1/SQLite, MySQL, and PostgreSQL.

### Critical Pitfalls

1. **Treating the share URL as the only secret** — require an independent access code by default, store only hashes, enforce short expiry and revocation.
2. **Leaking tokens, codes, or secrets through logs/browser mechanics** — redact share paths/codes, set `Cache-Control: no-store` and `Referrer-Policy: no-referrer`, avoid third-party recipient-page assets.
3. **Exposing the raw TOTP seed by default** — return generated current OTP codes and countdown by default; raw seed sharing should be explicit or unsupported.
4. **Broken object/property authorization** — verify owner access at creation, resolve recipient access only through token hash, and return a dedicated DTO allowlist.
5. **UI-only or non-atomic lifecycle enforcement** — enforce expiry, revocation, deleted-item checks, and view limits in repository predicates and atomic updates.
6. **Brute-forceable access codes with fail-open rate limiting** — use enough access-code entropy, password-hash/KDF storage, per-share/IP lockouts, and fail-closed behavior.
7. **Generated-bundle implementation drift** — restore source and reproducible builds before feature work; do not patch Worker/Docker/Netlify bundles by hand.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Source, Build, and Security Contract
**Rationale:** The checkout is distribution-oriented, and the feature is security-sensitive. Source provenance and the disclosure model must be settled before coding.
**Delivers:** Confirmed/restored `backend/src/**`, schema source, build scripts, backend lockfile, test harness, canonical share origin decision, TOTP disclosure policy, logging/header policy, and threat model.
**Addresses:** API-first milestone scope, cross-target compatibility, access-code-by-default requirement, current-code-vs-raw-seed decision.
**Avoids:** Generated-bundle drift, URL-only sharing, token/code leakage, raw TOTP seed exposure, unsafe Host-header link generation.

### Phase 2: Schema, Repository, and Security Primitives
**Rationale:** Share lifecycle state, token/code hashing, and rate limiting are dependencies for every route.
**Delivers:** `vault_share_links` table, indexes, optional access-event table, Drizzle schema variants, migrations, `ShareLinkRepository`, token/access-code crypto helpers, strict share rate limiter, repository/security utility tests.
**Uses:** Drizzle, Web Crypto, existing DB abstractions, existing rate-limit infrastructure with fail-closed behavior.
**Implements:** Share metadata persistence, hashed token lookup, access-code storage, expiration/revocation fields, cleanup hooks.
**Avoids:** Plaintext token/code storage, cross-engine schema drift, brute-forceable access codes, non-atomic future view limits.

### Phase 3: Owner Management API
**Rationale:** Owner create/list/inspect/revoke establishes the control plane and validates ownership before any public secret exposure exists.
**Delivers:** Authenticated `POST /api/share-links`, `GET /api/share-links`, `GET /api/share-links/:id`, and revoke endpoint; creation returns raw URL token and access code exactly once; list/detail never returns raw secrets.
**Addresses:** One-item link creation, required expiration, owner revocation, owner inspection, recipient label if included, audit create/revoke events.
**Avoids:** Broken owner object authorization, unsafe URL construction, misleading raw-token persistence, CSRF/CORS confusion on owner mutations.

### Phase 4: Public Recipient Access API
**Rationale:** Public access is the highest-risk surface and should be built after primitives and owner lifecycle are stable.
**Delivers:** Public preview/access endpoints, access-code verification through POST body, generic inaccessible-share errors, no-store/no-referrer headers, minimal `SharedItemView`, current TOTP code generation, successful/failed access auditing.
**Addresses:** No-account recipient flow, independent access code, minimal data exposure, TOTP login usability, rate limiting, generic errors.
**Avoids:** URL-only disclosure, raw TOTP seed exposure, vault DTO reuse, cache/referrer leakage, deleted-item access, token enumeration.

### Phase 5: Cleanup, UI Readiness, and UX Safeguards
**Rationale:** Cleanup and UX copy prevent stale shares and false owner assumptions; UI work depends on editable frontend source availability.
**Delivers:** Scheduled/opportunistic cleanup for expired shares and stale rate limits, owner-safe status metadata, optional frontend API contract or UI if source is restored, revocation semantics copy, recipient reveal/copy behavior guidance.
**Addresses:** Active/expired/revoked management, audit visibility, safe recipient interaction, owner awareness that revocation stops future link access only.
**Avoids:** Long-lived stale links, misleading revocation semantics, shoulder-surfing, accidental same-channel link/code sharing.

### Phase 6: Compatibility, Abuse, and Regression Hardening
**Rationale:** Multi-target deployment and security routes need tests that prove behavior across engines and attack paths.
**Delivers:** Route/security tests, response allowlist tests, log redaction tests, header tests, CSRF/CORS tests, wrong-owner/deleted-item tests, expired/revoked/locked tests, concurrent access-count tests if limited views are included, D1/SQLite plus alternate SQL repository contract tests.
**Addresses:** Deployment compatibility, database behavior, abuse resistance, security regression coverage.
**Avoids:** Cross-engine drift, fail-open rate limiting, lifecycle bypass, response overexposure, route middleware mistakes.

### Phase Ordering Rationale

- Source/provenance comes first because security-sensitive logic cannot be safely maintained in generated bundles.
- Schema, repository, crypto, and rate limiting come before routes because every API path depends on durable lifecycle state and secure secret handling.
- Owner management comes before recipient access so share creation, ownership checks, revocation, and audit state are stable before public disclosure.
- Recipient access is isolated as its own phase because it has the highest leakage and brute-force risk.
- Cleanup/UI/UX follows stable API contracts and depends on whether editable frontend source is available.
- Hardening is a separate phase because cross-engine and adversarial tests are large enough to deserve explicit roadmap space.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Source restoration/build provenance and canonical origin handling depend on actual repo/upstream state.
- **Phase 2:** Cross-engine migration details, atomic access-count semantics, and fail-closed rate-limit storage need implementation-level validation.
- **Phase 4:** TOTP current-code generation path and recipient DTO mapping need codebase-specific crypto/vault investigation.
- **Phase 5:** UI work needs confirmation of editable frontend source; if unavailable, this should become API contract/documentation only.
- **Phase 6:** Database compatibility matrix and concurrency test strategy need deeper planning if all supported engines remain in scope.

Phases with standard patterns (skip research-phase unless codebase discovery contradicts assumptions):
- **Phase 3:** Authenticated Hono CRUD-style owner endpoints follow existing route/service/repository patterns.
- **Basic parts of Phase 4:** POST body validation, generic errors, secure headers, and response allowlists are well-documented patterns once service dependencies exist.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing project and official package/runtime docs support Hono, Drizzle, Web Crypto, auth middleware, and database-backed state. Exact source edits remain medium until source is restored. |
| Features | HIGH | Strong alignment across PROJECT.md, OWASP guidance, and competitor patterns from 1Password, Bitwarden, Keeper, and Proton Pass. |
| Architecture | MEDIUM | Route/service/repository shape is clear from codebase research and compiled artifacts, but editable source is missing in this checkout. |
| Pitfalls | HIGH | Security failure modes are well supported by OWASP/NIST guidance and local codebase concerns, especially URL leakage, IDOR, logging, rate limits, and bundle drift. |

**Overall confidence:** MEDIUM/HIGH

### Gaps to Address

- **Editable source availability:** Confirm or restore backend source, frontend source, schema definitions, and build scripts before implementation.
- **Migration strategy:** Decide how Drizzle migrations are represented and applied across Cloudflare D1/SQLite, MySQL, and PostgreSQL.
- **Access-code policy:** Choose generated code length/format, hashing/KDF parameters, pepper source, lockout thresholds, and recovery behavior.
- **TOTP disclosure model:** Lock v1 default to current OTP codes and explicitly decide whether raw seed sharing is unsupported or behind an opt-in.
- **Canonical public origin:** Add or validate configuration for share URL generation instead of trusting inbound `Host`.
- **Rate-limit failure behavior:** Fix/wrap existing fail-open limiter for share routes and define health/deployment behavior when limiter storage is unavailable.
- **Frontend scope:** Determine whether editable frontend source exists; otherwise plan API-only milestone plus contracts/docs.
- **Audit retention/privacy:** Decide whether to store hashed/masked IP/user-agent metadata and define retention.

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` — milestone scope, requirements, constraints, and current checkout context.
- `.planning/research/STACK.md` — stack, dependency, crypto, data model, and version recommendations.
- `.planning/research/FEATURES.md` — table-stakes features, differentiators, anti-features, MVP definition, and competitor analysis.
- `.planning/research/ARCHITECTURE.md` — route/service/repository architecture, data flow, integration points, and build order.
- `.planning/research/PITFALLS.md` — critical security pitfalls, phase mapping, and recovery strategies.
- Local codebase research files referenced by researchers: `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/CONCERNS.md`.
- `backend/schema.sql` and `backend/dist/worker/worker.js` — current schema and compiled evidence for app routing, middleware, services, repositories, and missing share-link schema.
- Official Hono, Drizzle, Cloudflare Workers, MDN Web Crypto, and npm package metadata checked by stack research.
- OWASP Cheat Sheet Series: Forgot Password, Session Management, REST Security, Logging, Secrets Management, IDOR Prevention, and Unvalidated Redirects.
- NIST SP 800-63B Revision 4 — throttling, random values, replay resistance, and lookup-secret handling.

### Secondary (MEDIUM confidence)
- 1Password Support, item sharing and business sharing settings — product expectations for external sharing, expiration, revocation, and link history.
- Bitwarden Help, Send privacy/encryption/lifespan/create docs — product patterns for password-protected sends, lifecycle, and URL-fragment security.
- Keeper user/enterprise sharing docs and One-Time Share page — product patterns for one-time/device-bound sharing and activity management.
- Proton Pass Secure Links support and launch blog — secure-link dashboard, expiration/view limits, and no-account recipient patterns.

### Tertiary (LOW confidence)
- Context7 CLI fallback attempts for Hono and Drizzle failed with `fetch failed`; research used official docs and npm metadata instead, so impact is low.

---
*Research completed: 2026-05-02*
*Ready for roadmap: yes*
