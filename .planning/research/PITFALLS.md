# Pitfalls Research

**Domain:** Secure single-account HTTP share links for a high-security TOTP/vault app
**Researched:** 2026-05-02
**Confidence:** HIGH for security failure modes; MEDIUM for exact implementation mapping because this checkout lacks editable source trees and tests.

## Critical Pitfalls

### Pitfall 1: Treating the Share URL as the Only Secret

**What goes wrong:**
A copied URL becomes enough to reveal a login item. The URL leaks through browser history, chat previews, screenshots, logs, referrer headers, proxy logs, support tickets, or mobile notification previews. Anyone who obtains it can access the shared vault item until expiry.

**Why it happens:**
Capability links feel simple: generate a random token, store it, and gate the public endpoint on that token. Teams often underestimate how many systems record full URLs, especially when the recipient page loads assets or makes API requests from the same URL context.

**How to avoid:**
Require an independent access code by default. Store only a hash of the URL token and a password-hash/KDF result for the access code. Use a high-entropy random token, short default expiration, explicit revocation, rate limiting, and generic errors. The access code must be entered through `POST` body data, never as a URL query parameter. If the roadmap later supports client-side encrypted share payloads, keep the decryption key in the URL fragment so the server does not receive it.

**Warning signs:**
Share creation returns a single URL and no separate code; API accepts `?code=` or `?password=`; token values are stored plaintext; tests only cover the happy path; product copy says "anyone with the link" as the default for a sensitive credential.

**Phase to address:**
Phase 1 threat model and security contract; Phase 2 share token/access-code primitives; Phase 4 recipient access API.

---

### Pitfall 2: Leaking Tokens, Codes, or Secrets Through Logs and Browser Mechanics

**What goes wrong:**
The app avoids database exposure but leaks the same secrets through request logs, analytics, frontend error reports, referrers, caches, or CDN/proxy diagnostics. Share tokens and decrypted account data can persist outside the vault control boundary.

**Why it happens:**
Share links are public HTTP routes, and the easiest implementation puts the token in the path or query string. Existing request logging often captures URLs, headers, error messages, and response metadata by default. Browser cache behavior is frequently forgotten for JSON responses.

**How to avoid:**
Redact share tokens and access codes in request logging before the root logger sees them. Set `Cache-Control: no-store`, `Pragma: no-cache`, `Referrer-Policy: no-referrer`, and a restrictive CSP on share pages and secret API responses. Do not load third-party scripts, analytics, remote fonts, or preview metadata on recipient pages. Never include credentials, access codes, raw tokens, or TOTP seeds in errors. Add tests that inspect response headers and log output for share routes.

**Warning signs:**
Public share routes are covered by generic request logging; logs include `/share/<token>`; frontend share page includes analytics or third-party assets; response headers are inherited from normal app pages without no-store/no-referrer checks.

**Phase to address:**
Phase 1 route and logging threat model; Phase 4 recipient access API; Phase 5 recipient UI; Phase 6 observability and security tests.

---

### Pitfall 3: Exposing the Raw TOTP Seed When a Current Code Would Do

**What goes wrong:**
The recipient receives the TOTP secret seed, not just a current one-time code. Even after link revocation, expiry, or deletion, the recipient can keep generating future TOTP codes if they copied the seed.

**Why it happens:**
Vault item sharing is often modeled as "return the item DTO." For TOTP records, the stored `secret` is not just a display field; it is the long-lived authenticator secret. A generic vault serializer can accidentally reveal it.

**How to avoid:**
Make the roadmap decide the v1 disclosure model explicitly. Recommended default: share username/password and server-generated current TOTP codes, but hide the raw TOTP seed unless the owner performs an explicit "reveal seed" action with stronger warnings and shorter limits. The recipient DTO must be separate from the owner vault DTO. If a raw seed is ever shared, the UI must state that revoking the link cannot revoke a copied authenticator secret and should prompt the owner to rotate the account's 2FA secret after sharing.

