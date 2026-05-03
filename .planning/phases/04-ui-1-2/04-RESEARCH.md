# Phase 04: ui-1-2 - Research

**Researched:** 2026-05-04 [VERIFIED: environment_context current_date]
**Domain:** NodeAuth share management UI, share owner API semantics, batch share workflow [VERIFIED: .planning/ROADMAP.md]
**Confidence:** MEDIUM [VERIFIED: local repo audit; CITED: Vue/Element Plus/Hono/Vitest official docs]

## User Constraints

No `.planning/phases/04-ui-1-2/*-CONTEXT.md` exists, so there are no locked discuss-phase decisions to copy verbatim. [VERIFIED: `gsd-sdk query init.phase-op 4`]

Phase 4 objective from ROADMAP: `新增UI功能改动，左侧菜单界面新增管理分享页面，点击后可以管理有分享的账户，每个账户只能有一条有效分享。以最新的为准，点击分享账户获取新链接后，旧的自动过期，同时把1，2讨论的功能全部实现到该页面上，并在我的账户界面，支持全选，分组全选的时候在删除按钮和取消按钮中间新增一个分享按钮，支持批量分享` [VERIFIED: .planning/ROADMAP.md]

Additional prompt constraints: verify editable frontend source before promising UI implementation; preserve strict privacy; show raw share tokens/access codes only at creation or regeneration time according to existing API semantics. [VERIFIED: user prompt; VERIFIED: docs/share-link-security-contract.md]

## Summary

Phase 4 is not just frontend work: the requested UI promise "each account can have only one effective share; latest share wins" is not currently enforced by the backend. [VERIFIED: `src/features/share/shareService.ts`; VERIFIED: `src/shared/db/repositories/shareRepository.ts`] `createShare()` inserts a new row and does not revoke existing active shares for the same owner/vault item. [VERIFIED: `src/features/share/shareService.ts`] The schema has indexes on `vault_item_id`, owner, token hash, and expiration, but no active-share uniqueness constraint. [VERIFIED: `backend/schema.sql`; VERIFIED: `src/shared/db/schema/*.ts`]

The maintainable backend source, build scripts, backend lockfile, and Vitest config are present. [VERIFIED: `src/**`; VERIFIED: `backend/scripts/build-*.js`; VERIFIED: `backend/package-lock.json`; VERIFIED: `backend/vitest.config.ts`] Editable frontend source is still absent: no `frontend/package.json`, `vite.config.*`, `.vue`, frontend `.ts`, or frontend source maps were found outside generated `frontend/dist/**`. [VERIFIED: `find frontend ...`; VERIFIED: `.planning/source-provenance.md`] The built SPA already contains partial generated single-item share actions in `frontend/dist/assets/vaultList-88fb41a5.js`, but those are generated assets and should not be the primary implementation surface. [VERIFIED: `frontend/dist/assets/vaultList-88fb41a5.js`; VERIFIED: `.planning/source-provenance.md`]

**Primary recommendation:** Implement backend latest-share-wins and optional batch-owner share API from source first, then implement the requested owner UI only after editable Vue frontend source is restored; do not hand-edit generated Vite chunks as the planned delivery path. [VERIFIED: repo source audit; VERIFIED: AGENTS.md GSD workflow constraints]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Left-side menu share management entry | Frontend SPA | Browser / Client | Existing navigation state is `app_active_tab` and Element Plus menu items in the built SPA. [VERIFIED: `frontend/dist/assets/home-4662a7b2.js`] |
| Share management page | Frontend SPA | API / Backend | The page should render safe owner metadata from `/api/share`; backend owns privacy and status truth. [VERIFIED: `src/features/share/shareRoutes.ts`; VERIFIED: `src/features/share/shareTypes.ts`] |
| One effective share per account | API / Backend | Database / Storage | UI cannot enforce this securely; service/repository must revoke or expire previous active shares before returning a new link. [VERIFIED: `src/features/share/shareService.ts`; VERIFIED: docs/share-link-security-contract.md] |
| Latest-share-wins regeneration | API / Backend | Database / Storage | Raw link/code are creation-only; regeneration must be a create-like backend operation that invalidates older active links atomically enough for supported databases. [VERIFIED: docs/share-link-security-contract.md; VERIFIED: `src/features/share/shareTypes.ts`] |
| Batch share from My Accounts | Frontend SPA | API / Backend | Selection is client-side, but backend must still validate ownership per item and return one-time secrets only for successfully created shares. [VERIFIED: `frontend/dist/assets/vaultList-88fb41a5.js`; VERIFIED: `src/features/share/shareRoutes.ts`] |
| Public recipient access page | API / Backend | Static HTML | Existing `/share/:token` server-rendered public page avoids unauthenticated share links falling into the SPA shell. [VERIFIED: `src/app/index.ts`; VERIFIED: `src/features/share/sharePublicPage.ts`] |

