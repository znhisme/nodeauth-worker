# Roadmap: NodeAuth Account Share Links

## Overview

This milestone adds safe single-account HTTP share links to the existing NodeAuth backend without weakening the vault's security posture. The work is intentionally treated as one feature delivered in three stages: first establish the source/build path and security foundation, then implement the owner and recipient APIs, then clean up, document the UX contract, and harden compatibility/security behavior.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation and Security Primitives** - Maintainer has editable sources, reproducible builds, a share-link security contract, and durable secure share state.
- [x] **Phase 2: Share Link API** - Owners can create/manage one-item share links and friends can access the shared account through token plus access code.
- [x] **Phase 3: Cleanup, Compatibility, and Hardening** - Expired share state is maintained, UX semantics are clear, and security/runtime regressions are covered.
- [x] **Phase 4: 新增UI功能改动，左侧菜单界面新增管理分享页面，点击后可以管理有分享的账户，每个账户只能有一条有效分享。以最新的为准，点击分享账户获取新链接后，旧的自动过期，同时把1，2讨论的功能全部实现到该页面上，并在我的账户界面，支持全选，分组全选的时候在删除按钮和取消按钮中间新增一个分享按钮，支持批量分享** - UI share management and batch sharing workflow backend/source gate is complete.

## Phase Details

### Phase 1: Foundation and Security Primitives
**Goal**: Maintainer can safely implement share links from source, with durable share state and security primitives below the route layer.
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, STATE-01, STATE-02, STATE-03, STATE-04, STATE-05, UX-04
**Success Criteria** (what must be TRUE):
  1. Maintainer can point to editable backend source, schema source, build scripts, and tests used for share-link work.
  2. Maintainer can run or document one reproducible build path that produces Cloudflare Worker, Docker, and Netlify backend outputs.
  3. Maintainer has a written security contract covering token/code handling, expiration, revocation, TOTP disclosure, logging, cache/referrer protections, canonical public origin, and UI/API-only scope.
  4. System can persist each share link for exactly one owner-accessible vault/account item while storing raw share URL tokens and access codes only as hashes or derived values after creation.
  5. Expiration, revocation, deleted-item checks, audit events, and fail-closed share-specific rate limiting are enforced in service/repository logic before route behavior depends on them.
**Plans**: 7 plans
Plans:
- [x] 01-01-PLAN.md — Restore editable backend source, provenance, backend lockfile, and reproducible target build scripts.
- [x] 01-02-PLAN.md — Define share-link security contract, domain types, and token/access-code security primitives.
- [x] 01-03-PLAN.md — Add durable share schema, repository/service enforcement, audit, and fail-closed rate limiting.
- [x] 01-04-PLAN.md — Run blocking schema/migration/test/build alignment validation across backend targets.
- [x] 01-05-PLAN.md — Close source-level security gaps for raw-token rate limiting, public decisions, headers, and revocation semantics.
- [x] 01-06-PLAN.md — Regenerate backend bundles and run source-map, full test, and schema alignment validation.
- [x] 01-07-PLAN.md — Close remaining STATE-04 audit gaps for successful access, expiration, and threshold denial.
**UI hint**: yes

### Phase 2: Share Link API
**Goal**: Authenticated owners can manage safe, revocable links and friends can retrieve only the shared account login view without a NodeAuth account.
**Depends on**: Phase 1
**Requirements**: OWN-01, OWN-02, OWN-03, OWN-04, OWN-05, OWN-06, OWN-07, REC-01, REC-02, REC-03, REC-04, REC-05, REC-06, UX-02
**Success Criteria** (what must be TRUE):
  1. Owner can create a share link for exactly one vault/account item they are allowed to access, with required bounded expiration and access code by default.
  2. Owner receives the raw share URL token and access code exactly once, then can list, inspect, and revoke shares using safe metadata only.
  3. Owner APIs enforce existing auth, session, CSRF, and ownership protections and cannot manage another owner's item or share.
  4. Friend can open a public HTTP share link without an authenticated NodeAuth session and must provide the independent access code through a non-URL request channel.
  5. Friend receives only a minimal `SharedItemView`, including current TOTP code/countdown when available, with generic inaccessible-share errors and no-store/no-referrer protections.
**Plans**: 6 plans
Plans:
- [x] 02-01-PLAN.md — Add owner-safe share DTOs, owner-scoped repository/service metadata, and recipient OTP SharedItemView generation.
- [x] 02-02-PLAN.md — Add authenticated owner share APIs and unauthenticated public recipient access endpoint.
- [x] 02-03-PLAN.md — Mount `/api/share` in the root app and redact public share tokens from request logs.
- [x] 02-04-PLAN.md — Regenerate and validate Worker, Docker, and Netlify backend bundles from source.
- [x] 02-05-PLAN.md — Close source security gaps for credentialed CORS and access-code-first public share access.
- [x] 02-06-PLAN.md — Regenerate Worker, Docker, and Netlify backend bundles with the gap fixes.
**UI hint**: yes

