---
status: resolved
trigger: "实际启动后，点击分享账户链接后，访问链接界面无法显示，浏览器会出现一堆错误，请你启动 playwright 我手动登录账户后验证功能是否实现"
created: "2026-05-04T02:53:44+08:00"
updated: "2026-05-04T03:12:00+08:00"
---

# Debug Session: share-link-page-errors

## Symptoms

DATA_START
Expected behavior: 用户登录后点击分享账户链接，生成或打开的分享访问链接页面应该能正常显示，朋友可以访问单个共享账户的登录详情。

Actual behavior: 实际启动后，点击分享账户链接后，访问链接界面无法显示。

Error messages: 浏览器会出现一堆错误；具体 console/network 错误待 Playwright 复现采集。

Timeline: 实际启动后发现；是否曾经工作过未确认。

Reproduction: 启动应用，手动登录账户，点击分享账户链接，然后访问生成的链接页面。
DATA_END

## Current Focus

- hypothesis: Cloudflare Assets handles `/share/*` before the Worker, so public share links return the SPA shell instead of the Worker-rendered recipient page.
- test: Request deployed `/share/test-token-123` with curl and Playwright using proxy `http://127.0.0.1:7890`, then compare with local Worker bundle and `wrangler.toml`.
- expecting: Current deployment returns SPA `index.html`; adding `/share/*` to `run_worker_first` should route share pages through Hono before Assets fallback.
- next_action: deploy the updated Worker config, then verify `/share/:token` returns the dedicated share page.
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-04T02:55:51+08:00
  source: Playwright snapshot at `http://127.0.0.1:8787/`
  finding: Local Wrangler dev starts successfully with local D1/assets, but the app redirects to `/health` and blocks login because required env is absent: `NODEAUTH_LICENSE`, `ENCRYPTION_KEY`, `JWT_SECRET`, `OAUTH_ALLOWED_USERS`, and an OAuth provider.
- timestamp: 2026-05-04T03:09:56+08:00
  source: `curl --noproxy '*' -D - https://2fa.eggai.icu/share/test-token-123`
  finding: The deployed `/share/test-token-123` response is the SPA `index.html` from Cloudflare Assets with `cf-cache-status: HIT`, not the Worker-rendered public share page. The local Worker bundle contains `app.get("/share/:token")`, but `wrangler.toml` only runs the Worker first for `/api/*`, `/assets/*`, `/sw.js`, and `/manifest.webmanifest`, so `/share/*` is intercepted by Assets SPA fallback before Hono can render the share page.
- timestamp: 2026-05-04T03:11:17+08:00
  source: Playwright snapshot at `https://2fa.eggai.icu/share/test-token-123` using proxy `http://127.0.0.1:7890`
  finding: The deployed share URL renders the normal NodeAuth SPA shell with an empty `<main>` area and no `共享账户访问` form. Network requests show the page loading SPA assets such as `/assets/index-c6243024.js`.
- timestamp: 2026-05-04T03:13:25+08:00
  source: Playwright snapshot and sanitized API probe for the user-provided real share URL using proxy `http://127.0.0.1:7890`
  finding: The real deployed share URL also renders the SPA shell with an empty `<main>` and no console errors. A direct POST to `/api/share/public/[share-token]/access` with the provided access code returned HTTP 200 and `{ success: true }`; sanitized response metadata shows `service`, `account`, and `otp` fields present and no `password` field.
- timestamp: 2026-05-04T03:10:55+08:00
  source: `npm --prefix backend test -- src/app/index.test.ts`
  finding: App route and Wrangler configuration regression tests pass: 1 test file, 16 tests.

## Eliminated

- hypothesis: Public share page source was missing from generated backend bundles.
  evidence: `rg` found `renderSharePublicPage` and `app.get("/share/:token")` in Worker, Docker, and Netlify generated bundles.

## Resolution

- root_cause: Cloudflare Workers Assets `run_worker_first` omitted `/share/*`, causing deployed public share URLs to bypass the Worker route and return the Vue SPA shell instead of the dedicated recipient page.
- fix: Add `/share/*` to `wrangler.toml` `run_worker_first` and cover it with a source contract test.
- verification: `npm --prefix backend test -- src/app/index.test.ts` passed. The real share access API succeeds when called directly, proving the backend share token/access-code path is working. Online page verification still requires redeploying Cloudflare with the updated `wrangler.toml`, then confirming `/share/:token` no longer returns the SPA shell.
- files_changed: `wrangler.toml`, `src/app/index.test.ts`