**Warning signs:**
Implementation reuses the normal vault `get account` serializer; tests assert that `secret` is present in shared responses; no product distinction between "current code" and "TOTP setup secret"; revocation copy implies access is fully undone.

**Phase to address:**
Phase 1 product/security contract; Phase 3 owner share configuration; Phase 4 recipient response shaping; Phase 5 UX warnings.

---

### Pitfall 4: Broken Object-Level or Property-Level Authorization

**What goes wrong:**
A recipient can access a different vault item by changing an ID, or receives fields unrelated to the shared account: owner email, internal vault IDs, deleted rows, backup/provider data, session metadata, or encrypted implementation details. In multi-user deployments, one authenticated owner may create a share for an item they do not own.

**Why it happens:**
The existing schema has `created_by` and `updated_by`, but the codebase concerns note user scoping is not consistently guaranteed. Link-sharing adds a second access model: owner-authenticated management routes plus anonymous recipient routes. Reusing repository methods without explicit ownership and projection rules invites IDOR and over-sharing.

**How to avoid:**
Use separate repositories/services for owner share management and recipient share access. Owner routes must verify the current authenticated user can access the vault row before creating or listing shares. Recipient routes must resolve only by hashed token/public share ID and return a dedicated minimal DTO. Never accept a raw vault item ID on public access routes after the share token has been created.

**Warning signs:**
Public routes accept both `shareToken` and `vaultId`; response schemas are typed as the existing vault item type; owner share creation only checks authentication, not item ownership; tests do not include "other user's item" or soft-deleted item cases.

**Phase to address:**
Phase 2 schema/repository design; Phase 3 owner APIs; Phase 4 recipient APIs; Phase 6 cross-user authorization tests.

---

### Pitfall 5: Expiration, Revocation, and View Limits Are UI-Only or Non-Atomic

**What goes wrong:**
Expired or revoked links still work through the API. Max-view links can be accessed more times under concurrent requests. Revocation updates one deployment target but fails on another database engine. Deleted vault items remain shareable.

**Why it happens:**
Expiration is easy to display in the UI and easy to forget in the database predicate. View counters require atomic update semantics, and NodeAuth supports Cloudflare D1/SQLite, MySQL, and PostgreSQL, where timestamp, boolean, and update-returning behavior can differ.

**How to avoid:**
Enforce `revoked_at IS NULL`, `expires_at > now`, item-not-deleted, and access-count limits in repository methods, not only in route handlers or UI. Update access counters atomically with compare-and-increment semantics. Add indexes on token hash, vault item ID, owner, expiry, and revoked status. Write repository contract tests against the supported engines or at least D1/local SQLite plus one SQL alternative before shipping.

**Warning signs:**
The API first fetches a share and then checks expiry in application code; access count is incremented after returning secrets; no database indexes for share lookup/expiry; tests do not simulate two simultaneous recipient opens.

**Phase to address:**
Phase 2 schema/repository design; Phase 4 recipient access API; Phase 6 database compatibility and concurrency tests.

---

### Pitfall 6: Brute-Forceable Access Codes and Fail-Open Rate Limiting

**What goes wrong:**
Attackers can guess short access codes or repeatedly test leaked tokens. If the rate-limit table is missing or errors, public share access remains available. This is especially dangerous because the existing codebase concern already notes a fail-open rate limiter for sensitive routes.

**Why it happens:**
Teams treat the URL token as the real protection and choose human-friendly short PINs for the second factor. Public recipient routes also lack a logged-in user identity, so developers forget to key rate limits by share, IP, and user agent characteristics.

**How to avoid:**
Use access codes with enough entropy for online attack resistance, store them with a password hashing scheme, and require fail-closed rate limiting for access-code attempts. Key limits by share ID/token hash and IP, with escalating delay or temporary lockout. Return the same generic response for invalid, expired, revoked, or locked links. Add health checks that fail deployment if the share rate-limit storage is unavailable.

