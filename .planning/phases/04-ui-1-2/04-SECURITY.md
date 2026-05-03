---
phase: 04-ui-1-2
slug: ui-1-2
status: blocked
threats_open: 3
asvs_level: 1
created: 2026-05-04
---

# Phase 04-ui-1-2 - Security

Per-phase security verification for the Phase 04 share-link UI/backend support work. This audit verifies only threats declared in the 04-01, 04-02, and 04-03 plan threat registers.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| owner client -> owner share service | Authenticated owner creates, replaces, lists, batches, and revokes share links. | owner identity, vault item IDs, TTL/expiration, one-time share output |
| share service -> database | Service writes share records, revocation state, audit events, and rate-limit state. | share metadata, hashed token/code, revocation/audit metadata |
| public recipient -> public share service | Recipient submits raw public token and access code to view shared account details. | raw token, access code, public response body and headers |
| source TypeScript -> generated backend bundles | Runtime bundles must carry source security behavior for Worker, Docker, and Netlify. | compiled backend route/service/repository logic |
| generated frontend assets -> maintainer edits | Generated Vite chunks are not maintainable UI source. | frontend/dist assets, source-restoration gate |
| owner UI -> browser storage/logs | Future restored-source UI must not persist one-time share secrets. | raw share URLs, tokens, access codes, credentials, OTP data |

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| 04-01/T-04-01 | Tampering | `ShareService.createShare` / `ShareRepository.revokeActiveForOwnerVaultItem` | mitigate | Revoke active owner+vault shares server-side before returning the new share; test old-token public access resolves generic inaccessible. | open |
| 04-01/T-04-02 | Information Disclosure | replacement audit metadata | mitigate | Audit metadata contains only `revokedAt` and `reason: "latest_share_wins"`; tests assert no raw token/code, hashes, password, secret, seed, or full URL. | closed |
| 04-01/T-04-04 | Information Disclosure | public recipient response for old token | mitigate | Replaced shares use the existing revoked/inaccessible public decision with no-store/no-referrer headers and no condition-specific public error. | closed |
| 04-01/T-04-05 | Tampering | frontend generated chunks | accept | Backend-only plan; UI work gated in Plan 03; no `frontend/dist` edits. | closed |
| 04-02/T-04-01 | Tampering | `createSharesForOwnerBatch` | mitigate | Delegate every successful row to `createShareForOwner`, which uses Plan 01 latest-share-wins. | open |
| 04-02/T-04-02 | Information Disclosure | batch success response | mitigate | Return raw URL/token and access code only inside success rows from creation response; list/detail endpoints remain metadata-only. | closed |
| 04-02/T-04-03 | Information Disclosure | batch partial failure response | mitigate | Failure rows contain only `requestIndex` and `error: "could_not_create_share"`; tests assert no inaccessible labels, owner IDs, internal IDs beyond success DTOs, hashes, secrets, or diagnostics. | closed |
| 04-02/T-04-05 | Tampering | frontend generated chunks | accept | Backend API only; UI execution gated in Plan 03; no `frontend/dist` edits. | closed |
| 04-03/T-04-01 | Tampering | generated backend bundles | mitigate | Build Worker, Docker, and Netlify from source and grep for latest-share-wins markers in every bundle. | open |
| 04-03/T-04-02 | Information Disclosure | restored-source UI one-time dialogs/storage | mitigate | Source gate copies UI-SPEC prohibitions for raw URL/access-code storage, logs, route/query params, IndexedDB, local storage, and service-worker cache. | closed |
| 04-03/T-04-03 | Information Disclosure | batch partial failure generated route | mitigate | Full targeted and backend tests run before builds; generated bundles must contain batch route markers. | closed |
| 04-03/T-04-04 | Information Disclosure | public recipient generated route | mitigate | Generated bundle assertions require `share_inaccessible`, `Cache-Control`, and `Referrer-Policy` markers. | closed |
| 04-03/T-04-05 | Tampering | `frontend/dist/assets/*.js` | mitigate | Create an explicit source gate and reject generated chunk patching as the primary UI implementation path. | closed |

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| 04-01/T-04-01 | Tampering | mitigate | open | Sequential revoke exists in `src/features/share/shareService.ts:89` and insertion happens later at `src/features/share/shareService.ts:114`; repository helper separately selects/updates at `src/shared/db/repositories/shareRepository.ts:62`. `04-VERIFICATION.md` records this as partial because concurrent creates can leave multiple active links. |
| 04-01/T-04-02 | Information Disclosure | mitigate | closed | Replacement audit metadata is limited to `revokedAt` and `reason` at `src/features/share/shareService.ts:100`; service tests assert forbidden raw token/code/hash/credential/URL values are omitted. |
| 04-01/T-04-04 | Information Disclosure | mitigate | closed | Revoked shares return inaccessible before vault lookup/secret processing in `src/features/share/shareService.ts:316`; route returns generic `share_inaccessible` with public headers at `src/features/share/shareRoutes.ts:106`. |
| 04-01/T-04-05 | Tampering | accept | closed | Accepted in 04-01 plan; no `frontend/dist` diff was present during verification, and Plan 03 source gate blocks generated chunk patching. |
| 04-02/T-04-01 | Tampering | mitigate | open | Batch delegates every row to `createShareForOwner` at `src/features/share/shareService.ts:185`, but this inherits the open non-atomic latest-share-wins gap from 04-01/T-04-01. |
| 04-02/T-04-02 | Information Disclosure | mitigate | closed | Batch DTOs put raw one-time fields only inside success `share` rows at `src/features/share/shareTypes.ts:95`; list/detail owner views do not include raw token/access code. |
| 04-02/T-04-03 | Information Disclosure | mitigate | closed | Failure rows are only `{ requestIndex, error: 'could_not_create_share' }` at `src/features/share/shareService.ts:195`; route tests assert forbidden fields and diagnostics are absent. |
| 04-02/T-04-05 | Tampering | accept | closed | Accepted in 04-02 plan; no `frontend/dist` diff was present during verification, and Plan 03 source gate blocks generated chunk patching. |
| 04-03/T-04-01 | Tampering | mitigate | open | Bundle markers exist in Worker, Docker, and Netlify, but those bundles contain the same non-atomic revoke-then-insert sequence: `backend/dist/worker/worker.js:7448` then `:7471`, `backend/dist/docker/server.js:7478` then `:7501`, and `backend/dist/netlify/api.mjs:7469` then `:7492`. |
| 04-03/T-04-02 | Information Disclosure | mitigate | closed | Source gate prohibits raw share URL/token/access-code storage in local storage, IndexedDB, service-worker cache, route state/query params, and logs at `04-FRONTEND-SOURCE-GATE.md:86`. |
| 04-03/T-04-03 | Information Disclosure | mitigate | closed | Batch route markers are present in all generated bundles: `createSharesForOwnerBatch` and `could_not_create_share` in Worker, Docker, and Netlify. |
| 04-03/T-04-04 | Information Disclosure | mitigate | closed | Generated bundles contain `share_inaccessible`, `Cache-Control`, and `Referrer-Policy` markers across Worker, Docker, and Netlify. |
| 04-03/T-04-05 | Tampering | mitigate | closed | Source gate status is blocked and explicitly says not to hand-edit `frontend/dist/assets/*.js` at `04-FRONTEND-SOURCE-GATE.md:13` and `04-FRONTEND-SOURCE-GATE.md:53`; no generated frontend JS diff was present. |

