# Technology Stack

**Analysis Date:** 2026-05-02

## Languages

**Primary:**
- TypeScript - Backend source is compiled into `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, and `backend/dist/netlify/api.mjs`; original source paths are preserved in source maps such as `backend/dist/worker/worker.js.map` as `src/app/worker.ts`, `src/app/index.ts`, and `src/features/*`.
- JavaScript - Distribution and deployment scripts live in `scripts/inject_vars.js` and `scripts/decrypt_backup.js`; checked-in backend output is JavaScript in `backend/dist/`.
- Vue single-page app output - Frontend source is not present, but the built SPA in `frontend/dist/index.html` references Vite chunks including `frontend/dist/assets/vue-core-Daban9YF.js`, `frontend/dist/assets/element-plus-Dh0klhaa.js`, and app feature chunks.

**Secondary:**
- SQL - Cloudflare D1/SQLite schema is committed in `backend/schema.sql`; runtime migrations are bundled from `src/shared/db/migrator.ts` into `backend/dist/worker/worker.js` and `backend/dist/docker/server.js`.
- TOML - Cloudflare Workers config is in `wrangler.toml`; Netlify config is in `netlify.toml`.
- YAML - Docker Compose variants live in `docker-compose.yml`, `docker-compose-mysql-local.yml`, `docker-compose-mysql-remote.yml`, `docker-compose-postgresql-local.yml`, and `docker-compose-postgresql-remote.yml`; GitHub Actions workflows live under `.github/workflows/`.

## Runtime

**Environment:**
- Cloudflare Workers runtime - Primary deployment target configured by `wrangler.toml`, with `main = "backend/dist/worker/worker.js"`, `compatibility_date = "2026-03-17"`, and `compatibility_flags = ["nodejs_compat"]`.
- Node.js 24 - Docker runtime uses `node:24-bookworm-slim` in `Dockerfile`; Netlify workflow sets `node-version: 24` in `.github/workflows/netlify.yml`.
- Node.js local tooling - Current workspace shell reports Node `v22.22.2` and npm `10.9.7`; project deployment files target Node 24 for Docker and Netlify.

**Package Manager:**
- npm - Root `package.json` and `package-lock.json` are present; `package-lock.json` is lockfileVersion 3.
- Backend package uses npm through `backend/package.json`; no separate `backend/package-lock.json` is present in this workspace.
- Docker installs backend production dependencies with `npm install --omit=dev` in `Dockerfile`.

## Frameworks

**Core:**
- Hono `^4.12.12` - HTTP router and middleware stack for API routes; original source-map paths include `src/app/index.ts`, `src/features/auth/authRoutes.ts`, `src/features/vault/vaultRoutes.ts`, `src/features/backup/backupRoutes.ts`, and `src/features/health/healthRoutes.ts`.
- `@hono/node-server` `^1.19.13` - Node server adapter for the Docker build; imported by original `src/app/server.ts` in `backend/dist/docker/server.js.map`.
- Cloudflare Workers + Workers Assets - `wrangler.toml` binds `ASSETS` to `frontend/dist` and routes `/api/*` through the Worker.
- Netlify Functions - `netlify.toml` publishes `frontend/dist` and deploys functions from `backend/dist/netlify`, with `/api/*` redirected to `/.netlify/functions/api/:splat`.
- Vue 3 + Vite-built SPA - Frontend build artifacts include `frontend/dist/assets/vue-core-Daban9YF.js`, `frontend/dist/assets/index-C7u7UEUi.js`, and Vite-style modulepreload links in `frontend/dist/index.html`.
- Element Plus - UI bundle is present as `frontend/dist/assets/element-plus-Dh0klhaa.js` and `frontend/dist/assets/element-plus-Dh61In7b.css`.

**Testing:**
- Vitest `^4.1.0` - Backend test command is `vitest run` in `backend/package.json`; no test files are included in this distribution checkout.
- `@vitest/coverage-v8` `^4.1.0` - Coverage dependency declared in `backend/package.json`; no coverage command is declared.

**Build/Dev:**
- Wrangler `4.75.0` - Root deploy script runs `npx wrangler deploy --minify` from `package.json`; backend dev script uses `wrangler dev --config ../wrangler.dev.toml` in `backend/package.json`.
- tsup `^8.4.0` - Backend build dependency declared in `backend/package.json`; build scripts reference `backend/scripts/build-worker.js`, `backend/scripts/build-docker.js`, and `backend/scripts/build-netlify.js`, but those source build scripts are not present in this distribution checkout.
- TypeScript `^5.9.3` - Backend source language and build dependency in `backend/package.json`.
- Drizzle Kit `^0.31.9` - Database schema tooling dependency in `backend/package.json`; runtime migrations are bundled into `backend/dist/*`.
- Variable injection script - `scripts/inject_vars.js` replaces `__DIST_COMMIT_HASH__`, `__DIST_PLATFORM__`, and `__DIST_ICON_SUFFIX__` in `frontend/dist` and `backend/dist` during Cloudflare, Docker, and Netlify builds.

## Key Dependencies

**Critical:**
- `hono` `^4.12.12` - API framework and middleware routing in the bundled backend.
- `drizzle-orm` `^0.45.2` - Database ORM for D1/SQLite, MySQL, and PostgreSQL; source-map paths include `src/shared/db/db.ts`, `src/shared/db/factory.ts`, and schema modules under `src/shared/db/schema/`.
- `@simplewebauthn/server` `^13.3.0` - Passkey registration and login in original `src/features/auth/webAuthnService.ts`.
- `viem` `^2.47.6` - Web3 wallet signature verification in original `src/features/auth/web3WalletAuthService.ts`.
- `better-sqlite3` `^12.8.0` - SQLite storage for Docker/Node runtime in original `src/shared/db/factory.ts`; compiled native dependency is installed in `Dockerfile`.
- `mysql2` `^3.20.0` and `pg` `^8.20.0` - Optional Docker/Node database engines configured by `DB_ENGINE` in `docker-compose*.yml`.
- `aws4fetch` `^1.0.20` and `fast-xml-parser` `^5.7.1` - S3-compatible backup provider implementation in original `src/features/backup/providers/s3Provider.ts`.
- `webdav` `^5.9.0` - WebDAV backup provider implementation in original `src/features/backup/providers/webDavProvider.ts`.
- `nodemailer` `^8.0.5` - Email backup provider in original `src/features/backup/providers/emailProvider.ts`.

**Infrastructure:**
- `wrangler` `4.75.0` - Cloudflare Workers deployment in `package.json`, `backend/package.json`, and `.github/workflows/deploy.yml`.
- `@cloudflare/workers-types` `^4.20260411.1` - Cloudflare Worker type definitions in `backend/package.json`.
- `dotenv` `^17.4.1` - Docker/Node environment loading support declared in `backend/package.json`.
- `node-cron` `^4.2.1` - Scheduled backup execution for Docker/Node runtime in original `src/app/server.ts`; Cloudflare uses Wrangler cron triggers in `wrangler.toml`.
- `@types/node` `^25.6.0`, `@types/pg` `^8.20.0`, `@types/better-sqlite3` `^7.6.13`, and `@types/nodemailer` `^6.4.17` - Backend type packages in `backend/package.json`.

## Configuration

**Environment:**
- Cloudflare Workers secrets are injected by `.github/workflows/deploy.yml` and bound to runtime `env` in original `src/app/config.ts`.
- Required production env vars are `NODEAUTH_LICENSE`, `JWT_SECRET`, `ENCRYPTION_KEY`, and `OAUTH_ALLOWED_USERS`; `.github/workflows/deploy.yml` also requires `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_D1_DATABASE_ID` for deployment.
- Optional auth and backup env vars include `OAUTH_GITHUB_*`, `OAUTH_GOOGLE_*`, `OAUTH_CLOUDFLARE_*`, `OAUTH_GITEE_*`, `OAUTH_NODELOC_*`, `OAUTH_TELEGRAM_*`, `OAUTH_WALLETCONNECT_*`, `OAUTH_MICROSOFT_*`, `OAUTH_BAIDU_*`, and `OAUTH_DROPBOX_*`; env names are declared in original `src/app/config.ts` and surfaced in `docker-compose*.yml`.
- Docker database env vars are `DB_ENGINE`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`, and `SQLITE_DB_PATH`; original source-map path is `src/shared/db/factory.ts`.
- No `.env` files were detected in the workspace; config examples are embedded as placeholder environment entries in `docker-compose*.yml`.

**Build:**
- Cloudflare build config: `wrangler.toml` runs `node scripts/inject_vars.js --platform=cloudflare`, binds D1 as `DB`, binds Workers Assets as `ASSETS`, and schedules cron `0 2 * * *`.
- Netlify build config: `netlify.toml` runs `npm install --prefix backend && node scripts/inject_vars.js --platform=netlify`, publishes `frontend/dist`, and uses `backend/dist/netlify` functions.
- Docker build config: `Dockerfile` installs backend production dependencies, copies `frontend/dist`, `backend/dist`, and `backend/schema.sql`, then runs `node backend/dist/docker/server.js`.
- GitHub Actions config: `.github/workflows/deploy.yml` deploys Cloudflare Workers, `.github/workflows/docker.yml` publishes Docker images, and `.github/workflows/netlify.yml` deploys Netlify.
- Root deploy command: `npm run deploy` runs `npx wrangler deploy --minify` from `package.json`.

## Platform Requirements

**Development:**
- Install root tooling with npm from `package.json` if running Cloudflare deployment commands.
- Install backend dependencies from `backend/package.json` when running backend build/test/dev commands.
- `backend/package.json` dev script expects `../wrangler.dev.toml`, but that file is not present in this workspace.
- Build scripts named in `backend/package.json` expect `backend/scripts/build-*.js`, but `backend/scripts/` is not present in this distribution checkout.
- The checked-in project is runnable from prebuilt artifacts through Cloudflare (`wrangler.toml`), Docker (`Dockerfile`), or Netlify (`netlify.toml`) without frontend source.

**Production:**
- Primary target is Cloudflare Workers with D1 and Workers Assets, configured by `wrangler.toml` and `.github/workflows/deploy.yml`.
- Alternate targets are Docker on Node 24 with SQLite/MySQL/PostgreSQL, configured by `Dockerfile` and `docker-compose*.yml`.
- Netlify deployment uses Netlify Functions from `backend/dist/netlify` and static SPA assets from `frontend/dist`, configured by `netlify.toml` and `.github/workflows/netlify.yml`.

---

*Stack analysis: 2026-05-02*
