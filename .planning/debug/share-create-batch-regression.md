---
status: resolved
trigger: "创建分享链接失败，没有批量创建功能"
created: "2026-05-04T07:41:16Z"
updated: "2026-05-04T07:45:00Z"
---

# Debug Session: share-create-batch-regression

## Symptoms

- expected_behavior: Creating a share link succeeds, and selecting accounts exposes a batch share action.
- actual_behavior: Share-link creation fails, and no batch creation affordance is visible.
- error_messages: User reports "创建分享链接失败"; no server stack trace was provided.
- timeline: Reported after commit e10d273 was pushed on 2026-05-04.
- reproduction: Try to create a share link in the deployed/current app; select multiple accounts or select all and look for the batch share action.

## Current Focus

- hypothesis: Existing deployed databases can still have duplicate active share keys that make the request-blocking migration fail, and the batch button detector is still too brittle for the generated vault list DOM.
- test: Add failing migration regression coverage for duplicate active_share_key rows and strengthen the overlay source contract against real generated vault list markup.
- expecting: Migration clears duplicate active_share_key values before the unique index is created, and selected vault IDs/batch toolbar detection no longer depend on the missing DOM shape.
- next_action: complete
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-04T07:42:00Z
  observation: New SQLite regression with two active rows sharing `owner-1:vault-1` failed during v14 with `UNIQUE constraint failed: share_links.active_share_key`.
  supports: Deployed databases that already have duplicate active keys can still make request-blocking migration fail, surfacing as share creation failure.
- timestamp: 2026-05-04T07:43:00Z
  observation: Clearing existing `active_share_key` values before revoking duplicates and rebuilding active keys makes the v14 duplicate-key regression pass.
  supports: v14 now self-repairs stale duplicate active keys before creating the unique guard.
- timestamp: 2026-05-04T07:43:30Z
  observation: Generated vault list markup puts selected state on `.vault-card.is-selected` inside a parent `[data-id]` wrapper and toolbar buttons inside `.vault-list-toolbar .batch-actions`.
  supports: Overlay detection needed to query selected descendants and the real toolbar selector.
- timestamp: 2026-05-04T07:44:30Z
  observation: `npm --prefix backend test` passed 11 test files and 115 tests; `npm --prefix frontend run build:share-ui` and all backend dist rebuilds passed.
  supports: Fix is covered in source tests and generated deployment bundles.

## Eliminated

## Resolution

- root_cause:
- root_cause: v14 migration did not repair stale duplicate `active_share_key` values before creating the unique index, and the share UI overlay still missed selected vault IDs/toolbars in the generated Vue DOM.
- fix: Clear stale active share keys before v14 recomputes the latest active share per account, and broaden the overlay selectors to read selected `.vault-card` descendants plus `.vault-list-toolbar .batch-actions`.
- verification: `npm --prefix backend run test -- src/shared/db/migrator.test.ts`; `npm --prefix backend run test -- src/app/shareManagementUiOverlay.test.ts src/shared/db/migrator.test.ts`; `npm --prefix frontend run build:share-ui`; backend Worker/Docker/Netlify rebuilds; `npm --prefix backend test`.
- files_changed: src/shared/db/migrator.ts; src/shared/db/migrator.test.ts; frontend/src/share-ui/share-management-ui.js; frontend/dist/assets/share-management-ui.js; src/app/shareManagementUiOverlay.test.ts; backend/dist/worker/worker.js; backend/dist/worker/worker.js.map; backend/dist/docker/server.js; backend/dist/docker/server.js.map; backend/dist/netlify/api.mjs; backend/dist/netlify/api.mjs.map.