**Warning signs:**
Default access codes are 4 to 6 digits; rate-limit errors call `next()`; invalid code responses differ from expired link responses; generating a new access code resets failed attempts without owner action.

**Phase to address:**
Phase 1 security requirements; Phase 2 rate-limit primitive; Phase 4 recipient access API; Phase 6 abuse tests.

---

### Pitfall 7: Misleading Revocation Semantics

**What goes wrong:**
Owners believe revoking a link pulls back the credential, but recipients may already have copied the password, seed, or screenshots. Users share high-value accounts without rotating credentials afterward.

**Why it happens:**
Password-manager sharing UI often says "delete link" or "stop sharing." That is technically true for future link opens, but not for already disclosed secrets. In a TOTP/vault app, copied credentials retain value outside the app.

**How to avoid:**
Use precise UX language: revocation stops future access to the link, not use of copied credentials. For high-risk accounts, show a post-share reminder to rotate the account password and, if the TOTP seed was exposed, reset 2FA. Owner history should show whether the link was opened, when, from approximate IP/device, and whether the raw seed was revealed.

**Warning signs:**
UI copy says "unshare" without caveat; no access history; no distinction between viewed, copied, and seed revealed; no rotation prompt after sharing a TOTP seed.

**Phase to address:**
Phase 3 owner management API; Phase 5 UI/UX; Phase 6 audit events.

---

### Pitfall 8: Unsafe Share URL Construction and Redirect Handling

**What goes wrong:**
The backend creates share URLs using an attacker-controlled `Host` header, or a `returnTo`/redirect parameter sends recipients to a phishing site after access. Recipients see a legitimate NodeAuth domain before being forwarded elsewhere.

**Why it happens:**
Self-hosted deployments make canonical origin handling inconvenient. Developers often derive absolute links from the inbound request rather than a configured public origin allowlist.

**How to avoid:**
Require a configured canonical public origin for share link generation, or validate the request host against an allowlist. Do not support arbitrary post-access redirects in v1. If redirects are later needed, map short server-side IDs to trusted destinations instead of accepting raw URLs.

**Warning signs:**
Code uses `new URL(request.url).origin` or `Host` directly for share links; tests do not cover spoofed host headers; public routes accept `next`, `redirect`, or `returnTo` URL parameters.

**Phase to address:**
Phase 1 deployment/security contract; Phase 3 owner share creation; Phase 6 deployment tests.

---

### Pitfall 9: Cross-Site Request and CORS Confusion Between Owner and Public Routes

**What goes wrong:**
Public share endpoints accidentally accept owner cookies, broad CORS, or CSRF-bypassing mutating actions. A malicious site could create, revoke, or inspect shares from an authenticated owner, or scrape public share responses cross-origin.

**Why it happens:**
NodeAuth already mixes SPA assets, cookie auth, CSRF, and API routes behind Hono. Link sharing adds unauthenticated recipient routes. If those are mounted under the same `/api/vault` assumptions, middleware order mistakes become likely.

**How to avoid:**
Separate route groups clearly: authenticated owner management routes require auth and CSRF for mutations; public recipient routes must not rely on owner cookies and should allow only the methods and origins needed by the same-origin SPA. Keep CORS restrictive. Add route-level tests for missing CSRF on owner mutations, credentialed cross-origin requests, and public route behavior when an owner session cookie is present.

**Warning signs:**
Share create/revoke routes are `GET`; public route and owner route share the same middleware chain without tests; CORS allows `*` with credentialed flows; recipient access behavior changes when the browser has an owner session cookie.

**Phase to address:**
Phase 2 route architecture; Phase 3 owner APIs; Phase 4 recipient APIs; Phase 6 security regression tests.

---

### Pitfall 10: Implementing the Feature Directly in Generated Bundles