### Phase 3: Cleanup, Compatibility, and Hardening
**Goal**: Share links remain maintainable across supported deployments and high-risk security scenarios without misleading owners or regressing NodeAuth behavior.
**Depends on**: Phase 2
**Requirements**: UX-01, UX-03, HARD-01, HARD-02, HARD-03, HARD-04
**Success Criteria** (what must be TRUE):
  1. System can clean up or mark expired shares and stale share rate-limit state through scheduled or opportunistic backend work.
  2. API contract and project notes clearly tell owners that revocation stops future link access but cannot retract credentials already copied by a recipient.
  3. Share-link schema, repository, and route behavior pass against the supported database/runtime paths available in this checkout.
  4. Tests cover expired, revoked, wrong-code, locked/rate-limited, deleted-item, wrong-owner, token-enumeration, response allowlist, secure header, generic error, and log redaction scenarios.
  5. Existing auth, vault, backup, health, and deployment behavior continues to work after share-link API support is added.
**Plans**: 11 plans
Plans:
- [x] 03-01-PLAN.md — Add source-level expired-share and stale-limiter cleanup primitives.
- [x] 03-02-PLAN.md — Wire cleanup into Worker, Docker, and Netlify runtime paths.
- [x] 03-03-PLAN.md — Document and expose truthful revocation limitation semantics.
- [x] 03-04-PLAN.md — Fix MySQL share migration compatibility and run blocking schema/build validation.
- [x] 03-05-PLAN.md — Expand public share security and privacy hardening tests.
- [x] 03-06-PLAN.md — Run final regression gates and regenerate backend runtime bundles.
- [x] 03-07-PLAN.md — Close public share rate-limit compatibility gap for Docker and Netlify client identifiers.
- [x] 03-08-PLAN.md — Widen MySQL share rate-limit identifiers and reject non-finite create input.
- [x] 03-09-PLAN.md — Emit revocation audit events and regenerate backend bundles.
- [x] 03-10-PLAN.md — Widen MySQL share/audit IDs and make baseline share DDL MySQL-safe.
- [x] 03-11-PLAN.md — Regenerate backend bundles and run final MySQL share schema validation gates.
**UI hint**: yes

### Phase 4: 新增UI功能改动，左侧菜单界面新增管理分享页面，点击后可以管理有分享的账户，每个账户只能有一条有效分享。以最新的为准，点击分享账户获取新链接后，旧的自动过期，同时把1，2讨论的功能全部实现到该页面上，并在我的账户界面，支持全选，分组全选的时候在删除按钮和取消按钮中间新增一个分享按钮，支持批量分享

**Goal:** Owners can manage single-account share links from a maintainable UI path when editable frontend source is restored, while backend source now guarantees latest-share-wins and owner-safe batch sharing semantics for that UI.
**Requirements**: PH4-BE-01, PH4-BE-02, PH4-BUILD-01, PH4-UI-01, PH4-UI-02, PH4-SEC-01
**Depends on:** Phase 3
**Plans:** 3 plans

Plans:
- [x] 04-01-PLAN.md — Enforce backend latest-share-wins for owner account shares.
- [x] 04-02-PLAN.md — Add owner-safe batch share API semantics and privacy-allowlisted partial failures.
- [x] 04-03-PLAN.md — Regenerate backend runtime bundles and create the frontend source gate for Manage Shares UI work.
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Security Primitives | 7/7 | Complete | 2026-05-02 |
| 2. Share Link API | 6/6 | Complete | 2026-05-02 |
| 3. Cleanup, Compatibility, and Hardening | 11/11 | Complete | 2026-05-03 |
| 4. 新增UI功能改动，左侧菜单界面新增管理分享页面，点击后可以管理有分享的账户，每个账户只能有一条有效分享。以最新的为准，点击分享账户获取新链接后，旧的自动过期，同时把1，2讨论的功能全部实现到该页面上，并在我的账户界面，支持全选，分组全选的时候在删除按钮和取消按钮中间新增一个分享按钮，支持批量分享 | 3/3 | Complete | 2026-05-04 |

## Requirement Coverage

| Requirement | Phase |
|-------------|-------|
| FND-01 | Phase 1 |
| FND-02 | Phase 1 |
| FND-03 | Phase 1 |
| STATE-01 | Phase 1 |
| STATE-02 | Phase 1 |
| STATE-03 | Phase 1 |
| STATE-04 | Phase 1 |
| STATE-05 | Phase 1 |
| OWN-01 | Phase 2 |
| OWN-02 | Phase 2 |
| OWN-03 | Phase 2 |
| OWN-04 | Phase 2 |
| OWN-05 | Phase 2 |
| OWN-06 | Phase 2 |
| OWN-07 | Phase 2 |
| REC-01 | Phase 2 |
| REC-02 | Phase 2 |
| REC-03 | Phase 2 |
| REC-04 | Phase 2 |
| REC-05 | Phase 2 |
| REC-06 | Phase 2 |
| UX-01 | Phase 3 |
| UX-02 | Phase 2 |
| UX-03 | Phase 3 |
| UX-04 | Phase 1 |
| HARD-01 | Phase 3 |
| HARD-02 | Phase 3 |
| HARD-03 | Phase 3 |
| HARD-04 | Phase 3 |

**Coverage:** 29/29 v1 requirements mapped.

*Roadmap revised: 2026-05-02 after consolidating the feature into 3 phases*
