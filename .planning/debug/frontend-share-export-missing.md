---
status: resolved
trigger: "检查为什么部署后前端没有展示分享导出"
created: "2026-05-04T00:00:00+08:00"
updated: "2026-05-04T02:25:00+08:00"
---

# Debug Session: frontend-share-export-missing

## Symptoms

DATA_START
Expected behavior: 部署后前端应该展示“分享导出”相关入口或功能，让用户能从前端使用账号分享/导出能力。

Actual behavior: 部署后前端没有展示分享导出。

Error messages: 未提供。

Timeline: 部署后发现；是否曾经工作过未提供。

Reproduction: 部署应用后打开前端页面，未看到分享导出入口。
DATA_END

## Current Focus

- hypothesis: Resolved: deployed clients can keep serving the old same-URL vault-list chunk from the PWA precache, so the newly patched share-link UI does not appear after deployment.
- test: Verified final frontend artifacts reference fresh chunk filenames and contain the share-link menu/API call.
- expecting: Deployment serves `index-c6243024.js` -> `home-39337a39.js` -> `vaultList-f8457e86.js`, and the service worker precaches those new URLs.
- next_action: complete
- reasoning_checkpoint: The checkout has backend TypeScript source but no editable frontend source tree; frontend deployment is artifact-based from `frontend/dist`.
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-04T02:03:00+08:00
  source: `find frontend -maxdepth 2 -type d`
  finding: Only `frontend/dist` and `frontend/dist/assets` exist; no editable frontend source tree is present in this distribution checkout.
- timestamp: 2026-05-04T02:04:00+08:00
  source: `frontend/dist/assets/vaultList-Co8wbF8j.js`
  finding: The local SPA artifact already contained the share menu label `分享链接` and the owner API call `POST /api/share`.
- timestamp: 2026-05-04T02:04:00+08:00
  source: `src/app/index.ts`, `backend/dist/worker/worker.js`
  finding: Backend share routes are mounted at `/api/share` in source and the Cloudflare worker bundle.
- timestamp: 2026-05-04T02:05:00+08:00
  source: `wrangler.toml`, `netlify.toml`, `vercel.json`, `Dockerfile`
  finding: All deployment targets publish prebuilt `frontend/dist`; they do not rebuild frontend source during deploy.
- timestamp: 2026-05-04T02:06:00+08:00
  source: `git show --stat HEAD`
  finding: Commit `0acbccf feat: add share link entry to vault UI` modified `frontend/dist/assets/vaultList-Co8wbF8j.js` but kept the same hashed filename.
- timestamp: 2026-05-04T02:06:00+08:00
  source: `frontend/dist/sw.js`
  finding: The service worker precache listed `assets/vaultList-Co8wbF8j.js` with `revision:null`, so an existing service-worker cache can retain the old file for the same URL.
- timestamp: 2026-05-04T02:11:00+08:00
  source: artifact consistency checks
  finding: After fix, no stale references to `index-B1iRy_WF.js`, `home-DtuBT6CP.js`, `mobileHub-CFAaBKH9.js`, or `vaultList-Co8wbF8j.js` remain in `frontend/dist`.
- timestamp: 2026-05-04T02:11:00+08:00
  source: `node -e` relative import resolver
  finding: Checked 115 frontend JS chunks; all relative JS imports resolve after renaming artifacts.
- timestamp: 2026-05-04T02:21:00+08:00
  source: browser console from deployed `https://2fa.eggai.icu`
  finding: Browser reported `Failed to load module script` because `https://2fa.eggai.icu/assets/home-39337a39.js` was served as `text/html`, which means a missing JS asset was handled by SPA fallback HTML.
- timestamp: 2026-05-04T02:21:00+08:00
  source: `curl -I` via proxy `127.0.0.1:7890`
  finding: The deployed `home-39337a39.js` and `index-c6243024.js` later returned `content-type: text/javascript`, indicating asset propagation eventually completed but the fallback behavior can still produce HTML for JS during missing/stale asset windows.
- timestamp: 2026-05-04T02:23:00+08:00
  source: `wrangler.toml`
  finding: Cloudflare Assets used `not_found_handling = "single-page-application"` and only ran the Worker first for `/api/*`, so missing `/assets/*.js` requests could be served as `/index.html`.

## Eliminated

- Missing backend share API route: eliminated because `/api/share` is mounted in `src/app/index.ts` and bundled in `backend/dist/worker/worker.js`.
- Missing local UI artifact: eliminated because `frontend/dist/assets/vaultList-*.js` contains `分享链接` and `POST /api/share`.
- Editable frontend source fix: not applicable in this checkout because no frontend source tree exists, only built SPA artifacts.

## Resolution

- root_cause: The share-link UI was added by patching the built `vaultList-Co8wbF8j.js` file without changing its hashed URL, while the service worker precached that URL with `revision:null`; deployed clients could therefore keep loading the old cached chunk that lacked the share export entry.
- fix: Renamed the changed frontend chunks to fresh content-derived filenames and updated `index.html`, `sw.js`, and dependent JS chunk references so clients fetch the new feature-bearing artifact chain.
- verification: `rg` confirmed no stale chunk filenames remain; `rg` confirmed `分享链接` and `/api/share` exist in `vaultList-f8457e86.js`; a Node import-resolution check verified 115 JS chunks have resolvable relative imports; `npm --prefix backend test -- --run src/app/index.test.ts src/features/share/shareRoutes.test.ts src/features/share/shareService.test.ts src/shared/db/repositories/shareRepository.test.ts` passed 58 tests.
- follow_up_root_cause: Cloudflare SPA asset fallback can return `/index.html` with `text/html` for missing `/assets/*.js` during asset propagation or stale-client windows, producing strict module MIME errors.
- follow_up_fix: Added `/assets/*`, `/sw.js`, and `/manifest.webmanifest` to `run_worker_first`, and added a Worker-level guard that converts static asset HTML fallback responses into `404 Asset Not Found` with `Cache-Control: no-store`.
- follow_up_verification: `npm --prefix backend test -- --run src/app/index.test.ts src/features/share/shareRoutes.test.ts src/features/share/shareService.test.ts src/shared/db/repositories/shareRepository.test.ts` passed 59 tests, including a regression test for missing JavaScript asset fallback.
- files_changed: `frontend/dist/index.html`, `frontend/dist/sw.js`, renamed frontend chunks, first-party chunks that import the renamed entry chunk, `wrangler.toml`, `src/app/index.ts`, `src/app/index.test.ts`, and regenerated backend Worker/Docker/Netlify bundles.