**What goes wrong:**
Security-sensitive logic is patched into `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, and `backend/dist/netlify/api.mjs` by hand. One target drifts, tests cannot meaningfully cover the source, and future updates overwrite the change.

**Why it happens:**
This checkout is distribution-oriented and lacks the TypeScript backend source, frontend source, backend build scripts, and test files. A share-link feature touches auth, vault crypto, schema, route middleware, UI, and deployment, which is too risky to patch in generated artifacts.

**How to avoid:**
Make source restoration or upstream-source import the first roadmap phase if editable source is not available elsewhere. Feature work should happen in `src/features/share`, shared repositories, schema migrations, and frontend source, then regenerate all deploy bundles from one build. Require a backend lockfile and tests before shipping.

**Warning signs:**
Roadmap starts with editing `backend/dist/**`; no `backend/src/**` or frontend source is restored; only one platform bundle is changed; no reproducible build command proves all artifacts came from the same source.

**Phase to address:**
Phase 0 or Phase 1 source/provenance restoration before any share-link implementation.

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store plaintext share tokens | Easy lookup and debugging | Database read becomes immediate link compromise | Never |
| Reuse vault item DTO for recipient response | Fast API implementation | Leaks raw TOTP seed, internal IDs, owner metadata, deleted state | Never |
| Enforce expiry only in frontend | Quick demo | Expired links still work by direct API call | Never |
| Patch generated bundles | Avoids source restoration | Cross-platform drift and unreviewable security code | Emergency hotfix only, followed by source rebuild |
| Use short numeric PIN access codes | Easier recipient typing | Online guessing risk, especially with fail-open limiter | Only with strict low attempt limits and short expiry; not recommended default |
| Skip cross-engine migration tests | Faster Cloudflare-only path | Docker/Netlify users hit schema or boolean/timestamp bugs | Only if milestone explicitly drops alternate DB support |

## Integration Gotchas

Common mistakes when connecting this feature to existing NodeAuth surfaces.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Hono route middleware | Mount public share routes under authenticated vault middleware or owner routes under public middleware | Create explicit owner and recipient route groups with separate auth/CSRF/rate-limit policies |
| Repository layer | Query vault rows by item ID from public route | Resolve public access only through share record/token hash, then join to exactly one non-deleted vault row |
| Logger | Log full request URL and access-code failures with raw values | Redact token/code; log salted hash or share ID, event type, timestamp, coarse IP/device |
| Rate limit repository | Reuse fail-open limiter for public access-code verification | Implement fail-closed limiter for share-token and access-code attempts |
| Schema migrations | Add one SQLite/D1 table only | Version share schema and indexes for D1/SQLite, MySQL, and PostgreSQL or explicitly narrow deployment support |
| SPA/static assets | Put share secrets into localStorage or analytics-instrumented page | Keep secrets in memory, no third-party scripts, no-store/no-referrer headers |
| Deployment URL generation | Build links from inbound Host header | Use configured public origin or strict host allowlist |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No index on token hash | Public link opens become slow and increase DB load | Unique index on token hash/public ID | Hundreds to thousands of shares |
| No cleanup for expired shares/access attempts | Tables grow forever; owner list gets noisy | Scheduled cleanup via existing cron plus opportunistic cleanup on access | Long-running self-hosted deployments |
| Non-atomic max-view updates | One-time links open multiple times during concurrent requests | Atomic compare-and-increment update | Any parallel access or browser retry |
| Heavy owner list queries | Listing shares joins/decrypts vault data unnecessarily | Store minimal share metadata and join only display fields needed | Dozens of shared links per owner |
| Per-request TOTP seed decryption without bounds | Abuse of public endpoint causes CPU/db pressure | Rate limit before decrypting; cache only safe derived current-code state if necessary | Leaked token under automated probing |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| URL-only bearer sharing | Link leakage reveals credentials | Require separate access code by default and short expiry |
| Returning raw TOTP seed by default | Recipient retains future OTP generation after revocation | Return current OTP codes by default; require explicit seed reveal |
| Plaintext token/code storage | DB compromise turns into immediate share compromise | Hash tokens and access codes; encrypt any stored share payload |
| Detailed invalid-link errors | Attackers enumerate valid tokens or states | Use generic recipient errors for invalid/expired/revoked/locked |
| Fail-open rate limiting | Brute-force continues during DB/rate-limit failure | Fail closed for share access and surface health errors |
| Cacheable secret responses | Browser/proxy stores credentials | `Cache-Control: no-store` on all share pages and API responses |
| Referrer leakage | Token sent to third-party domains | `Referrer-Policy: no-referrer` and no third-party recipient-page assets |
| Host-header link generation | Attacker creates legitimate-looking malicious links | Configured public origin or host allowlist |
| Overbroad CORS | Cross-origin scraping or CSRF side effects | Same-origin public UI, specific origins only, no credentialed wildcard |
| Misleading revocation | Owners do not rotate credentials after disclosure | Show access history and rotation warnings |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Hiding expiration/access controls behind advanced settings | Owners create unsafe long-lived links | Default to short expiry, access code, and easy revoke |
| Ambiguous "stop sharing" language | Owners assume copied credentials are invalidated | Say "Stops future link access; rotate credentials if copied" |
| Showing all secrets immediately on page load | Shoulder-surfing and screen-share exposure | Hide password/TOTP by default with explicit reveal/copy buttons |
| No owner history | Owner cannot tell whether a link was used | Show created, expires, revoked, opened count, last access, seed revealed |
| Recipient cannot verify sender context | Phishing risk | Show minimal sender label only if owner allows it, and warn recipients to confirm unexpected links |
| Access code sent in same generated text as link | Link and code leak together | Encourage separate channel; copy link and code as separate actions |
| No expired/revoked recovery path | Recipients ask owner for screenshots or unsafe workarounds | Provide clear "ask owner for a new link" state without revealing which condition failed to attackers |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Share creation:** Generates high-entropy random token, stores only token hash, requires owner auth and CSRF, validates item ownership.
- [ ] **Access code:** Enabled by default, stored with a password-hashing scheme, never placed in URL, rate-limited fail-closed.
- [ ] **Recipient response:** Uses a dedicated minimal DTO; does not include vault list, owner session data, backup metadata, raw internal IDs, or raw TOTP seed by default.
- [ ] **Expiry/revocation:** Enforced in repository predicates and covered by tests for expired, revoked, deleted-item, and max-view cases.
- [ ] **Logging/privacy:** Share tokens, codes, passwords, and TOTP values do not appear in logs, errors, analytics, browser cache, or referrers.
- [ ] **Headers:** Recipient page and secret API responses include `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
- [ ] **Abuse handling:** Invalid token, wrong code, expired, revoked, and locked states return generic recipient-safe errors.
- [ ] **Owner management:** Owner can list active/expired shares, inspect safe metadata, revoke links, and see whether access occurred.
- [ ] **TOTP semantics:** Roadmap explicitly decides current-code sharing vs raw seed reveal and tests that default behavior matches the decision.
- [ ] **Cross-platform support:** Share schema/migrations and repository tests cover Cloudflare D1/SQLite plus Docker/Netlify database engines targeted by the milestone.
- [ ] **Source provenance:** Implementation is done in source modules and regenerated into all bundles, not hand-patched in `dist`.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Plaintext tokens stored or logged | HIGH | Revoke all active shares, purge/redact logs where possible, rotate affected account credentials, migrate to hashed tokens |
| Raw TOTP seed exposed unintentionally | HIGH | Revoke links, notify owner, rotate account 2FA seed, add regression test preventing seed in default DTO |
| Expired/revoked links still accessible | HIGH | Disable public share route temporarily, patch repository predicate, invalidate active shares created during affected period, audit access logs |
| Access-code brute force found | MEDIUM/HIGH | Fail closed, lower attempt limits, invalidate targeted shares, add per-share/IP lockouts and monitoring |
| Host-header poisoning in generated links | MEDIUM | Add canonical origin config, invalidate suspicious shares, add spoofed-host tests |
| Overbroad recipient DTO | HIGH | Remove fields, add response-schema allowlist tests, review logs/error reports for leaked data |
| Cross-engine migration failure | MEDIUM | Stop deployment for affected target, add migration compatibility tests, provide manual migration repair SQL |
| Bundle drift | HIGH | Restore source, regenerate all bundles, produce checksums/provenance, avoid manual dist patching |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Distribution-only implementation risk | Phase 0/1: source and build provenance | `backend/src/**`, frontend source, build scripts, lockfile, and tests are present or upstream-linked before feature work |
| URL-only bearer sharing | Phase 1: threat model; Phase 2: token/code primitives | Creation API always produces separate access code by default; database stores only token hash |
| Token/code leakage | Phase 1: logging/header policy; Phase 4/5: recipient API/UI | Tests assert redacted logs and no-store/no-referrer headers |
| Raw TOTP seed exposure | Phase 1: disclosure model; Phase 4: recipient DTO | Snapshot tests prove default response omits raw seed and only exposes current OTP if chosen |
| Broken object/property authorization | Phase 2: repository boundaries; Phase 3/4: APIs | Tests cover wrong owner, deleted item, modified item ID, and response allowlist |
| Expiry/revocation/view limit bypass | Phase 2: schema; Phase 4: access flow | Repository tests cover expired, revoked, max-view, concurrent access, and deleted vault row |
| Brute-forceable access code | Phase 2: limiter; Phase 4: verification | Failed attempts lock out or delay; rate-limit storage failure blocks access |
| Misleading revocation | Phase 5: owner UX | UI copy and owner history distinguish future link access from already copied credentials |
| Unsafe URL construction | Phase 3: share creation | Tests cover spoofed Host header and configured public origin |
| CORS/CSRF route confusion | Phase 2: route architecture; Phase 3/4 APIs | Owner mutations require CSRF; public routes do not escalate with owner cookies; CORS is specific |
| Cross-platform schema drift | Phase 6: compatibility test/deploy hardening | Same share repository contract passes on supported database engines or unsupported engines are explicitly excluded |

## Sources

- OWASP Forgot Password Cheat Sheet, token guidance: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html (HIGH)
- OWASP Session Management Cheat Sheet, URL/session leakage, no-store, logging guidance: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html (HIGH)
- OWASP REST Security Cheat Sheet, sensitive data in URLs and cache-control: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html (HIGH)
- OWASP Logging Cheat Sheet, sensitive data to exclude from logs: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html (HIGH)
- OWASP IDOR Prevention Cheat Sheet, object authorization failure mode: https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html (HIGH)
- OWASP Unvalidated Redirects and Forwards Cheat Sheet, phishing and redirect risks: https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html (HIGH)
- NIST SP 800-63B Revision 4, random values, replay resistance, throttling, and look-up secret handling: https://pages.nist.gov/800-63-4/sp800-63b.html (HIGH)
- Bitwarden Send lifespan, privacy, creation, and encryption docs: https://bitwarden.com/help/send-lifespan/ , https://bitwarden.com/help/send-privacy/ , https://bitwarden.com/help/create-send/ , https://bitwarden.com/help/send-encryption/ (MEDIUM/HIGH for product patterns)
- 1Password item sharing support docs: https://support.1password.com/share-items/ (MEDIUM/HIGH for product patterns)
- Local project context: `.planning/PROJECT.md`, `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md` (HIGH for codebase constraints)

---
*Pitfalls research for: secure single-account HTTP share links in NodeAuth*
*Researched: 2026-05-02*
