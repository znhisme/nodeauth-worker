---
status: resolved
trigger: "对其其他菜单，其他的页面内自然切换，这个是刷新式切换，请和其他的菜单一致没同意规范"
created: "2026-05-04T07:13:08Z"
updated: "2026-05-04T07:23:27Z"
---

# Debug Session: share-menu-refresh-switch

## Symptoms

- expected_behavior: The left menu "管理分享" item should switch views naturally inside the SPA, matching other menu items.
- actual_behavior: Clicking "管理分享" behaves like a refresh-style navigation instead of the in-page menu transition used elsewhere.
- error_messages: No error text was provided. Screenshot highlights the "管理分享" menu item in the left sidebar.
- timeline: Reported during Phase 04 share management UI polish on 2026-05-04.
- reproduction: Open the app sidebar and click "管理分享"; compare transition behavior with other left-menu items such as "我的账号", "添加账号", "数据迁移", "云端备份", "实用工具", or "系统设置".

## Current Focus

- hypothesis: The share menu entry is injected outside Vue and opens a fixed full-screen overlay instead of replacing the SPA `.main-content` pane like native menu items.
- test: Inspect share overlay source/CSS, update it to mount the share view inside `.main-content`, rebuild generated assets, and verify with focused tests plus Playwright DOM harness.
- expecting: The share view parent is `.main-content`, its position is relative, previous view content is hidden only while active, and clicking another native menu item restores the previous pane.
- next_action: complete
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-04T07:16:00Z
  observation: `frontend/src/share-ui/share-management-ui.js` injected a standalone `.na-share-nav` button and `openManager()` only toggled `.na-share-overlay.is-open`; the CSS made `.na-share-overlay` `position: fixed` with `top/right/bottom/left: 0` and high z-index.
  supports: The share manager behaved like a full-screen overlay instead of an in-page SPA tab.
- timestamp: 2026-05-04T07:16:30Z
  observation: The native desktop menu in `frontend/dist/assets/home-4662a7b2.js` renders Element Plus menu items and emits `setActiveTab`, while `desktopBody` swaps content inside `.main-content` using `app_active_tab`.
  supports: Matching menu behavior requires replacing the main content pane, not covering the whole viewport.
- timestamp: 2026-05-04T07:22:05Z
  observation: `npm run test -- shareManagementUiOverlay.test.ts` passed after adding a source contract for `.main-content` mounting.
  supports: Regression coverage exists for the intended integration point.
- timestamp: 2026-05-04T07:23:00Z
  observation: Playwright harness showed opening share manager results in `overlayParent: "main-content"`, `overlayPosition: "relative"`, `overlayDisplay: "block"`, `hiddenCount: 1`, and clicking a native menu item restores `hiddenCount: 0` with the overlay moved back to `.na-share-ui-root`.
  supports: The share menu now transitions within the SPA content pane and cleans up when another menu item is selected.

## Eliminated

## Resolution

- root_cause: The injected share management menu item opened a fixed full-screen overlay from outside the Vue menu/tab system, so it covered the app like a refresh/navigation surface instead of switching the SPA content pane.
- fix: Mount the share manager overlay into `.main-content` when opened, hide the previous view with `na-share-view-hidden`, use relative overlay layout, restore the overlay on close/native menu selection, and rebuild the generated share UI assets.
- verification: `npm run test -- shareManagementUiOverlay.test.ts` passed; Playwright DOM harness confirmed open/close behavior inside `.main-content`.
- files_changed: frontend/src/share-ui/share-management-ui.js; frontend/src/share-ui/share-management-ui.css; frontend/dist/assets/share-management-ui.js; frontend/dist/assets/share-management-ui.css; src/app/shareManagementUiOverlay.test.ts