## Open Threats

| Threat ID | Category | Mitigation Expected | Files Searched |
|-----------|----------|---------------------|----------------|
| 04-01/T-04-01 | Tampering | Atomic replace-active-share persistence primitive or database-enforced active-share guard with retry/conflict handling, plus regression coverage proving concurrent creates cannot leave multiple active owner+vault shares. | `src/features/share/shareService.ts`, `src/shared/db/repositories/shareRepository.ts`, `src/features/share/shareService.test.ts`, `src/shared/db/repositories/shareRepository.test.ts`, backend dist bundles |
| 04-02/T-04-01 | Tampering | Batch create must rely on a concurrency-safe latest-share-wins implementation, not only sequential delegation to `createShareForOwner`. | `src/features/share/shareService.ts`, `src/features/share/shareService.test.ts`, backend dist bundles |
| 04-03/T-04-01 | Tampering | Regenerated Worker, Docker, and Netlify bundles must contain the fixed atomic/latest-share-wins implementation after source remediation, not only current marker strings. | `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, `backend/dist/netlify/api.mjs` |

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01-01 | 04-01/T-04-05 | Plan 04-01 is backend-only and explicitly accepts no frontend generated chunk work in this plan. | Plan 04-01 threat register | 2026-05-03 |
| AR-04-02-01 | 04-02/T-04-05 | Plan 04-02 is backend API-only and explicitly accepts no frontend generated chunk work in this plan. | Plan 04-02 threat register | 2026-05-03 |

## Unregistered Flags

None. The `## Threat Flags` sections in 04-01, 04-02, and 04-03 summaries report no new unregistered flags.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | ASVS Level | Run By |
|------------|---------------|--------|------|------------|--------|
| 2026-05-04 | 13 | 10 | 3 | 1 | Codex gsd-security-auditor |

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [ ] `threats_open: 0` confirmed
- [ ] `status: verified` set in frontmatter

Approval: blocked pending latest-share-wins concurrency mitigation.
