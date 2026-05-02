<!-- GSD:project-start source:PROJECT.md -->
## Project

**NodeAuth Account Share Links**

NodeAuth is an existing high-security, lightweight 2FA/TOTP and vault management tool for users who self-host on Cloudflare Workers, Docker, or Netlify. This milestone adds an API-backed way to share one specific account/vault item through an HTTP link so the owner can safely let a friend log in with that account when needed.

The feature must fit NodeAuth's security posture: link sharing should be convenient, but not turn a protected vault item into an uncontrolled public secret.

**Core Value:** A NodeAuth user can create a safe, revocable HTTP link for one account item and a friend can use that link to access only that shared account's login details.

### Constraints

- **Security**: Shared links expose sensitive login material, so links need high-entropy tokens, expiration, revocation, and access-code protection by default.
- **Scope**: Sharing is limited to a single account/vault item per link because the requested use case is account lending, not vault collaboration.
- **Compatibility**: The backend must continue to run on Cloudflare Workers, Docker, and Netlify; avoid platform-specific storage or crypto assumptions unless wrapped in existing abstractions.
- **Architecture**: Follow the existing Hono route, feature module, repository, and centralized error patterns described in `.planning/codebase/ARCHITECTURE.md`.
- **Distribution checkout**: Frontend and TypeScript source may be missing from this workspace; planning must verify available editable source before promising UI changes.
- **Privacy**: Shared-link responses must not leak vault lists, owner identity beyond what is necessary, session cookies, backup data, or internal IDs that are not needed by the recipient.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript - Backend source is compiled into `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, and `backend/dist/netlify/api.mjs`; original source paths are preserved in source maps such as `backend/dist/worker/worker.js.map` as `src/app/worker.ts`, `src/app/index.ts`, and `src/features/*`.
- JavaScript - Distribution and deployment scripts live in `scripts/inject_vars.js` and `scripts/decrypt_backup.js`; checked-in backend output is JavaScript in `backend/dist/`.
- Vue single-page app output - Frontend source is not present, but the built SPA in `frontend/dist/index.html` references Vite chunks including `frontend/dist/assets/vue-core-Daban9YF.js`, `frontend/dist/assets/element-plus-Dh0klhaa.js`, and app feature chunks.
- SQL - Cloudflare D1/SQLite schema is committed in `backend/schema.sql`; runtime migrations are bundled from `src/shared/db/migrator.ts` into `backend/dist/worker/worker.js` and `backend/dist/docker/server.js`.
- TOML - Cloudflare Workers config is in `wrangler.toml`; Netlify config is in `netlify.toml`.
- YAML - Docker Compose variants live in `docker-compose.yml`, `docker-compose-mysql-local.yml`, `docker-compose-mysql-remote.yml`, `docker-compose-postgresql-local.yml`, and `docker-compose-postgresql-remote.yml`; GitHub Actions workflows live under `.github/workflows/`.
## Runtime
- Cloudflare Workers runtime - Primary deployment target configured by `wrangler.toml`, with `main = "backend/dist/worker/worker.js"`, `compatibility_date = "2026-03-17"`, and `compatibility_flags = ["nodejs_compat"]`.
- Node.js 24 - Docker runtime uses `node:24-bookworm-slim` in `Dockerfile`; Netlify workflow sets `node-version: 24` in `.github/workflows/netlify.yml`.
- Node.js local tooling - Current workspace shell reports Node `v22.22.2` and npm `10.9.7`; project deployment files target Node 24 for Docker and Netlify.
- npm - Root `package.json` and `package-lock.json` are present; `package-lock.json` is lockfileVersion 3.
- Backend package uses npm through `backend/package.json`; no separate `backend/package-lock.json` is present in this workspace.
- Docker installs backend production dependencies with `npm install --omit=dev` in `Dockerfile`.
## Frameworks
- Hono `^4.12.12` - HTTP router and middleware stack for API routes; original source-map paths include `src/app/index.ts`, `src/features/auth/authRoutes.ts`, `src/features/vault/vaultRoutes.ts`, `src/features/backup/backupRoutes.ts`, and `src/features/health/healthRoutes.ts`.
- `@hono/node-server` `^1.19.13` - Node server adapter for the Docker build; imported by original `src/app/server.ts` in `backend/dist/docker/server.js.map`.
- Cloudflare Workers + Workers Assets - `wrangler.toml` binds `ASSETS` to `frontend/dist` and routes `/api/*` through the Worker.
- Netlify Functions - `netlify.toml` publishes `frontend/dist` and deploys functions from `backend/dist/netlify`, with `/api/*` redirected to `/.netlify/functions/api/:splat`.
- Vue 3 + Vite-built SPA - Frontend build artifacts include `frontend/dist/assets/vue-core-Daban9YF.js`, `frontend/dist/assets/index-C7u7UEUi.js`, and Vite-style modulepreload links in `frontend/dist/index.html`.
- Element Plus - UI bundle is present as `frontend/dist/assets/element-plus-Dh0klhaa.js` and `frontend/dist/assets/element-plus-Dh61In7b.css`.
- Vitest `^4.1.0` - Backend test command is `vitest run` in `backend/package.json`; no test files are included in this distribution checkout.
- `@vitest/coverage-v8` `^4.1.0` - Coverage dependency declared in `backend/package.json`; no coverage command is declared.
- Wrangler `4.75.0` - Root deploy script runs `npx wrangler deploy --minify` from `package.json`; backend dev script uses `wrangler dev --config ../wrangler.dev.toml` in `backend/package.json`.
- tsup `^8.4.0` - Backend build dependency declared in `backend/package.json`; build scripts reference `backend/scripts/build-worker.js`, `backend/scripts/build-docker.js`, and `backend/scripts/build-netlify.js`, but those source build scripts are not present in this distribution checkout.
- TypeScript `^5.9.3` - Backend source language and build dependency in `backend/package.json`.
- Drizzle Kit `^0.31.9` - Database schema tooling dependency in `backend/package.json`; runtime migrations are bundled into `backend/dist/*`.
- Variable injection script - `scripts/inject_vars.js` replaces `__DIST_COMMIT_HASH__`, `__DIST_PLATFORM__`, and `__DIST_ICON_SUFFIX__` in `frontend/dist` and `backend/dist` during Cloudflare, Docker, and Netlify builds.
## Key Dependencies
- `hono` `^4.12.12` - API framework and middleware routing in the bundled backend.
- `drizzle-orm` `^0.45.2` - Database ORM for D1/SQLite, MySQL, and PostgreSQL; source-map paths include `src/shared/db/db.ts`, `src/shared/db/factory.ts`, and schema modules under `src/shared/db/schema/`.
- `@simplewebauthn/server` `^13.3.0` - Passkey registration and login in original `src/features/auth/webAuthnService.ts`.
- `viem` `^2.47.6` - Web3 wallet signature verification in original `src/features/auth/web3WalletAuthService.ts`.
- `better-sqlite3` `^12.8.0` - SQLite storage for Docker/Node runtime in original `src/shared/db/factory.ts`; compiled native dependency is installed in `Dockerfile`.
- `mysql2` `^3.20.0` and `pg` `^8.20.0` - Optional Docker/Node database engines configured by `DB_ENGINE` in `docker-compose*.yml`.
- `aws4fetch` `^1.0.20` and `fast-xml-parser` `^5.7.1` - S3-compatible backup provider implementation in original `src/features/backup/providers/s3Provider.ts`.
- `webdav` `^5.9.0` - WebDAV backup provider implementation in original `src/features/backup/providers/webDavProvider.ts`.
- `nodemailer` `^8.0.5` - Email backup provider in original `src/features/backup/providers/emailProvider.ts`.
- `wrangler` `4.75.0` - Cloudflare Workers deployment in `package.json`, `backend/package.json`, and `.github/workflows/deploy.yml`.
- `@cloudflare/workers-types` `^4.20260411.1` - Cloudflare Worker type definitions in `backend/package.json`.
- `dotenv` `^17.4.1` - Docker/Node environment loading support declared in `backend/package.json`.
- `node-cron` `^4.2.1` - Scheduled backup execution for Docker/Node runtime in original `src/app/server.ts`; Cloudflare uses Wrangler cron triggers in `wrangler.toml`.
- `@types/node` `^25.6.0`, `@types/pg` `^8.20.0`, `@types/better-sqlite3` `^7.6.13`, and `@types/nodemailer` `^6.4.17` - Backend type packages in `backend/package.json`.
## Configuration
- Cloudflare Workers secrets are injected by `.github/workflows/deploy.yml` and bound to runtime `env` in original `src/app/config.ts`.
- Required production env vars are `NODEAUTH_LICENSE`, `JWT_SECRET`, `ENCRYPTION_KEY`, and `OAUTH_ALLOWED_USERS`; `.github/workflows/deploy.yml` also requires `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_D1_DATABASE_ID` for deployment.
- Optional auth and backup env vars include `OAUTH_GITHUB_*`, `OAUTH_GOOGLE_*`, `OAUTH_CLOUDFLARE_*`, `OAUTH_GITEE_*`, `OAUTH_NODELOC_*`, `OAUTH_TELEGRAM_*`, `OAUTH_WALLETCONNECT_*`, `OAUTH_MICROSOFT_*`, `OAUTH_BAIDU_*`, and `OAUTH_DROPBOX_*`; env names are declared in original `src/app/config.ts` and surfaced in `docker-compose*.yml`.
- Docker database env vars are `DB_ENGINE`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`, and `SQLITE_DB_PATH`; original source-map path is `src/shared/db/factory.ts`.
- No `.env` files were detected in the workspace; config examples are embedded as placeholder environment entries in `docker-compose*.yml`.
- Cloudflare build config: `wrangler.toml` runs `node scripts/inject_vars.js --platform=cloudflare`, binds D1 as `DB`, binds Workers Assets as `ASSETS`, and schedules cron `0 2 * * *`.
- Netlify build config: `netlify.toml` runs `npm install --prefix backend && node scripts/inject_vars.js --platform=netlify`, publishes `frontend/dist`, and uses `backend/dist/netlify` functions.
- Docker build config: `Dockerfile` installs backend production dependencies, copies `frontend/dist`, `backend/dist`, and `backend/schema.sql`, then runs `node backend/dist/docker/server.js`.
- GitHub Actions config: `.github/workflows/deploy.yml` deploys Cloudflare Workers, `.github/workflows/docker.yml` publishes Docker images, and `.github/workflows/netlify.yml` deploys Netlify.
- Root deploy command: `npm run deploy` runs `npx wrangler deploy --minify` from `package.json`.
## Platform Requirements
- Install root tooling with npm from `package.json` if running Cloudflare deployment commands.
- Install backend dependencies from `backend/package.json` when running backend build/test/dev commands.
- `backend/package.json` dev script expects `../wrangler.dev.toml`, but that file is not present in this workspace.
- Build scripts named in `backend/package.json` expect `backend/scripts/build-*.js`, but `backend/scripts/` is not present in this distribution checkout.
- The checked-in project is runnable from prebuilt artifacts through Cloudflare (`wrangler.toml`), Docker (`Dockerfile`), or Netlify (`netlify.toml`) without frontend source.
- Primary target is Cloudflare Workers with D1 and Workers Assets, configured by `wrangler.toml` and `.github/workflows/deploy.yml`.
- Alternate targets are Docker on Node 24 with SQLite/MySQL/PostgreSQL, configured by `Dockerfile` and `docker-compose*.yml`.
- Netlify deployment uses Netlify Functions from `backend/dist/netlify` and static SPA assets from `frontend/dist`, configured by `netlify.toml` and `.github/workflows/netlify.yml`.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Distribution checkout contains compiled/generated bundles under `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, `backend/dist/netlify/api.mjs`, and `frontend/dist/`; treat these as generated artifacts when adding source changes.
- Embedded TypeScript source paths in `backend/dist/worker/worker.js.map` use feature folders and lower camelCase file names: `src/features/vault/vaultRoutes.ts`, `src/features/vault/vaultService.ts`, `src/features/auth/sessionService.ts`, `src/features/backup/providers/googleDriveProvider.ts`.
- Route modules use `*Routes.ts` names: `src/features/auth/authRoutes.ts`, `src/features/backup/backupRoutes.ts`, `src/features/health/healthRoutes.ts`.
- Service modules use `*Service.ts` names: `src/features/vault/vaultService.ts`, `src/features/backup/backupService.ts`, `src/features/auth/webAuthnService.ts`.
- Repository modules use `*Repository.ts` names under `src/shared/db/repositories/`: `src/shared/db/repositories/vaultRepository.ts`, `src/shared/db/repositories/backupRepository.ts`, `src/shared/db/repositories/sessionRepository.ts`.
- Provider modules use `*Provider.ts` names under feature-specific provider folders: `src/features/auth/providers/githubProvider.ts`, `src/features/backup/providers/s3Provider.ts`.
- Root operational scripts use snake_case JavaScript names: `scripts/decrypt_backup.js`, `scripts/inject_vars.js`.
- Use lower camelCase for functions and methods: `getEffectiveCSP` in `src/app/config.ts`, `authMiddleware` in `src/shared/middleware/auth.ts`, `generateTOTP` in `src/shared/utils/otp/protocols/totp.ts`, `normalizeOtpAccount` in `src/shared/utils/otp/index.ts`.
- Factory/helper functions should start with `get`, `create`, `detect`, `normalize`, `validate`, `generate`, or `parse` when that describes the action: `getOAuthProvider` in `src/features/auth/providers/index.ts`, `detectPlatform` in `scripts/inject_vars.js`, `parseOTPAuthURI` in `src/shared/utils/otp/index.ts`.
- Route-local service factories use small `getService(c)` helpers and instantiate repositories from `c.env.DB`, as shown in `src/features/vault/vaultRoutes.ts`.
- Async functions return promises explicitly in TypeScript where the source annotates public utility APIs: `generateTOTP(...): Promise<string>` in `src/shared/utils/otp/protocols/totp.ts`, `findAll(): Promise<VaultItem[]>` in `src/shared/db/repositories/vaultRepository.ts`.
- Use lower camelCase for locals and parameters: `securityResult`, `statusCode`, `isAppError`, `rawJwt`, `rootKey`, `normalizedService`.
- Use all caps with underscores for constants and env-style replacement keys: `SECURITY_CONFIG`, `CSP_POLICY`, `CRYPTO_CONFIG`, `PLATFORM_REGISTRY`, `__DIST_COMMIT_HASH__`.
- Use domain-specific plural names for collections: `providers` in `src/features/auth/providers/index.ts`, `conditions` and `updates` in `src/shared/db/repositories/vaultRepository.ts`.
- Environment variables are all caps with underscores and live in `EnvBindings` in `src/app/config.ts`: `JWT_SECRET`, `ENCRYPTION_KEY`, `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_WALLETCONNECT_SELF_PROXY`.
- Use PascalCase for classes, interfaces, enums, and exported data types: `AppError`, `EnvBindings`, `BaseOAuthProvider`, `OAuthUserInfo`, `LogLevel`, `VaultItem`, `NewVaultItem`.
- Repository and service classes use PascalCase names matching their file role: `VaultRepository` in `src/shared/db/repositories/vaultRepository.ts`, `VaultService` in `src/features/vault/vaultService.ts`.
- Database inferred types use noun and `New*` insert pairs in `src/shared/db/schema/index.ts`: `BackupProvider` and `NewBackupProvider`, `AuthSession` and `NewAuthSession`.
## Code Style
- No formatter config is committed: `.prettierrc`, `prettier.config.*`, `biome.json`, `.eslintrc*`, and `eslint.config.*` are not detected.
- TypeScript embedded in `backend/dist/*/*.map` uses 4-space indentation, semicolons, single quotes, and trailing commas in multi-line arrays/objects. Match this style for recovered or new TypeScript source.
- Root JavaScript scripts use CommonJS, 4-space indentation, semicolons, and single quotes: `scripts/decrypt_backup.js`, `scripts/inject_vars.js`.
- SQL uses uppercase DDL keywords and snake_case column names in `backend/schema.sql`.
- No lint command is declared in `package.json` or `backend/package.json`.
- No lint configuration file is detected in the checkout.
- Use TypeScript type checking and targeted tests as the practical quality gate for source changes; do not rely on a configured linter in this distribution.
## Import Organization
- Use the `@/` alias for TypeScript application imports visible in source maps: `@/shared/utils/logger`, `@/features/backup/backupService`, `@/shared/db/repositories/vaultRepository`.
- Root scripts use Node CommonJS built-ins through `require(...)`: `fs`, `crypto`, `path`, `child_process` in `scripts/decrypt_backup.js` and `scripts/inject_vars.js`.
- The actual `tsconfig.json` defining `@/` is not present in this distribution; keep alias usage consistent with embedded source paths if source files are restored.
## Error Handling
- Throw `AppError` from `src/app/config.ts` for expected application errors with HTTP status codes, e.g. `throw new AppError('no_session', 401)` in `src/shared/middleware/auth.ts` and `throw new AppError('account_exists', 409)` in `src/features/vault/vaultService.ts`.
- Global Hono error handling lives in `src/app/index.ts` via `app.onError`; it converts thrown errors to JSON `{ code, success, message, data }` responses.
- Mask unexpected 500-level errors in production-style paths: `src/app/index.ts` logs stack/details with `logger.error` and returns `internal_server_error` for non-`AppError` server failures.
- Route handlers return explicit JSON errors for simple request validation failures: `ids must be an array` and `sortOrder must be a number` in `src/features/vault/vaultRoutes.ts`.
- Utility parsing functions may return `null` for invalid user input instead of throwing when parsing is a recoverable failure: `parseOTPAuthURI` in `src/shared/utils/otp/index.ts`.
- CLI scripts catch fatal errors, print user-facing messages, and exit with non-zero status: `scripts/decrypt_backup.js` uses `process.exit(1)` after read/parse/decrypt failures.
## Logging
- Use `logger` from `src/shared/utils/logger.ts` for application logs instead of raw `console` in TypeScript application code.
- Log level is controlled by `LOG_LEVEL`, normalized from `process.env.LOG_LEVEL` in `src/shared/utils/logger.ts`.
- Hono request logging is bridged through `hLogger((str) => logger.info(str))` in `src/app/index.ts`.
- Use `logger.warn` for recoverable normalization/decoding failures, as in `normalizeSecret` in `src/shared/utils/crypto.ts`.
- Root operational scripts may use `console.log`, `console.warn`, and `console.error` with terminal formatting because they are standalone CLI tools: `scripts/decrypt_backup.js`, `scripts/inject_vars.js`.
## Comments
- Comments are common and often bilingual Chinese/English. Preserve existing language style within nearby code.
- Use section-divider comments for major route/app organization, as in `src/app/index.ts`.
- Use comments for security-sensitive reasoning and protocol compatibility, as in `src/shared/utils/crypto.ts`, `src/shared/middleware/auth.ts`, and `src/shared/utils/otp/index.ts`.
- Use comments for performance-sensitive database decisions, especially batch sizes and platform limits, as in `src/shared/db/repositories/vaultRepository.ts`.
- Avoid comments for trivial assignments; existing comments justify behavior, constraints, or domain decisions.
- Use short JSDoc blocks for exported classes/functions and important internal helpers: `Logger` methods in `src/shared/utils/logger.ts`, `BaseOAuthProvider` contracts in `src/features/auth/providers/baseOAuthProvider.ts`, `parseOTPAuthURI` in `src/shared/utils/otp/index.ts`.
- Root scripts include file-level block comments explaining purpose and usage: `scripts/decrypt_backup.js`, `scripts/inject_vars.js`.
## Function Design
## Module Design
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- The runtime entrypoint is `backend/dist/worker/worker.js`, which wraps the Hono app in a Worker `fetch` handler and a cron `scheduled` handler.
- The app serves API routes under `/api/*` and serves the static SPA from `frontend/dist` through the Cloudflare `ASSETS` binding.
- The backend is layered into `src/app`, `src/features`, and `src/shared`, with database access abstracted through shared schema and repository modules.
## Layers
- Purpose: Adapt the Cloudflare Workers runtime to the application.
- Location: `src/app/worker.ts`
- Contains: `fetch` handler, `scheduled` cron handler, DB migration bootstrap.
- Depends on: `src/app/index.ts`, `src/shared/db/d1Executor.ts`, `src/shared/db/migrator.ts`, `src/shared/db/schema/sqlite.ts`.
- Used by: `wrangler.toml` via `backend/dist/worker/worker.js`.
- Purpose: Configure middleware, security headers, route mounting, and fallback asset serving.
- Location: `src/app/index.ts`
- Contains: Hono app construction, auth/health guards, route registration, error handling.
- Depends on: `src/app/config.ts`, `src/shared/utils/logger.ts`, feature route modules.
- Used by: Worker runtime and alternate deployment bundles.
- Purpose: Group domain capabilities into route modules and services.
- Location: `src/features/*`
- Contains: auth, vault, backup, telegram, tools, health, emergency routes and services.
- Depends on: shared utilities, shared DB repositories, provider implementations.
- Used by: `src/app/index.ts`.
- Purpose: Hold reusable utilities, DB abstractions, and cross-feature middleware.
- Location: `src/shared/*`
- Contains: crypto, OTP, masking, UA helpers, logger, rate limiting, DB schema/repositories, health checks.
- Depends on: platform APIs, database client abstractions, and vendor SDKs.
- Used by: all feature modules and the worker bootstrap.
- Purpose: Ship the SPA and PWA shell as static assets.
- Location: `frontend/dist`
- Contains: `index.html`, `manifest.webmanifest`, `sw.js`, generated JS/CSS chunks, icons, WASM assets.
- Depends on: the backend only through `/api/*` calls and asset hosting.
- Used by: `ASSETS` binding in `wrangler.toml`.
## Data Flow
- Persistent application state lives in D1 and is described by `src/shared/db/schema/*.ts` plus `backend/schema.sql`.
- Session, vault, backup, passkey, and rate-limit state are managed through shared repositories in `src/shared/db/repositories/*`.
- Runtime configuration and security gates come from environment variables read in `src/app/config.ts` and `src/shared/utils/health.ts`.
## Key Abstractions
- Purpose: HTTP routing and middleware composition.
- Examples: `src/app/index.ts`, `src/features/auth/authRoutes.ts`, `src/features/vault/vaultRoutes.ts`.
- Pattern: One root app mounts route sub-apps with `app.route("/api/...")`.
- Purpose: Keep persistence logic separate from route handlers.
- Examples: `src/shared/db/repositories/vaultRepository.ts`, `src/shared/db/repositories/sessionRepository.ts`, `src/shared/db/repositories/backupRepository.ts`.
- Pattern: Feature services call repositories instead of issuing raw SQL from route handlers.
- Purpose: Normalize external auth and backup integrations behind per-provider modules.
- Examples: `src/features/auth/providers/*`, `src/features/backup/providers/*`.
- Pattern: A shared base module plus concrete provider implementations selected by configuration.
- Purpose: Block unsafe deployments before sensitive routes execute.
- Examples: `src/shared/utils/health.ts`, `src/features/health/healthRoutes.ts`, `src/app/index.ts`.
- Pattern: The app checks license and secret configuration on API requests and returns structured failure data.
## Entry Points
- Location: `src/app/worker.ts`
- Triggers: Cloudflare request handling.
- Responsibilities: Initialize D1/Drizzle, run migrations, forward to the Hono app.
- Location: `src/app/worker.ts`
- Triggers: Cloudflare cron expression in `wrangler.toml`.
- Responsibilities: Run scheduled backup jobs.
- Location: `src/app/index.ts`
- Triggers: Worker `fetch` handler and alternate deployment bundles.
- Responsibilities: Middleware, route wiring, SPA fallback, error handling.
## Error Handling
- Route modules throw `AppError` for expected failures; `src/app/index.ts` converts them into JSON error envelopes.
- The root handler logs unexpected errors as critical and returns `internal_server_error` for 5xx conditions.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
