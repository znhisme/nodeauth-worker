# NodeAuth Account Share Links

## What This Is

NodeAuth is an existing high-security, lightweight 2FA/TOTP and vault management tool for users who self-host on Cloudflare Workers, Docker, or Netlify. This milestone adds an API-backed way to share one specific account/vault item through an HTTP link so the owner can safely let a friend log in with that account when needed.

The feature must fit NodeAuth's security posture: link sharing should be convenient, but not turn a protected vault item into an uncontrolled public secret.

## Core Value

A NodeAuth user can create a safe, revocable HTTP link for one account item and a friend can use that link to access only that shared account's login details.

## Requirements

### Validated

- ✓ Users can run NodeAuth as a bundled SPA plus Hono API on Cloudflare Workers, Docker, or Netlify — existing
- ✓ Users can authenticate through the existing auth/session system before accessing protected API routes — existing
- ✓ Users can store and retrieve vault/account data through the existing vault feature and database repository layer — existing
- ✓ Users can manage high-security TOTP/vault workflows in the existing frontend distribution — existing
- ✓ The backend already uses structured route modules, shared repositories, centralized error handling, and environment health gates — existing

### Active

- [ ] User can create an HTTP share link for exactly one account/vault item they own.
- [ ] User can set basic link safety controls, including expiration and revocation.
- [ ] Friend can open the share link and access only the shared account details needed to log in.
- [ ] Shared access requires an independent access code by default, so a leaked URL alone is not enough.
- [ ] User can list, inspect, and revoke active share links for their account items.
- [ ] Shared-link API responses avoid exposing unrelated vault data, owner session data, or administrative metadata.
- [ ] The feature works across the existing Cloudflare Worker, Docker, and Netlify API deployment targets.

### Out of Scope

- Sharing the entire vault — the requested feature is single-account sharing, and whole-vault sharing would have a much larger blast radius.
- Requiring the friend to create a NodeAuth account — the stated use case is quick sharing to a friend through an HTTP link.
- Collaborative editing by recipients — recipients should be consumers of shared login data, not co-owners of vault records.
- Public searchable links or directory-style sharing — links are secret-bearing capabilities and should not be discoverable.
- Long-lived unrestricted links by default — this conflicts with NodeAuth's security-first positioning.

## Context

The current checkout is a distribution-oriented NodeAuth codebase. Backend source is represented through bundled artifacts and source maps under `backend/dist/*`, with source-map paths showing a Hono application split into `src/app`, `src/features`, and `src/shared`. The primary runtime is Cloudflare Workers with D1 and Workers Assets, while Docker and Netlify are supported alternate deployment targets.

The existing architecture already has the right places for this work: API routes mount through the Hono app, auth middleware protects session-scoped routes, vault data is accessed through shared repositories, and persistent schema is reflected in `backend/schema.sql`. The frontend source is not present in this checkout, so implementation planning must account for whether new UI can be added from available source elsewhere or whether this milestone focuses first on API support.

Phase 1 is complete: editable backend source has been restored, reproducible Worker/Docker/Netlify backend builds are available, the share-link security contract is written, durable share state exists, and below-route primitives now enforce hashed token/access-code storage, expiration, revocation, deleted-item checks, fail-closed share rate limiting, and safe audit events.

The user's framing is practical and direct: "增加api 支持单个账户可以通过http链接的方式共享，方便共享账户给朋友登录." The core workflow is account owner creates link, sends it to a friend, friend opens link, friend can log in using that one shared account's details.

## Constraints

- **Security**: Shared links expose sensitive login material, so links need high-entropy tokens, expiration, revocation, and access-code protection by default.
- **Scope**: Sharing is limited to a single account/vault item per link because the requested use case is account lending, not vault collaboration.
- **Compatibility**: The backend must continue to run on Cloudflare Workers, Docker, and Netlify; avoid platform-specific storage or crypto assumptions unless wrapped in existing abstractions.
- **Architecture**: Follow the existing Hono route, feature module, repository, and centralized error patterns described in `.planning/codebase/ARCHITECTURE.md`.
- **Distribution checkout**: Frontend and TypeScript source may be missing from this workspace; planning must verify available editable source before promising UI changes.
- **Privacy**: Shared-link responses must not leak vault lists, owner identity beyond what is necessary, session cookies, backup data, or internal IDs that are not needed by the recipient.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat this as a brownfield feature milestone for existing NodeAuth | Codebase map shows a mature existing app with auth, vault, backup, and multi-target deployment | Validated in Phase 1 |
| Default shared links to expiration plus owner revocation | Sensitive account data should not remain indefinitely accessible after casual sharing | Foundation enforced in Phase 1; API surfaced in Phase 2 |
| Require an independent access code by default | A copied URL should not be sufficient to reveal credentials if chat history or browser history leaks | Foundation enforced in Phase 1; API surfaced in Phase 2 |
| Limit v1 to one vault/account item per share link | Matches the user request and keeps the blast radius understandable | Foundation enforced in Phase 1 |
| Build API support first, then add UI if editable frontend source is available | The checkout contains frontend build output but not obvious frontend source | API-only Phase 1 validated; Phase 2 continues API work |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check -> still the right priority?
3. Audit Out of Scope -> reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-02 after Phase 1 completion*
