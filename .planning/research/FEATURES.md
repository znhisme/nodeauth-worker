# Feature Research

**Domain:** Secure one-item HTTP share links for a password/TOTP vault app
**Researched:** 2026-05-02
**Confidence:** HIGH for table-stakes behavior, MEDIUM for differentiators and prioritization

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unsafe.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create a link for exactly one vault item | The stated milestone is single-account sharing, and major products distinguish single-item sharing from vault/folder sharing. | MEDIUM | API should require an authenticated owner session, validate ownership/access to the vault row, and persist one share record scoped to one item ID. Do not overload vault export/import paths. |
| Recipient can open the link without a NodeAuth account | The use case is sharing with a friend quickly; 1Password, Keeper, Proton Pass, and Bitwarden all support external recipients without requiring the recipient to join the vault product. | MEDIUM | Public read endpoint must bypass owner auth but only after share-token and access-code checks. Response must contain only the shared item payload needed to log in. |
| High-entropy unguessable share token | Secret links are bearer capabilities. OWASP guidance for URL tokens emphasizes cryptographic randomness, sufficient length, secure storage, single use where appropriate, and expiration. | MEDIUM | Store only a hash of the token server-side. Generate with Web Crypto/Node crypto through an existing shared crypto abstraction. Avoid short IDs, sequential IDs, or exposing database IDs. |
| Independent access code required by default | PROJECT.md requires leaked URL alone not to be sufficient, and Bitwarden documents Send passwords as protection for unintended recipients. | MEDIUM | Generate a short human-transmittable code or require owner-specified passphrase. Store only a KDF/hash, rate-limit attempts, and return consistent invalid/expired responses. Share URL and access code should be safe to transmit through different channels. |
| Expiration timestamp | Expiring links are standard in 1Password, Bitwarden, Keeper, and Proton Pass. Long-lived unrestricted links conflict with NodeAuth's security posture. | LOW | v1 should require expiration with conservative presets such as 1 hour, 24 hours, 7 days, 14 days, 30 days. Enforce a hard maximum, not just a UI default. |
| Owner revocation | Users expect control after sending a link. 1Password, Keeper, and Proton Pass all expose remove/revoke behavior for active links. | MEDIUM | Add authenticated endpoint to revoke a share by ID. Revocation must make the public endpoint fail immediately even if the URL and access code are still known. |
| List and inspect active links | PROJECT.md requires users to list, inspect, and revoke active links. Competitors expose shared-link history or dashboards with expiration/access details. | MEDIUM | Include item reference, created time, expiration, revoked status, last accessed time, access count, and safe recipient label if present. Never return raw token or access code after creation. |
| Public response minimizes data exposure | Share endpoints handle passwords/TOTP secrets and must not leak unrelated vault data, owner session state, internal IDs, backup config, or admin metadata. | MEDIUM | Define an explicit DTO for shared item response. Include service/account/login URL/password/TOTP info only if relevant to "friend can log in"; omit categories, sort order, sync metadata, deleted flags, creator/updater IDs, backup fields, and owner identity by default. |
| TOTP usability for shared accounts | NodeAuth is a TOTP/vault app, so a friend may need the current OTP code as well as username/password. | MEDIUM | Prefer returning a generated current OTP code and countdown rather than exposing the raw TOTP seed by default. This reduces downstream copying while still supporting the login use case. Raw seed sharing should be an explicit opt-in, if supported at all. |
| Access attempt rate limiting | Public share endpoints and access-code checks are brute-force targets. OWASP API guidance flags missing rate limiting as a common API risk. | MEDIUM | Apply per-share, per-IP/fingerprint, and global limits. Existing codebase has rate-limit infrastructure but also a known fail-open concern, so sharing endpoints should fail closed or use defensive local checks. |
| Audit events for create/access/failure/revoke | Sensitive sharing without visibility makes incident response impossible. Keeper and Proton describe activity/details for shared links. | MEDIUM | Record created, viewed, access-code failure threshold, expired, revoked, and deleted events. Do not log passwords, TOTP seeds, raw tokens, access codes, or full share URLs. |
| Safe handling of URL secrets | URLs can leak through browser history, logs, and referrers. Bitwarden and Proton use URL fragments so decryption keys are not sent to servers; OWASP warns against sensitive query parameters. | HIGH | For NodeAuth's server-decrypted model, keep the server token in the path but avoid query-string secrets, set `Referrer-Policy: no-referrer`, disable caching, avoid third-party assets on the share page, and redact share paths in logs where feasible. If frontend can participate, put optional decryption/access material in the fragment. |
| Consistent expired/revoked/not-found errors | Public endpoints should not reveal whether a token was valid, expired, revoked, or mistyped in ways that aid enumeration. | LOW | Use a generic public error envelope for inaccessible shares. Owner authenticated list/details can expose exact status. |
| Multi-deployment compatibility | PROJECT.md requires Cloudflare Workers, Docker, and Netlify compatibility. | MEDIUM | Schema, crypto, rate limits, and cleanup must work across D1/SQLite/MySQL/PostgreSQL paths or be wrapped behind existing repository abstractions. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required for a secure v1, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| TOTP-code-only sharing mode | Lets a friend finish a login challenge without revealing the long-lived TOTP seed. This fits NodeAuth better than generic password-manager sharing. | MEDIUM | Share response can include username/password plus current OTP, or OTP-only if the friend already has the password. Requires careful countdown and refresh behavior. |
| One-view or limited-view links | 1Password Business, Proton Pass, and Bitwarden support one-time or access-count controls. For account lending, limiting views reduces accidental reuse. | MEDIUM | Track successful views atomically. Decide whether wrong access-code attempts count separately. For TOTP refreshes, count the initial unlock as the view and allow bounded refresh within a short session. |
| Device-bound or session-bound share access | Keeper markets device-bound one-time sharing. Binding reduces risk when the recipient forwards the link. | HIGH | Implement after basic links. Could create a short-lived recipient share session after first successful access, tied to token, access code, UA hints, and optional client key. Avoid brittle IP-only binding. |
| Share access session with short OTP refresh window | Allows friend to complete login without re-entering access code every 30 seconds, while still expiring quickly. | MEDIUM | After code verification, issue a share-session cookie scoped only to `/share/*` with 5-10 minute TTL. Do not grant owner API access. |
| Copy-safe reveal controls | Prevents shoulder-surfing and accidental screen exposure, matching Bitwarden's hidden text/password behavior. | LOW | Public response/page can hide password/TOTP until explicit reveal and support copy buttons. API can expose field metadata for future UI. |
| Owner-selected field scope | Owner may want to share only username/password, only TOTP, or full login details. | MEDIUM | Add field-scope flags to the share record. v1 can default to login essentials and exclude raw TOTP seed; advanced scopes can follow once DTOs are stable. |
| Recipient label without identity requirement | Helps owners remember "Netflix for Sam" without forcing email verification or accounts. | LOW | Store an owner-visible label. Do not expose label publicly unless it is safe copy. |
| Access notifications | Gives the owner confidence that the friend used the link and helps detect unexpected access. | MEDIUM | Can start as audit history only, then optional Telegram/email hooks if existing notification providers are reliable. |
| Auto-revoke after successful first unlock | Useful for "let a friend log in once" workflows where continued access is not needed. | MEDIUM | Different from one-view if TOTP refresh is needed. Revoke after first unlock session expires, not immediately after first GET. |
| Privacy-preserving owner identity | Friend can verify "this came from the person who sent it" without exposing owner's account email by default. | MEDIUM | Use optional owner-provided display name/message or a safety warning. Bitwarden notes hidden sender identity can reduce context, so include recipient-side warning when identity is hidden. |
| Link health/status endpoint for owner UI | Enables a future frontend to show active/expired/revoked counts and cleanup actions. | LOW | API-only milestone can still include clean list/detail responses so UI work is straightforward later. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Whole-vault share links | Convenient for families or teams. | Explicitly out of scope and increases blast radius from one credential to every credential. | Keep v1 strictly one vault item per link. Later evaluate proper account-based vault sharing separately. |
| Friend must create a NodeAuth account | Easier to reuse owner-auth middleware and permissions. | Conflicts with the quick friend-sharing use case and adds onboarding friction. | Public recipient flow with link token plus independent access code. |
| Collaborative editing by recipient | Some competitors offer two-way sharing. | Dangerous for account lending; recipient could alter credentials, TOTP seeds, or metadata in the owner's vault. | View/copy-only recipient access. Any two-way flow should be a separate, heavily scoped future feature. |
| Never-expiring links | Reduces need to recreate links. | Creates uncontrolled public secrets in chat/browser history and conflicts with security-first positioning. | Require expiration with a hard maximum and allow owner to create a new link when needed. |
| URL-only security with no access code | Fastest recipient flow. | A leaked URL from chat, browser history, logs, screenshots, or referrers reveals credentials. | Require access code by default; allow disabling only behind an explicit unsafe option if ever needed. |
| Expose raw TOTP seed by default | Lets recipient set up their own authenticator. | Turns a temporary login assist into long-lived second-factor possession. | Return generated OTP codes and countdown by default; raw seed sharing requires explicit owner opt-in or remains unsupported. |
| Return full vault row through public endpoint | Fast implementation. | Leaks internal metadata and creates accidental API contract coupling to vault storage. | Define a separate `SharedItemView` DTO and whitelist fields. |
| Reuse normal authenticated vault routes for public access | Avoids creating new route layer. | Risks accidentally granting broader vault access or session privileges to link recipients. | Create isolated public share routes with their own middleware, DTOs, rate limits, and logging policy. |
| Allow editing existing item through share link | Useful when recipient must update a password after logging in. | Recipient becomes an untrusted co-owner; changes may lock out the owner or corrupt encrypted data. | Ask friend to send new password through a separate channel, or add a future "secure reply" feature that does not auto-write to vault. |
| Self-destruct the original vault item | Sounds high-security and Keeper has a related enterprise feature. | For account lending, deleting the owner record is surprising and high-risk. | Auto-revoke the share link only. Never delete the underlying vault item from this feature. |
| Public searchable/share directory | Easier discovery of links. | Share links are secret-bearing capabilities and must not be discoverable. | Owner-only list endpoint, no public index, no search by item/account. |
| Password/TOTP data in query parameters | Easy to implement and inspect. | Sensitive query strings leak into logs, browser history, proxies, analytics, and referrers. | Use path token for lookup, body/header for access code, fragments for client-only material where possible, and no-cache/no-referrer headers. |

