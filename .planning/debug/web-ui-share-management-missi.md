---
status: resolved
trigger: "当前项目的web ui上只暴露了一个分享账户链接的功能，其他的管理，审计都没有看到"
created: "2026-05-04"
updated: "2026-05-04"
---

# Debug Session: web-ui-share-management-missi

## Symptoms

DATA_START
Expected behavior: Web UI should expose share-link management capabilities beyond creating/copying one share account link, including owner management and visible audit/history where implemented or promised.

Actual behavior: Current project Web UI only exposes one "share account link" feature; other management and audit capabilities are not visible.

Error messages: 未提供。

Timeline: 用户在当前项目 Web UI 验证时发现；是否曾经工作过未提供。

Reproduction: 打开当前项目 Web UI，进入账户/保险库相关页面，查看分享账户链接功能；只能看到一个分享账户链接入口，看不到管理、撤销、列表、审计等其他入口。
DATA_END

## Current Focus

- hypothesis: Confirmed. The backend API implements owner share list/detail/revoke metadata, but the bundled Vue vault-list UI only exposed create/copy.
- test:
- expecting:
- next_action: complete
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-04T03:49:05+08:00
  type: source
  detail: `src/features/share/shareRoutes.ts` exposes authenticated owner endpoints `POST /api/share`, `GET /api/share`, `GET /api/share/:id`, and `DELETE /api/share/:id`; route tests cover safe list/detail/revoke metadata.
- timestamp: 2026-05-04T03:49:05+08:00
  type: source
  detail: `src/features/share/shareTypes.ts` owner metadata includes `status`, `createdAt`, `expiresAt`, `revokedAt`, `lastAccessedAt`, and `accessCount`, but no raw token/access-code on list/detail/revoke.
- timestamp: 2026-05-04T03:49:05+08:00
  type: source
  detail: `frontend/dist/assets/vaultList-f8457e86.js` had only the dropdown command `share` and only called `POST /api/share`, so existing management/revoke metadata APIs were unreachable from the Web UI.
- timestamp: 2026-05-04T03:49:05+08:00
  type: scope
  detail: Phase UI specs state editable frontend source is absent in this checkout; practical UI remediation is a narrow generated-asset patch until Vue source is restored.
- timestamp: 2026-05-04T03:49:05+08:00
  type: verification
  detail: `node --check frontend/dist/assets/vaultList-f8457e86.js` passed after adding the management menu path.
- timestamp: 2026-05-04T03:49:05+08:00
  type: verification
  detail: `npm --prefix backend test -- src/features/share/shareRoutes.test.ts` passed: 1 file, 15 tests.

## Eliminated

- Backend missing owner management APIs: eliminated by `src/features/share/shareRoutes.ts` and route tests.
- Public audit-event timeline UI: not implemented as a fix because the backend does not expose a dedicated owner audit-event route; owner-visible audit/history is limited to safe metadata (`lastAccessedAt`, `accessCount`, status timestamps) in the current API contract.

## Resolution

- root_cause: The share owner-management API existed, but the built Web UI vault action menu only called the create endpoint, leaving list/status/access-count/revoke capabilities unreachable.
- fix: Added a generated-frontend vault dropdown action "管理分享" that fetches `GET /api/share`, filters entries for the selected account, displays safe metadata, and can revoke the newest active link through `DELETE /api/share/:id` with revocation limitation copy.
- verification: `node --check frontend/dist/assets/vaultList-f8457e86.js`; `npm --prefix backend test -- src/features/share/shareRoutes.test.ts`.
- files_changed: `frontend/dist/assets/vaultList-f8457e86.js`; `.planning/debug/web-ui-share-management-missi.md`.