## Project Constraints (from AGENTS.md)

- Shared links expose sensitive login material and require high-entropy tokens, expiration, revocation, and access-code protection by default. [VERIFIED: AGENTS.md]
- Sharing is limited to one account/vault item per link. [VERIFIED: AGENTS.md]
- Backend compatibility must continue across Cloudflare Workers, Docker, and Netlify. [VERIFIED: AGENTS.md; VERIFIED: `wrangler.toml`; VERIFIED: `Dockerfile`; VERIFIED: `netlify.toml`]
- Follow existing Hono route, feature module, repository, and centralized error patterns. [VERIFIED: AGENTS.md; VERIFIED: `.planning/codebase/ARCHITECTURE.md`]
- Frontend and TypeScript source may be missing; planning must verify available editable source before promising UI changes. [VERIFIED: AGENTS.md; VERIFIED: local frontend audit]
- Shared-link responses must not leak vault lists, owner identity beyond necessity, session cookies, backup data, or unnecessary internal IDs. [VERIFIED: AGENTS.md; VERIFIED: `src/features/share/shareRoutes.test.ts`]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hono | declared `^4.12.12`; latest `4.12.16` published 2026-04-30 | Backend route/middleware layer | Existing API shell uses `app.route`, middleware, `c.json`, and `app.onError`; Hono official docs cover route composition and `app.request` tests. [VERIFIED: `backend/package.json`; VERIFIED: npm registry; CITED: https://hono.dev/docs/api/routing; CITED: https://hono.dev/docs/guides/testing] |
| Vitest | declared `^4.1.0`; latest `4.1.5` published 2026-04-21 | Backend tests | Existing tests use `describe`, `it`, `expect`, `vi.mock`, `vi.spyOn`; Vitest docs warn to clear/restore mocks between tests. [VERIFIED: `backend/package.json`; VERIFIED: npm registry; CITED: https://vitest.dev/guide/mocking.html] |
| Drizzle ORM | declared `^0.45.2` | Cross-database schema/repository API | Existing repositories and schema modules use Drizzle table objects, predicates, and inserts/updates across SQLite/D1, MySQL, and PostgreSQL. [VERIFIED: `src/shared/db/schema/*.ts`; VERIFIED: `src/shared/db/repositories/shareRepository.ts`] |
| Vue 3 | built bundle present; latest npm `3.5.33` published 2026-04-22 | SPA component model if source is restored | Existing generated SPA imports Vue runtime chunk and uses async component loading patterns; Vue official docs define `defineAsyncComponent` plus dynamic import chunk loading. [VERIFIED: `frontend/dist/assets/vue-core-Daban9YF.js`; VERIFIED: npm registry; CITED: https://vuejs.org/guide/components/async.html] |
| Element Plus | built bundle present; latest npm `2.13.7` published 2026-04-10 | Existing UI components | Built SPA uses Element Plus menu, buttons, message boxes, table-like controls, icons, and feedback patterns; Element Plus official docs define menu active selection, table multiple selection, and confirm dialogs. [VERIFIED: `frontend/dist/assets/element-plus-Dh0klhaa.js`; VERIFIED: npm registry; CITED: https://element-plus.org/en-US/component/menu.html; CITED: https://element-plus.org/en-US/component/table.html; CITED: https://element-plus.org/en-US/component/message-box.html] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsup | declared `^8.4.0` | Backend bundle generation | Use existing backend build scripts to regenerate Worker, Docker, Netlify, and Vercel bundles after backend changes. [VERIFIED: `backend/package.json`; VERIFIED: `backend/scripts/build-worker.js`] |
| Wrangler | pinned `4.75.0`; available locally `4.75.0` | Cloudflare Worker dev/deploy tooling | Use only for backend Worker validation/build paths; current phase should not require Cloudflare-only storage. [VERIFIED: `backend/package.json`; VERIFIED: `npx wrangler --version`] |
| Built Phosphor icon chunks | generated asset files | Existing visual icon language | If editable frontend source is restored, reuse existing icon package/pattern rather than adding another icon library. [VERIFIED: `frontend/dist/assets/Ph*.js`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing Hono share route/service/repository | A separate share management backend subsystem | Reject: duplicates auth, CORS, health gate, error handling, and privacy tests. [VERIFIED: `src/app/index.ts`; VERIFIED: `src/features/share/shareRoutes.ts`] |
| Existing Vue/Element Plus SPA | React/shadcn or new frontend stack | Reject: project is Vue/Element Plus output; no shadcn/Tailwind config exists. [VERIFIED: `frontend/dist/**`; VERIFIED: no `components.json`; VERIFIED: no Tailwind config] |
| Backend batch endpoint | Client loops over `POST /api/share` | Client loop is acceptable for small batches, but backend batch is safer for consistent latest-share-wins, partial-success reporting, and rate/error behavior. [VERIFIED: current single-create endpoint; VERIFIED: requested batch sharing] |

**Installation:** Do not add frontend packages until editable frontend source and package metadata are restored. [VERIFIED: frontend source audit] Backend dependencies are already installed under `backend/node_modules`. [VERIFIED: local file audit]

```bash
cd backend
npm test
npm run build:worker
npm run build:docker
npm run build:netlify
```

**Version verification:** `npm view hono version time`, `npm view vue version time`, `npm view element-plus version time`, and `npm view vitest version time` were run on 2026-05-04. [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```text
Owner clicks Share / batch Share in My Accounts
  -> Frontend validates online state and selected account IDs
  -> Owner share API receives one item or batch request
  -> authMiddleware resolves owner
  -> ShareService validates owner can access each vault item
  -> ShareService revokes/expires previous active shares for the same owner+vault item
  -> ShareRepository inserts new hashed-token / hashed-access-code rows
  -> API returns safe metadata plus raw public URL/access code exactly once
  -> Frontend shows one-time handoff dialog and refreshes share management state

Owner opens Share Management page
  -> Frontend fetches GET /api/share
  -> API returns safe metadata only
  -> Frontend groups by account and highlights current effective status
  -> Owner may revoke active share
  -> DELETE /api/share/:id updates revoked_at and audit event

Friend opens /share/:token
  -> Backend static share page renders noindex/no-store/no-referrer HTML
  -> Friend submits accessCode in POST body
  -> shareRateLimit + ShareService resolve token/code
  -> Generic inaccessible response OR SharedItemView allowlist
```

### Recommended Project Structure

```text
src/features/share/
├── shareRoutes.ts              # add batch/regenerate route if needed
├── shareService.ts             # enforce latest-share-wins and creation-only secrets
├── shareTypes.ts               # add batch DTO types
└── *.test.ts                   # route/service tests for single and batch semantics

src/shared/db/repositories/
└── shareRepository.ts          # add owner+vault active revoke/list helpers

frontend source (currently absent)
├── share management page       # new owner page when source restored
├── navigation/menu module      # add left menu tab
└── vault list component        # select all, group select all, batch share action
```

### Pattern 1: Keep Share Truth in Service/Repository

**What:** Enforce "one effective share per account" in backend service/repository, not in UI. [VERIFIED: current backend layering]
**When to use:** Any create/regenerate path, including item-level and batch sharing. [VERIFIED: user prompt]
**Example:**

```typescript
// Source: existing route factory pattern in src/features/share/shareRoutes.ts
const getService = (c: any) => createShareService(c.env);

share.post('/', authMiddleware, async (c) => {
    const user = c.get('user');
    const ownerId = user.email || user.id;
    const body = await c.req.json().catch(() => ({}));
    // Service must own validation, previous-share revocation, audit, and one-time secret creation.
});
```

### Pattern 2: Use Existing Owner Share Metadata DTOs

**What:** Share management UI consumes `OwnerShareMetadataView` and never consumes token hashes, access-code hashes, owner IDs, vault secrets, passwords, OTP seeds, session, or backup fields. [VERIFIED: `src/features/share/shareTypes.ts`; VERIFIED: `src/features/share/shareRoutes.test.ts`]
**When to use:** Share page table/list, account-group rows, revoke confirmations, and post-create refresh. [VERIFIED: user prompt]
**Example:**

```typescript
// Source: src/features/share/shareTypes.ts
export interface OwnerShareMetadataView {
    id: string;
    item: { id: string; service: string; account: string };
    status: 'active' | 'expired' | 'revoked';
    createdAt: string;
    expiresAt: string;
    revokedAt: string | null;
    lastAccessedAt: string | null;
    accessCount: number;
    publicUrl?: string;
}
```

### Pattern 3: Follow Existing Generated SPA Shape Only as Evidence

**What:** Existing built SPA uses active-tab state, async-loaded views, Element Plus menu/buttons/message boxes, and client-side selected IDs. [VERIFIED: `frontend/dist/assets/home-4662a7b2.js`; VERIFIED: `frontend/dist/assets/vaultList-88fb41a5.js`]
**When to use:** Planning future frontend tasks after editable source is restored. [VERIFIED: frontend source audit]
**Example:**

```text
home chunk evidence:
- desktop menu items are keyed by app_active_tab.
- desktop body lazy-loads feature views based on app_active_tab.
- vault list keeps selectedIds and has selectAllLoaded / handleBulkDelete.
```

### Anti-Patterns to Avoid

- **Generated chunk patching:** Do not make Phase 4 depend on hand-editing `frontend/dist/assets/*.js`; those files are generated and lack source maps. [VERIFIED: frontend source audit; VERIFIED: `.planning/source-provenance.md`]
- **UI-only latest-share-wins:** Do not hide older shares in UI while leaving old links usable. [VERIFIED: current service does not revoke older active shares]
- **Re-showing old access codes:** Do not add UI that implies existing raw access codes can be recovered; raw codes are one-time create outputs. [VERIFIED: docs/share-link-security-contract.md; VERIFIED: `OwnerShareCreatedView` vs `OwnerShareMetadataView`]
- **Public-condition-specific errors:** Do not reveal expired/revoked/wrong-code/rate-limit/delete conditions in recipient UI or public API. [VERIFIED: `src/features/share/shareRoutes.test.ts`; VERIFIED: docs/share-link-security-contract.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Owner auth/session handling | Custom owner parsing in share routes | `authMiddleware` and `user.email || user.id` pattern | Existing owner APIs already use this pattern and tests verify fallback to `user.id`. [VERIFIED: `src/features/share/shareRoutes.ts`; VERIFIED: `src/features/share/shareRoutes.test.ts`] |
| Share security primitives | Custom random token/code/hash logic | `generateShareToken`, `generateAccessCode`, `hashShareSecret`, `verifyShareSecret` | Existing primitives use Web Crypto random bytes and HMAC-derived storage. [VERIFIED: `src/features/share/shareSecurity.ts`] |
| Public share headers | Ad hoc headers per route | `getSharePublicHeaders()` | Existing public route tests assert no-store/no-referrer headers. [VERIFIED: `src/features/share/shareSecurity.ts`; VERIFIED: `src/features/share/shareRoutes.test.ts`] |
| Backend API tests | Manual HTTP server | Hono `app.request` with mocked `c.env` | Hono official docs support testing by passing requests to the app and env as third parameter. [CITED: https://hono.dev/docs/guides/testing] |
| Selection UI primitives | Custom table widget from scratch | Existing Vue/Element Plus selection patterns and current vault selectedIds model | Element Plus supports table multiple selection via `type="selection"`; existing vault UI already has selectedIds/selectAllLoaded. [CITED: https://element-plus.org/en-US/component/table.html; VERIFIED: `frontend/dist/assets/vaultList-88fb41a5.js`] |
| Confirmation dialogs | Custom modal state for simple revoke warning | Element Plus MessageBox / existing `ElMessageBox.confirm` pattern | Element Plus supports Promise-based confirm with options; built SPA already uses MessageBox confirm/alert. [CITED: https://element-plus.org/en-US/component/message-box.html; VERIFIED: `frontend/dist/assets/vaultList-88fb41a5.js`] |

**Key insight:** The difficult part is not drawing a share page; it is making the backend guarantee the share status the page displays. [VERIFIED: current API/service audit]

## Common Pitfalls

### Pitfall 1: Planning UI Work Without Editable Frontend Source
**What goes wrong:** Plans promise Vue component edits when only generated Vite chunks exist. [VERIFIED: frontend source audit]
**Why it happens:** Earlier phases were API-only because frontend source was absent; the built SPA now contains generated chunks that look editable but are not maintainable source. [VERIFIED: `.planning/source-provenance.md`; VERIFIED: `frontend/dist/assets/*.js`]
**How to avoid:** Make frontend implementation contingent on restoring source; otherwise limit executable Phase 4 work to backend semantics, tests, and documented UI contract. [VERIFIED: AGENTS.md]
**Warning signs:** No `frontend/package.json`, no `vite.config.*`, no `.vue`, and no frontend `.map` files. [VERIFIED: `find frontend ...`]

### Pitfall 2: Latest Share Wins Only in the UI
**What goes wrong:** Owner sees only the newest share, but old links still pass public access. [VERIFIED: current service inserts without revoking previous active rows]
**Why it happens:** Current `POST /api/share` creates a share for one item and returns one-time raw secrets; it does not revoke by `vaultItemId`. [VERIFIED: `src/features/share/shareService.ts`]
**How to avoid:** Add repository/service helpers to revoke active non-revoked, non-expired shares for the same owner+vault item before or during new share creation, with audit events. [VERIFIED: current repository has revoke/audit primitives]
**Warning signs:** Tests only assert a new row was created, not that older active shares become inaccessible. [VERIFIED: `src/features/share/shareService.test.ts`]

### Pitfall 3: Batch Sharing Loses One-Time Secrets
**What goes wrong:** Batch create returns only metadata, so the owner cannot retrieve access codes later. [VERIFIED: docs/share-link-security-contract.md]
**Why it happens:** List/detail endpoints intentionally omit raw token and access code. [VERIFIED: `OwnerShareMetadataView`; VERIFIED: `src/features/share/shareRoutes.test.ts`]
**How to avoid:** Batch API response must include per-created-share raw URL/access code exactly once, and the UI must show or copy them immediately without persisting them. [VERIFIED: docs/share-link-security-contract.md]
**Warning signs:** UI says "view in share details" for access code, which is incompatible with one-time code semantics. [VERIFIED: `frontend/dist/assets/vaultList-88fb41a5.js` currently has fallback copy text]

### Pitfall 4: Pagination and Select-All Semantics
**What goes wrong:** "Select all" means only loaded pages, while users expect all accounts in the filter/category. [VERIFIED: built vault UI has `selectAllLoaded`; VERIFIED: paginated `/api/vault`]
**Why it happens:** Current vault API is paginated and infinite-loaded; client-side selection only knows loaded rows. [VERIFIED: `src/features/vault/vaultRoutes.ts`; VERIFIED: `frontend/dist/assets/useVaultList-MTZ7e-QK.js`]
**How to avoid:** Label the existing operation as "select all loaded"; define group select-all as currently loaded accounts in the active group unless a backend "all matching IDs" endpoint is explicitly added. [VERIFIED: current API surface]
**Warning signs:** Batch share count mismatches `categoryStats` or includes unloaded accounts unexpectedly. [VERIFIED: current paginated data flow]

### Pitfall 5: Offline Queueing Sensitive Share Creation
**What goes wrong:** Raw share tokens/codes get queued in offline/local storage or share actions appear to work offline. [VERIFIED: security contract forbids storage of raw secrets]
**Why it happens:** Existing vault list supports offline sync for account CRUD, but share creation is online API behavior. [VERIFIED: `frontend/dist/assets/useVaultList-MTZ7e-QK.js`; VERIFIED: `frontend/dist/assets/vaultList-88fb41a5.js`]
**How to avoid:** Keep share and batch-share actions online-only and block when `navigator.onLine` is false or app offline/manual-offline mode is active. [VERIFIED: existing generated share action already blocks offline]
**Warning signs:** Share requests appear in offline sync queue or IndexedDB. [VERIFIED: current offline queue exists for vault actions]

## Code Examples

### Current Owner Create Route Shape

```typescript
// Source: src/features/share/shareRoutes.ts
share.post('/', authMiddleware, async (c) => {
    const user = c.get('user');
    const ownerId = user.email || user.id;
    const body = await c.req.json().catch(() => ({}));
    const publicOrigin = c.env.NODEAUTH_PUBLIC_ORIGIN || new URL(c.req.url).origin;
    const service = getService(c);
    const share = await service.createShareForOwner({
        ownerId,
        vaultItemId: body.vaultItemId,
        ttlSeconds: Number.isFinite(body.ttlSeconds) ? body.ttlSeconds : undefined,
        expiresAt: Number.isFinite(body.expiresAt) ? body.expiresAt : undefined,
        publicOrigin,
    });
    return c.json({ success: true, share });
});
```

### Current Safe Owner Metadata Contract

```typescript
// Source: src/features/share/shareTypes.ts
export interface OwnerShareCreatedView extends OwnerShareMetadataView {
    rawToken: string;
    rawAccessCode: string;
}
```

### Hono Route Test Pattern

```typescript
// Source: Hono official testing docs and existing src/features/share/shareRoutes.test.ts
const response = await app.request('https://nodeauth.test/api/share', {
    method: 'POST',
    body: JSON.stringify({ vaultItemId: 'vault-1' }),
    headers: { 'Content-Type': 'application/json' },
}, { NODEAUTH_PUBLIC_ORIGIN: 'https://shares.example' } as any);
expect(response.status).toBe(200);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Treat checkout as distribution-only with no backend source | Use restored `src/**` plus backend build scripts as primary backend surface | Phase 1 completed before 2026-05-04 | Backend latest-share-wins can be implemented maintainably. [VERIFIED: `.planning/source-provenance.md`; VERIFIED: local source audit] |
| API-only share milestone | Phase 4 asks for owner UI and batch share workflow | Phase 4 added 2026-05-04 | Frontend source absence is now the main blocker for maintainable UI delivery. [VERIFIED: `.planning/STATE.md`; VERIFIED: frontend source audit] |
| Single share create endpoint only | Need create/regenerate semantics that revoke previous active share for same item | Phase 4 objective | Backend contract must expand before UI can be truthful. [VERIFIED: current API audit; VERIFIED: .planning/ROADMAP.md] |
| Generated UI had item-level MessageBox management | Requested dedicated left-menu management page | Phase 4 objective | Built generated code is evidence, not a target implementation surface. [VERIFIED: `frontend/dist/assets/vaultList-88fb41a5.js`; VERIFIED: `frontend/dist/assets/home-4662a7b2.js`] |

**Deprecated/outdated:**
- Older codebase notes saying backend build scripts and backend lockfile are missing are stale; those files now exist. [VERIFIED: `.planning/codebase/STACK.md`; VERIFIED: `backend/scripts/build-*.js`; VERIFIED: `backend/package-lock.json`]
- Any plan to recover access codes from share details is invalid; raw access codes are not stored recoverably and are only returned on creation/regeneration. [VERIFIED: docs/share-link-security-contract.md; VERIFIED: `OwnerShareCreatedView`]

## Assumptions Log

All claims in this research were verified locally, cited from official docs, or tied to the user prompt. [VERIFIED: source list below]

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| None | No `[ASSUMED]` claims were used. | All | No user confirmation required for factual claims; planning still must decide whether to restore frontend source or scope backend-only work first. |

## Open Questions

1. **Where is editable frontend source?** [VERIFIED: frontend source audit]
   - What we know: only generated `frontend/dist/**` is present, and `.planning/source-provenance.md` says frontend source is not present. [VERIFIED: `.planning/source-provenance.md`]
   - What's unclear: whether source is available externally or should be reconstructed. [VERIFIED: no local evidence found]
   - Recommendation: planner should make frontend source restoration a Wave 0 blocker before UI implementation tasks. [VERIFIED: AGENTS.md]

2. **Should batch sharing be a backend endpoint or client loop?** [VERIFIED: current API has only single `POST /api/share`]
   - What we know: current API supports single create/list/detail/revoke and public access. [VERIFIED: `src/features/share/shareRoutes.ts`]
   - What's unclear: user has not specified partial failure behavior for batch share. [VERIFIED: user prompt]
   - Recommendation: add `POST /api/share/batch` or equivalent source-level API so latest-share-wins, partial results, and one-time secret return shape are tested once. [VERIFIED: current backend architecture]

3. **Does "group select all" mean loaded group or all accounts matching group in database?** [VERIFIED: current frontend uses loaded selection; current API is paginated]
   - What we know: built UI has `selectAllLoaded`; category stats can exceed loaded rows. [VERIFIED: `frontend/dist/assets/vaultList-88fb41a5.js`; VERIFIED: `src/features/vault/vaultRoutes.ts`]
   - What's unclear: whether user expects selecting unloaded accounts. [VERIFIED: user prompt]
   - Recommendation: implement and label loaded group select-all unless adding a backend ID enumeration endpoint is explicitly planned. [VERIFIED: current API limitations]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Backend tests/build scripts | yes | `v22.22.2` local; deployment targets Node 24 | Use local for tests; do not claim Node 24 local parity. [VERIFIED: `node --version`; VERIFIED: `Dockerfile`; VERIFIED: `.github/workflows/netlify.yml`] |
| npm | Package/test commands | yes | `10.9.7` | none needed. [VERIFIED: `npm --version`] |
| Wrangler | Worker build/dev validation | yes | `4.75.0` | Existing backend build scripts do not require deploying. [VERIFIED: `npx wrangler --version`; VERIFIED: `backend/package.json`] |
| Vitest | Backend validation | yes | `4.1.5` executable | none needed. [VERIFIED: `npx vitest --version`] |
| Editable frontend source | UI implementation | no | — | Restore source externally or descope generated-asset edits. [VERIFIED: frontend source audit] |

**Missing dependencies with no fallback:**
- Editable frontend source is missing for maintainable UI implementation. [VERIFIED: frontend source audit]

**Missing dependencies with fallback:**
- None for backend source-level semantics and tests. [VERIFIED: backend source/build/test audit]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.5` executable; package declares `^4.1.0`. [VERIFIED: `npx vitest --version`; VERIFIED: `backend/package.json`] |
| Config file | `backend/vitest.config.ts`, includes `../src/**/*.test.ts`. [VERIFIED: `backend/vitest.config.ts`] |
| Quick run command | `cd backend && npm test -- ../src/features/share/shareService.test.ts ../src/features/share/shareRoutes.test.ts` [VERIFIED: current test files] |
| Full suite command | `cd backend && npm test` [VERIFIED: `backend/package.json`] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PH4-BE-01 | Creating/regenerating a share revokes older active shares for the same owner+vault item. | unit/service | `cd backend && npm test -- ../src/features/share/shareService.test.ts` | yes, needs new tests [VERIFIED: current file exists] |
| PH4-BE-02 | Batch share validates every item owner-side and returns per-item one-time raw URL/access code only for new shares. | route/service | `cd backend && npm test -- ../src/features/share/shareRoutes.test.ts` | yes, needs new tests [VERIFIED: current file exists] |
| PH4-UI-01 | Left menu has Share Management page. | frontend/manual | blocked until editable frontend source exists | no source [VERIFIED: frontend source audit] |
| PH4-UI-02 | My Accounts supports select all, group select all, and Share button between Delete and Cancel. | frontend/manual or component test | blocked until editable frontend source exists | no source [VERIFIED: frontend source audit] |
| PH4-SEC-01 | Owner list/detail/batch responses do not leak owner/session/backup/internal secret fields. | unit/route | `cd backend && npm test -- ../src/features/share/shareRoutes.test.ts` | yes [VERIFIED: current tests] |

### Sampling Rate

- **Per task commit:** `cd backend && npm test -- ../src/features/share/shareService.test.ts ../src/features/share/shareRoutes.test.ts` [VERIFIED: current test infra]
- **Per wave merge:** `cd backend && npm test` [VERIFIED: backend package script]
- **Phase gate:** Backend full suite green, regenerated backend bundles if source changes, and explicit frontend-source availability decision before UI execution. [VERIFIED: backend build scripts; VERIFIED: frontend source audit]

### Wave 0 Gaps

- [ ] Restore or provide editable frontend source before planning actual Vue page/menu/account-list changes. [VERIFIED: frontend source audit]
- [ ] Add service/repository tests for revoking previous active share for same account. [VERIFIED: current test gap]
- [ ] Add route tests for batch share response shape and safe partial failures if batch endpoint is chosen. [VERIFIED: current route gap]
- [ ] Add generated-output assertion after backend source changes if route/service behavior changes. [VERIFIED: prior phase build pattern]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Owner APIs use `authMiddleware`; public recipient access remains unauthenticated by design. [VERIFIED: `src/features/share/shareRoutes.ts`] |
| V3 Session Management | yes | Owner API requests use existing session/CSRF client fetch behavior; public share page must not set or require session cookies. [VERIFIED: `frontend/dist/assets/index-936a7cdd.js`; VERIFIED: `src/features/share/sharePublicPage.ts`] |
| V4 Access Control | yes | `findActiveByIdForOwner` gates vault item access and share lookup is owner-scoped for owner routes. [VERIFIED: `src/features/share/shareService.ts`; VERIFIED: `src/shared/db/repositories/shareRepository.ts`] |
| V5 Input Validation | yes | Route validates `vaultItemId` and strips non-finite TTL/expires input; batch route must validate IDs array. [VERIFIED: `src/features/share/shareRoutes.ts`; VERIFIED: `src/features/share/shareRoutes.test.ts`] |
| V6 Cryptography | yes | Use existing Web Crypto random tokens/access codes and HMAC-derived stored secrets; never store raw token/code. [VERIFIED: `src/features/share/shareSecurity.ts`; VERIFIED: docs/share-link-security-contract.md] |

### Known Threat Patterns for NodeAuth Share UI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Old share remains usable after regeneration | Elevation of privilege / Information disclosure | Backend latest-share-wins revocation before returning the new link. [VERIFIED: current gap] |
| Raw access code persisted by UI | Information disclosure | One-time handoff only; no localStorage/IndexedDB/service-worker cache. [VERIFIED: docs/share-link-security-contract.md] |
| Batch partial failure leaks account existence | Information disclosure | Owner-scoped validation with generic per-item failure for inaccessible IDs. [VERIFIED: current owner API pattern] |
| Public wrong-code/expired/revoked distinction | Information disclosure | Same generic public inaccessible body and no-store/no-referrer headers. [VERIFIED: `src/features/share/shareRoutes.test.ts`] |
| Share token appears in logs | Information disclosure | Existing global logger redacts `/api/share/public/:token/access`; preserve and extend if new public routes are added. [VERIFIED: `src/app/index.ts`] |

## Sources

### Primary (HIGH confidence)

- Local repo: `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/source-provenance.md`, `.planning/codebase/*.md`. [VERIFIED: local read]
- Local backend source: `src/features/share/*`, `src/shared/db/repositories/shareRepository.ts`, `src/shared/db/schema/*`, `src/features/vault/vaultRoutes.ts`, `src/app/index.ts`. [VERIFIED: local read]
- Local frontend generated evidence: `frontend/dist/assets/home-4662a7b2.js`, `frontend/dist/assets/vaultList-88fb41a5.js`, `frontend/dist/assets/useVaultList-MTZ7e-QK.js`, `frontend/dist/assets/index-936a7cdd.js`. [VERIFIED: local read]
- Official Vue docs: https://vuejs.org/guide/components/async.html and https://vuejs.org/guide/essentials/reactivity-fundamentals.html. [CITED: official docs]
- Official Element Plus docs: https://element-plus.org/en-US/component/menu.html, https://element-plus.org/en-US/component/table.html, https://element-plus.org/en-US/component/message-box.html. [CITED: official docs]
- Official Hono docs: https://hono.dev/docs/api/routing and https://hono.dev/docs/guides/testing. [CITED: official docs]
- Official Vitest docs: https://vitest.dev/guide/mocking.html. [CITED: official docs]
- npm registry version checks for `hono`, `vue`, `element-plus`, and `vitest`. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)

- None used. [VERIFIED: source audit]

### Tertiary (LOW confidence)

- Context7 CLI fallback failed with `fetch failed`, so no Context7 findings were used. [VERIFIED: `npx --yes ctx7@latest ...`]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions and existing dependencies were verified against package files, local runtime commands, npm registry, and official docs. [VERIFIED: package files; VERIFIED: npm registry; CITED: official docs]
- Architecture: HIGH for backend and generated frontend evidence; LOW for actual frontend implementation path until editable source is restored. [VERIFIED: local source audit]
- Pitfalls: HIGH for backend/security/generated-source pitfalls; MEDIUM for frontend UX specifics because only generated chunks are available. [VERIFIED: local audit]

**Research date:** 2026-05-04 [VERIFIED: environment_context current_date]
**Valid until:** 2026-05-18 for frontend/package version details; backend repo facts valid until source tree changes. [VERIFIED: current date; VERIFIED: local repo state]
