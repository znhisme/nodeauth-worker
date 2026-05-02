# Requirements: NodeAuth Account Share Links

**Defined:** 2026-05-02
**Core Value:** A NodeAuth user can create a safe, revocable HTTP link for one account item and a friend can use that link to access only that shared account's login details.

## v1 Requirements

Requirements for the first share-link milestone. Each maps to roadmap phases.

### Foundation

- [x] **FND-01**: Maintainer can identify editable backend source, schema source, build scripts, and tests needed to implement share links without hand-patching generated bundles.
- [x] **FND-02**: Maintainer can run or document a reproducible backend build path for Cloudflare Worker, Docker, and Netlify outputs before share-link API work begins.
- [x] **FND-03**: Maintainer has a written security contract covering token handling, access-code policy, expiration limits, revocation semantics, TOTP disclosure, logging, cache headers, referrer policy, and canonical public origin.

### Share State

- [x] **STATE-01**: System can persist share-link records for exactly one owner-accessible vault/account item per link.
- [x] **STATE-02**: System stores share URL tokens and access codes only as hashes or derived values, never as recoverable plaintext after creation.
- [x] **STATE-03**: System enforces required expiration, owner revocation, deleted-item checks, and inaccessible-share status in server-side repository/service logic.
- [x] **STATE-04**: System records safe audit events for share creation, successful access, failed access threshold, expiration, and revocation without logging passwords, TOTP seeds, raw tokens, access codes, or full share URLs.
- [x] **STATE-05**: System applies share-specific rate limiting for public token/code access and fails closed when that protection cannot be enforced.

### Owner API

- [ ] **OWN-01**: Authenticated owner can create a share link for one vault/account item they are allowed to access.
- [ ] **OWN-02**: Link creation requires an expiration time within the configured maximum and requires an independent access code by default.
- [ ] **OWN-03**: Link creation returns the raw share URL token and access code exactly once.
- [ ] **OWN-04**: Authenticated owner can list share links with safe metadata such as item reference, status, created time, expiration, last accessed time, and access count.
- [ ] **OWN-05**: Authenticated owner can inspect one share link without receiving raw token, raw access code, or shared credential values.
- [ ] **OWN-06**: Authenticated owner can revoke one share link, and revoked links immediately stop working for public recipients.
- [ ] **OWN-07**: Owner APIs enforce existing auth/session/CSRF/ownership protections and cannot create, read, or revoke links for another owner's vault item.

### Recipient API

- [ ] **REC-01**: Friend can open a public HTTP share link without having a NodeAuth account.
- [ ] **REC-02**: Public recipient access requires the independent access code through a request body or equivalent non-URL channel.
- [ ] **REC-03**: Public recipient access returns a minimal `SharedItemView` DTO for only the shared item and never returns unrelated vault data, owner session data, backup metadata, admin metadata, raw internal IDs, raw share tokens, or access-code hashes.
- [ ] **REC-04**: Public recipient access includes the current TOTP code and countdown when the shared item has TOTP data, while raw TOTP seed disclosure is unsupported by default.
- [ ] **REC-05**: Public recipient endpoints use generic inaccessible-share errors for missing, invalid, expired, revoked, deleted, locked, or wrong-code states.
- [ ] **REC-06**: Public recipient endpoints set no-store/no-referrer style response protections and avoid leaking sensitive values through query strings or logs.

### Cleanup And UX Contract

- [ ] **UX-01**: System can clean up or mark expired shares and stale share rate-limit state through scheduled or opportunistic backend work.
- [ ] **UX-02**: API contract exposes enough safe status information for a future owner UI to distinguish active, expired, revoked, and accessed links.
- [ ] **UX-03**: API contract and project notes clearly explain that revocation stops future link access but cannot retract credential data already copied by the recipient.
- [x] **UX-04**: If editable frontend source is available, implementation scope identifies the owner and recipient UI surfaces needed for share creation, access-code entry, reveal/copy, and revoke flows; otherwise v1 remains API-only with documented contracts.

### Compatibility And Hardening

- [ ] **HARD-01**: Share-link schema, repository, and route behavior are tested against the supported database/runtime paths available in this checkout.
- [ ] **HARD-02**: Tests cover expired, revoked, wrong-code, locked/rate-limited, deleted-item, wrong-owner, and token-enumeration scenarios.
- [ ] **HARD-03**: Tests verify public response allowlists, secure headers, generic public errors, and log redaction for share routes.
- [ ] **HARD-04**: Existing NodeAuth auth, vault, backup, health, and deployment behavior does not regress after share-link API support is added.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Sharing

- **ADV-01**: Owner can create one-view or limited-view links once atomic access-count semantics are proven across supported databases.
- **ADV-02**: Recipient can use a short-lived share access session for bounded TOTP refresh without re-entering the access code every 30 seconds.
- **ADV-03**: Owner can choose field-scope controls such as password-only, OTP-only, or full login details after the v1 DTO stabilizes.
- **ADV-04**: Owner can receive optional access notifications after audit events and notification providers are validated.
- **ADV-05**: Recipient access can be device-bound or session-bound after base sharing behavior is stable.
- **ADV-06**: Share payloads can use client-side encrypted URL-fragment material after frontend source and cryptographic design are available.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Whole-vault share links | The requested feature is single-account sharing; whole-vault sharing greatly expands the blast radius. |
| Friend account requirement | The use case is quick sharing to a friend through an HTTP link, not inviting them into NodeAuth. |
| Recipient editing or collaboration | Account lending should be view/copy-only; recipient writes could corrupt or replace owner secrets. |
| Never-expiring links | Long-lived unrestricted links conflict with NodeAuth's security-first posture. |
| URL-only sharing with no access code by default | A leaked URL from chat, browser history, logs, screenshots, or referrers would reveal credentials. |
| Raw TOTP seed disclosure by default | Sharing the seed grants long-lived second-factor possession; v1 should return current OTP codes instead. |
| Public share directory or searchable links | Share links are secret-bearing capabilities and must not be discoverable. |
| Hand-editing generated `backend/dist/**` bundles as the primary implementation | Security-sensitive behavior needs maintainable source, tests, and reproducible builds. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Complete |
| FND-02 | Phase 1 | Complete |
| FND-03 | Phase 1 | Complete |
| STATE-01 | Phase 1 | Complete |
| STATE-02 | Phase 1 | Complete |
| STATE-03 | Phase 1 | Complete |
| STATE-04 | Phase 1 | Complete |
| STATE-05 | Phase 1 | Complete |
| OWN-01 | Phase 2 | Pending |
| OWN-02 | Phase 2 | Pending |
| OWN-03 | Phase 2 | Pending |
| OWN-04 | Phase 2 | Pending |
| OWN-05 | Phase 2 | Pending |
| OWN-06 | Phase 2 | Pending |
| OWN-07 | Phase 2 | Pending |
| REC-01 | Phase 2 | Pending |
| REC-02 | Phase 2 | Pending |
| REC-03 | Phase 2 | Pending |
| REC-04 | Phase 2 | Pending |
| REC-05 | Phase 2 | Pending |
| REC-06 | Phase 2 | Pending |
| UX-01 | Phase 3 | Pending |
| UX-02 | Phase 2 | Pending |
| UX-03 | Phase 3 | Pending |
| UX-04 | Phase 1 | Complete |
| HARD-01 | Phase 3 | Pending |
| HARD-02 | Phase 3 | Pending |
| HARD-03 | Phase 3 | Pending |
| HARD-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0

---
*Requirements defined: 2026-05-02*
*Last updated: 2026-05-02 after consolidating roadmap to 3 phases*