## Feature Dependencies

```
Authenticated owner session
    └──requires──> Existing auth/session middleware

Create one-item share link
    ├──requires──> Vault item ownership/access validation
    ├──requires──> Share-link persistence schema/repository
    ├──requires──> High-entropy token generation and hashed token storage
    ├──requires──> Required expiration policy
    └──requires──> Access-code generation/hash policy

Recipient open share link
    ├──requires──> Public share lookup by token hash
    ├──requires──> Expiration/revocation/status checks
    ├──requires──> Access-code verification
    ├──requires──> Public endpoint rate limiting
    └──requires──> Minimal SharedItemView DTO
                        └──requires──> Vault decrypt/read service
                        └──requires──> TOTP code generation if item has TOTP

Owner list/manage links
    ├──requires──> Share-link persistence schema/repository
    ├──requires──> Authenticated owner session
    └──enhances──> Audit events

Limited-view links
    └──requires──> Atomic successful-access counting
           └──requires──> Share-link persistence schema/repository

Share access session
    ├──requires──> Successful access-code verification
    ├──requires──> Isolated public share-session cookie
    └──enhances──> TOTP refresh usability

Device-bound access
    ├──requires──> Share access session
    ├──requires──> Recipient client binding material
    └──conflicts──> Multi-device recipient convenience

Raw TOTP seed sharing
    └──conflicts──> TOTP-code-only least-disclosure mode
```

