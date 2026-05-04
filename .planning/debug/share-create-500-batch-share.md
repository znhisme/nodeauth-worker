---
status: resolved
trigger: "更新最新版本后创建分享链接会直接报错nternal_server_error；创建分享链接失败；并且现在没有批量分享功能，按照设计，应该是全选后出现在删除按钮右侧"
created: "2026-05-04"
updated: "2026-05-04"
---

# Debug Session: share-create-500-batch-share

## Symptoms

- Expected behavior: Creating a share link succeeds after updating to the latest version; selecting multiple accounts shows a batch share action to the right of the delete button.
- Actual behavior: Creating a share link fails with `internal_server_error` and the UI shows `创建分享链接失败`; batch share is missing.
- Error messages: `internal_server_error`; `创建分享链接失败`.
- Timeline: Started after updating to the latest version.
- Reproduction: Create a share link from the current UI; select/all-select accounts and look for the share action beside delete.

## Current Focus

- hypothesis: Share creation 500s after update because share-link schema migrations could race or partially skip active_share_key repair; batch share action exists in overlay source but misses the current Vue toolbar because detection is too text-fragile.
- test: Backend Vitest suite plus focused migration/worker/overlay source contract tests.
- expecting: First request waits for D1 migrations; v14 continues after duplicate active_share_key column and backfills/indexes it; batch action appears after delete in the selection toolbar.
- next_action: complete
- reasoning_checkpoint: Root cause confirmed in src/shared/db/migrator.ts, src/app/worker.ts, and frontend/src/share-ui/share-management-ui.js.
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-04T07:00:48Z
  observation: `POST /api/share` writes `share_links.active_share_key` through `ShareRepository.createReplacingShareLink`; databases that had share tables but not the completed v14 active-share repair can throw at create time and surface as `internal_server_error`.
- timestamp: 2026-05-04T07:00:48Z
  observation: Migration v13 still created `idx_share_links_active_share_key`; if share tables already existed without `active_share_key`, v13 could fail before v14. Migration v14 also treated duplicate-column as a whole-migration skip, so a partially upgraded DB could keep `active_share_key` null and miss the unique guard.
- timestamp: 2026-05-04T07:00:48Z
  observation: Worker bootstrap used `ctx.waitUntil(migrateDatabase(...))`, allowing first traffic after deploy to route before the schema migration finished. Share-link writes depend on latest schema immediately.
- timestamp: 2026-05-04T07:00:48Z
  observation: Batch share overlay existed, but toolbar detection required delete button text. The current generated vault list renders the mobile delete action as an icon-only danger button in `.batch-actions`, so the overlay could fail to find the delete button after select-all.

## Eliminated

- Missing backend batch endpoint: eliminated. `src/features/share/shareRoutes.ts` has `POST /api/share/batch` and route tests cover owner scoping/privacy.
- Missing overlay bundle from `index.html`: eliminated. `frontend/dist/index.html` loads `/assets/share-management-ui.css` and `/assets/share-management-ui.js`.

## Resolution

## Specialist Review

- specialist_hint: typescript
- result: LOOKS_GOOD. Fix direction is appropriate for a TypeScript/Cloudflare Worker codebase: make schema migration deterministic before share writes, make migration statements idempotent at statement granularity, and update the DOM overlay to match current generated Vue markup while preserving bundled distribution assets.

- root_cause: Share creation failed after update because D1 migrations ran asynchronously and active_share_key rollout could be skipped/blocked in partially upgraded databases; batch share was present but hidden by brittle toolbar/delete-button detection.
- fix: Await and memoize Worker D1 migrations before request routing, move active_share_key uniqueness out of v13 into v14 repair, skip already-applied DDL per statement so v14 still backfills/indexes, and update/rebuild the share overlay to find `.batch-actions` and icon-only danger delete buttons.
- verification: `cd backend && npm test`; `cd backend && npx vitest run src/app/worker.test.ts src/app/shareManagementUiOverlay.test.ts src/shared/db/migrator.test.ts --reporter=verbose`; `cd frontend && npm run build:share-ui`; backend worker/docker/netlify bundles rebuilt. Vercel bundle not rebuilt because `backend/scripts/build-vercel.js` is missing.
- files_changed: src/shared/db/migrator.ts; src/shared/db/migrator.test.ts; src/app/worker.ts; src/app/index.test.ts; src/app/worker.test.ts; src/app/shareManagementUiOverlay.test.ts; frontend/src/share-ui/share-management-ui.js; frontend/dist/assets/share-management-ui.js; backend/dist/worker/worker.js; backend/dist/worker/worker.js.map; backend/dist/docker/server.js; backend/dist/docker/server.js.map; backend/dist/netlify/api.mjs; backend/dist/netlify/api.mjs.map.
