# Roadmap: NodeAuth Account Share Links

## Overview

This milestone adds safe single-account HTTP share links to the existing NodeAuth backend without weakening the vault's security posture. Work starts by restoring or confirming source/build provenance and locking the security contract, then builds share state and primitives, owner control APIs, public recipient APIs, cleanup/UX safeguards, and cross-target hardening for Cloudflare Workers, Docker, and Netlify.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Source, Build, and Security Contract** - Maintainer has editable sources, reproducible backend outputs, and the share-link threat model before implementation starts.
- [ ] **Phase 2: Share State and Security Primitives** - System can store and evaluate share lifecycle state without plaintext token/code storage or fail-open public access controls.
- [ ] **Phase 3: Owner Share Management API** - Authenticated owners can create, list, inspect, and revoke one-item share links with safe metadata.
- [ ] **Phase 4: Public Recipient Access API** - Friends can use a token plus independent access code to retrieve only the shared account login view.
- [ ] **Phase 5: Cleanup and UX Contract Safeguards** - Expired share state is maintained and API/project notes set accurate owner expectations for future UI.
- [ ] **Phase 6: Compatibility and Security Hardening** - Share-link behavior is verified against supported runtimes, attack paths, and existing NodeAuth regressions.

## Phase Details

### Phase 1: Source, Build, and Security Contract
**Goal**: Maintainer can safely implement share links from source with a written security contract and explicit UI scope.
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, UX-04
**Success Criteria** (what must be TRUE):
  1. Maintainer can point to editable backend source, schema source, build scripts, and tests used for share-link work.
  2. Maintainer can run or document one reproducible build path that produces Cloudflare Worker, Docker, and Netlify backend outputs.
  3. Maintainer has a written security contract covering token/code handling, expiration, revocation, TOTP disclosure, logging, cache/referrer protections, and canonical public origin.
  4. Maintainer knows whether v1 includes editable frontend UI work or remains API-only, with owner and recipient UI surfaces identified if source is available.
**Plans**: TBD
**UI hint**: yes

### Phase 2: Share State and Security Primitives
**Goal**: System can represent share links and enforce lifecycle/security rules below the route layer.
**Depends on**: Phase 1
**Requirements**: STATE-01, STATE-02, STATE-03, STATE-04, STATE-05
**Success Criteria** (what must be TRUE):
  1. System can persist each share link for exactly one owner-accessible vault/account item.
  2. Raw share URL tokens and access codes are visible only at creation time and are stored afterward only as hashes or derived values.
  3. Expired, revoked, deleted-item, and inaccessible shares are rejected by server-side service/repository logic before credential data is returned.
  4. Share creation, successful access, failed access threshold, expiration, and revocation produce audit events without secret-bearing values.
  5. Public token/code access is protected by share-specific rate limiting that fails closed when enforcement is unavailable.
**Plans**: TBD

### Phase 3: Owner Share Management API
**Goal**: Authenticated owners can manage safe, revocable share links for their own account items.
**Depends on**: Phase 2
**Requirements**: OWN-01, OWN-02, OWN-03, OWN-04, OWN-05, OWN-06, OWN-07, UX-02
**Success Criteria** (what must be TRUE):
  1. Owner can create a share link for exactly one vault/account item they are allowed to access, with required bounded expiration and access code by default.
  2. Owner receives the raw share URL token and access code exactly once at creation.
  3. Owner can list and inspect shares using safe status metadata such as item reference, active/expired/revoked state, created time, expiration, last accessed time, and access count.
  4. Owner can revoke a share link and future public recipient access immediately stops.
  5. Owner APIs enforce existing auth, session, CSRF, and ownership protections and cannot manage another owner's item or share.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Public Recipient Access API
**Goal**: Friends can access only the shared account details needed to log in, without having a NodeAuth account.
**Depends on**: Phase 3
**Requirements**: REC-01, REC-02, REC-03, REC-04, REC-05, REC-06
**Success Criteria** (what must be TRUE):
  1. Friend can open a public HTTP share link without an authenticated NodeAuth session.
  2. Friend must provide the independent access code through a non-URL request channel before shared credentials are returned.
  3. Friend receives only a minimal `SharedItemView` for the shared item, never unrelated vault data, owner session data, backup/admin metadata, raw internal IDs, raw share tokens, or access-code hashes.
  4. Friend receives the current TOTP code and countdown when the shared item has TOTP data, while raw TOTP seed disclosure is unsupported by default.
  5. Public endpoints use generic inaccessible-share errors and no-store/no-referrer protections across missing, invalid, expired, revoked, deleted, locked, and wrong-code states.
**Plans**: TBD

### Phase 5: Cleanup and UX Contract Safeguards
**Goal**: System keeps stale share state under control and communicates revocation semantics accurately.
**Depends on**: Phase 4
**Requirements**: UX-01, UX-03
**Success Criteria** (what must be TRUE):
  1. System can clean up or mark expired shares through scheduled or opportunistic backend work.
  2. System can clean up stale share rate-limit state so public access protection does not grow indefinitely.
  3. API contract and project notes clearly tell owners that revocation stops future link access but cannot retract credentials already copied by a recipient.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Compatibility and Security Hardening
**Goal**: Share links are tested across supported deployment paths and high-risk security scenarios without regressing existing NodeAuth behavior.
**Depends on**: Phase 5
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04
**Success Criteria** (what must be TRUE):
  1. Share-link schema, repository, and route behavior pass against the supported database/runtime paths available in this checkout.
  2. Tests cover expired, revoked, wrong-code, locked/rate-limited, deleted-item, wrong-owner, and token-enumeration scenarios.
  3. Tests verify public response allowlists, secure headers, generic public errors, and log redaction for share routes.
  4. Existing auth, vault, backup, health, and deployment behavior continues to work after share-link API support is added.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Source, Build, and Security Contract | 0/TBD | Not started | - |
| 2. Share State and Security Primitives | 0/TBD | Not started | - |
| 3. Owner Share Management API | 0/TBD | Not started | - |
| 4. Public Recipient Access API | 0/TBD | Not started | - |
| 5. Cleanup and UX Contract Safeguards | 0/TBD | Not started | - |
| 6. Compatibility and Security Hardening | 0/TBD | Not started | - |

## Requirement Coverage

| Requirement | Phase |
|-------------|-------|
| FND-01 | Phase 1 |
| FND-02 | Phase 1 |
| FND-03 | Phase 1 |
| STATE-01 | Phase 2 |
| STATE-02 | Phase 2 |
| STATE-03 | Phase 2 |
| STATE-04 | Phase 2 |
| STATE-05 | Phase 2 |
| OWN-01 | Phase 3 |
| OWN-02 | Phase 3 |
| OWN-03 | Phase 3 |
| OWN-04 | Phase 3 |
| OWN-05 | Phase 3 |
| OWN-06 | Phase 3 |
| OWN-07 | Phase 3 |
| REC-01 | Phase 4 |
| REC-02 | Phase 4 |
| REC-03 | Phase 4 |
| REC-04 | Phase 4 |
| REC-05 | Phase 4 |
| REC-06 | Phase 4 |
| UX-01 | Phase 5 |
| UX-02 | Phase 3 |
| UX-03 | Phase 5 |
| UX-04 | Phase 1 |
| HARD-01 | Phase 6 |
| HARD-02 | Phase 6 |
| HARD-03 | Phase 6 |
| HARD-04 | Phase 6 |

**Coverage:** 29/29 v1 requirements mapped.

---
*Roadmap created: 2026-05-02*