### Dependency Notes

- **Create one-item share link requires vault item ownership/access validation:** Without this, any authenticated user could potentially create a share for another user's item in deployments that evolve beyond a single-user vault model.
- **Create one-item share link requires dedicated persistence:** Expiration, revocation, token hash, access-code hash, access count, and audit state do not belong in the vault item row.
- **Recipient open share link requires a separate DTO:** Public access must not reuse internal vault responses because those carry unrelated metadata and may change for owner workflows.
- **TOTP usability requires vault decrypt/read service:** If the vault item stores an encrypted TOTP secret, the share endpoint must decrypt enough to produce an OTP code, but should avoid returning the seed by default.
- **Limited-view links require atomic access counting:** Race conditions can allow multiple opens against a one-view link unless the database update checks current count/status in one operation.
- **Share access session enhances TOTP refresh usability:** TOTP codes rotate, so recipients need a short bounded way to refresh the code without turning the link into an owner session.
- **Device-bound access conflicts with multi-device convenience:** Binding is a differentiator but can frustrate recipients who open on the wrong device first; defer until base behavior is stable.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the concept.

- [ ] Create share link for exactly one owner-accessible vault item -- core milestone requirement.
- [ ] Require expiration with hard maximum -- prevents indefinite credential exposure.
- [ ] Require independent access code by default -- URL leakage alone should not disclose credentials.
- [ ] Public recipient endpoint with no account requirement -- matches friend-sharing use case.
- [ ] Minimal shared-item response DTO -- avoids unrelated vault/session/admin data leaks.
- [ ] Include generated current TOTP code when the item has TOTP -- lets the friend actually log in.
- [ ] Owner list/detail/revoke endpoints -- required control plane for active links.
- [ ] Rate limiting and generic public errors -- protects access-code/token endpoints from brute force and enumeration.
- [ ] Audit records for create, successful access, failed access threshold, expiry, and revocation -- supports incident review without logging secrets.

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Limited-view or one-view links -- add once access counting can be implemented atomically across supported databases.
- [ ] Short share access session for OTP refresh -- add if user testing shows repeated access-code entry is awkward during login.
- [ ] Field-scope controls -- add after the initial DTO is stable and users ask for password-only or OTP-only sharing.
- [ ] Copy-safe reveal controls for public UI -- add when editable frontend source is available or share page implementation begins.
- [ ] Access notifications -- add after audit events are reliable and existing notification providers are understood.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Device-bound access -- high security value but high edge-case complexity.
- [ ] Recipient email verification -- useful for teams, but adds email delivery and identity-flow complexity beyond quick friend sharing.
- [ ] Secure reply without auto-write -- useful when friend needs to return a changed password, but should not mutate vault records automatically.
- [ ] Client-side encrypted share payloads using URL fragments -- strong privacy model, but likely requires frontend source and cryptographic design work beyond an API-first milestone.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| One-item link creation | HIGH | MEDIUM | P1 |
| No-account recipient open flow | HIGH | MEDIUM | P1 |
| Required access code | HIGH | MEDIUM | P1 |
| Expiration | HIGH | LOW | P1 |
| Owner revocation | HIGH | MEDIUM | P1 |
| Minimal public DTO | HIGH | MEDIUM | P1 |
| TOTP code in shared view | HIGH | MEDIUM | P1 |
| Rate limiting | HIGH | MEDIUM | P1 |
| Owner list/inspect | MEDIUM | MEDIUM | P1 |
| Audit events | MEDIUM | MEDIUM | P1 |
| Limited-view links | MEDIUM | MEDIUM | P2 |
| Share access session | MEDIUM | MEDIUM | P2 |
| Field-scope controls | MEDIUM | MEDIUM | P2 |
| Copy-safe reveal controls | MEDIUM | LOW | P2 |
| Access notifications | MEDIUM | MEDIUM | P2 |
| Device-bound access | MEDIUM | HIGH | P3 |
| Recipient email verification | MEDIUM | HIGH | P3 |
| Secure reply | LOW | HIGH | P3 |
| Client-side encrypted share payloads | HIGH | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | 1Password | Bitwarden Send | Keeper One-Time Share | Proton Pass Secure Links | Our Approach |
|---------|-----------|----------------|-----------------------|--------------------------|--------------|
| External recipient without account | Supports anyone, with optional email verification when specific recipients are used. | Supports anyone opening a Send link. | Supports anyone without a Keeper account. | Supports anyone without Proton Pass for secure links. | P1: no NodeAuth account for friend. |
| Expiration | User chooses link expiration; Business can set max/default 1 hour to 30 days. | Supports expiration/deletion controls. | Requires time-limited shares. | Default 7 days, max 30 days. | P1: required expiration with hard max, default likely 24 hours or 7 days. |
| Access code/password | Email verification available; link can also be anyone-with-link depending policy. | Optional Send password; docs recommend separate channel. | Device-bound token model rather than separate access code emphasis. | Secure link docs emphasize URL-fragment encryption and expiration/view limits; password option was not found in official Pass secure-link docs. | P1: independent access code required by default because NodeAuth server-side share links are otherwise bearer secrets. |
| Revocation/removal | Delete active link from sharing history. | Sends can be edited/deleted. | Revoke/cancel link any time. | Remove link from secure links dashboard. | P1: owner revoke endpoint. |
| Link history/dashboard | Sharing history per item. | Send list/manage views. | Monitor/manage active shares and activity. | Secure links dashboard with expiration and views. | P1: owner list/detail endpoints. |
| Limited views / one-time use | Business policy can expire after one view. | Maximum access count available in Send setup. | Link becomes inactive after use on another device; one-time framing. | Optional view limit. | P2: limited-view after atomic counting exists. |
| Device binding | Not found as a standard item-share feature. | Not found as a standard Send feature. | Core differentiator: one device only. | Not found in official secure-link docs. | P3: valuable but defer due complexity. |
| TOTP-code-only mode | Generic item sharing. | Generic text/file sharing. | Generic record sharing. | Generic item sharing. | Differentiator: share current OTP without raw seed by default. |
| Two-way editing/reply | Shared copy; updates require new link. | Not a vault-item collaboration model. | Optional two-way sharing. | Shared item updates can remain current. | Anti-feature for v1; do not allow recipient edits. |

