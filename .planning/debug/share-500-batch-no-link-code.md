---
status: resolved
trigger: "修复分享功能: 单个分享返回 {code: 500, success: false, message: \"internal_server_error\", data: null}; 批量分享功能返回 200，但是无访问链接和密码"
created: "2026-05-04T18:41:06+08:00"
updated: "2026-05-04T18:50:19+08:00"
---

# Debug Session: share-500-batch-no-link-code

## Symptoms

- Expected behavior: 单个分享创建应返回可访问链接和访问密码/访问码；批量分享返回 200 时，每个成功结果也应包含访问链接和访问密码/访问码。
- Actual behavior: 单个分享接口返回 `internal_server_error`；批量分享接口 HTTP/API 成功返回 200，但响应或前端结果里没有访问链接和密码。
- Error messages: `{code: 500, success: false, message: "internal_server_error", data: null}`.
- Timeline: 未提供；发生在当前分享功能版本。
- Reproduction: 在分享 UI 中创建单个分享；在账户列表中全选或多选后使用批量分享。

## Current Focus

- hypothesis: NODEAUTH_PUBLIC_ORIGIN 或请求 origin 的 URL 规范化失败会在分享记录写入后构造 publicUrl 时抛出 `invalid_public_origin`；单个创建把该异常冒泡为 500，批量创建逐行吞掉异常并返回 200/空 successes，因此前端没有访问链接和访问码可展示。批量覆盖层还只读取 `{ share }` 嵌套行，遇到扁平/包裹响应时会显示空链接/空码。
- test: Backend share route/service regressions, share overlay source contract, full backend Vitest suite, frontend share overlay rebuild, backend Worker/Docker/Netlify bundle rebuilds.
- expecting: Invalid configured origin falls back to request origin at route boundary; service URL construction is non-fatal after DB write; batch dialog normalizes nested and flat success rows before rendering publicUrl/rawAccessCode.
- next_action: complete
- reasoning_checkpoint: Root cause confirmed in `src/features/share/shareRoutes.ts`, `src/features/share/shareService.ts`, and `frontend/src/share-ui/share-management-ui.js`.
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-04T18:43:00+08:00
  observation: Existing mocked route/service tests already asserted batch successes include `share.rawAccessCode`, so the new symptom was not missing backend DTO fields in the happy-path mock contract.
- timestamp: 2026-05-04T18:45:00+08:00
  observation: `ShareService.createShare` wrote the share and then called `buildShareUrl(publicOrigin, rawToken)`; `buildShareUrl` throws `AppError('invalid_public_origin', 500)` for non-HTTPS origins except localhost. Single create exposes that as 500.
- timestamp: 2026-05-04T18:45:30+08:00
  observation: `createSharesForOwnerBatch` catches all per-item exceptions and returns generic failures; if every row hits the URL-origin exception, HTTP/API response is still 200 but `successes` is empty, leaving no access links or access codes to display.
- timestamp: 2026-05-04T18:46:00+08:00
  observation: The batch overlay rendered `row.share || {}` only. If the API/client envelope supplies created shares as flat rows or under `data`, the dialog opens but link/code fields render as empty strings.
- timestamp: 2026-05-04T18:49:56+08:00
  observation: Focused regressions and the full backend suite passed after fallback/normalization fixes; generated frontend and backend deployment assets were rebuilt.

## Eliminated

- Missing batch endpoint: eliminated. `POST /api/share/batch` exists and returns `successes`/`failures`.
- Backend happy-path DTO dropping `rawAccessCode`: eliminated. Existing and retained service/route tests assert raw token/access code are returned for successful creates.
- Previous `active_share_key` migration regressions: considered from prior sessions, but current code/tests already include the migration repairs and the new symptom maps to origin/link construction plus UI result normalization.

## Resolution

- root_cause: Share URL creation treated an invalid configured/public origin as a fatal 500 after share creation; batch creation swallowed the same per-row failure and returned 200 with no successful link/code rows, while the batch overlay also failed to normalize non-`{ share }` success row shapes.
- fix: Validate `NODEAUTH_PUBLIC_ORIGIN` at the route boundary and fall back to the request origin when it is invalid; make service-side public URL building non-fatal so one-time token/access-code creation still completes; normalize nested/flat batch success rows in the overlay before rendering and copying links/codes.
- verification: `npm --prefix backend run test -- src/features/share/shareRoutes.test.ts src/features/share/shareService.test.ts src/app/shareManagementUiOverlay.test.ts --reporter=verbose`; `npm --prefix frontend run build:share-ui`; `npm --prefix backend run build:worker`; `npm --prefix backend run build:docker`; `npm --prefix backend run build:netlify`; `npm --prefix backend test`.
- files_changed: src/features/share/shareRoutes.ts; src/features/share/shareService.ts; src/features/share/shareRoutes.test.ts; src/features/share/shareService.test.ts; frontend/src/share-ui/share-management-ui.js; frontend/dist/assets/share-management-ui.js; src/app/shareManagementUiOverlay.test.ts; backend/dist/worker/worker.js; backend/dist/worker/worker.js.map; backend/dist/docker/server.js; backend/dist/docker/server.js.map; backend/dist/netlify/api.mjs; backend/dist/netlify/api.mjs.map.