## Sources

- 1Password Support, "Securely share 1Password items with anyone" (published 2026, accessed 2026-05-02): https://support.1password.com/share-items/
- 1Password Support, "Manage item sharing settings in 1Password Business" (published 2026, accessed 2026-05-02): https://support.1password.com/manage-item-sharing/
- Bitwarden Help, "Send Privacy" (accessed 2026-05-02): https://bitwarden.com/help/send-privacy/
- Bitwarden Help, "Send Encryption" (accessed 2026-05-02): https://bitwarden.com/help/send-encryption/
- Keeper Documentation, "Sharing" (accessed 2026-05-02): https://docs.keeper.io/en/user-guides/sharing
- Keeper, "One-Time Share" product page (accessed 2026-05-02): https://www.keepersecurity.com/en_GB/features/one-time-share/
- Keeper Documentation, "Self-Destructing Records" (accessed 2026-05-02): https://docs.keeper.io/en/enterprise-guide/sharing/self-destructing-records
- Proton Support, "How to use secure link sharing on the Proton Pass browser extension" (accessed 2026-05-02): https://proton.me/support/secure-link-sharing-browser
- Proton Blog, "Proton Pass launches Secure Links for safe, convenient password sharing" (published 2024-07-12, accessed 2026-05-02): https://proton.me/blog/pass-secure-link-sharing
- OWASP Cheat Sheet Series, "Forgot Password Cheat Sheet" (accessed 2026-05-02): https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- OWASP API Security Top 10 2019, "API4: Lack of Resources & Rate Limiting" (accessed 2026-05-02): https://owasp.org/API-Security/editions/2019/en/0xa4-lack-of-resources-and-rate-limiting/
- OWASP Annotated ASVS 4, "8.3.1 HTTP Query string parameters do not contain sensitive data" (accessed 2026-05-02): https://owasp-aasvs4.readthedocs.io/en/latest/8.3.1.html
- Local project context: `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`

---
*Feature research for: secure one-item HTTP share links in NodeAuth*
*Researched: 2026-05-02*
