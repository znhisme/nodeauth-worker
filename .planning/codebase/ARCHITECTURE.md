# Architecture

**Analysis Date:** 2026-05-02

## Pattern Overview

**Overall:** Cloudflare Workers API gateway with a bundled SPA frontend and a shared serverless backend core.

**Key Characteristics:**
- The runtime entrypoint is `backend/dist/worker/worker.js`, which wraps the Hono app in a Worker `fetch` handler and a cron `scheduled` handler.
- The app serves API routes under `/api/*` and serves the static SPA from `frontend/dist` through the Cloudflare `ASSETS` binding.
- The backend is layered into `src/app`, `src/features`, and `src/shared`, with database access abstracted through shared schema and repository modules.

## Layers

**Worker Runtime Layer:**
- Purpose: Adapt the Cloudflare Workers runtime to the application.
- Location: `src/app/worker.ts`
- Contains: `fetch` handler, `scheduled` cron handler, DB migration bootstrap.
- Depends on: `src/app/index.ts`, `src/shared/db/d1Executor.ts`, `src/shared/db/migrator.ts`, `src/shared/db/schema/sqlite.ts`.
- Used by: `wrangler.toml` via `backend/dist/worker/worker.js`.

**Application Shell Layer:**
- Purpose: Configure middleware, security headers, route mounting, and fallback asset serving.
- Location: `src/app/index.ts`
- Contains: Hono app construction, auth/health guards, route registration, error handling.
- Depends on: `src/app/config.ts`, `src/shared/utils/logger.ts`, feature route modules.
- Used by: Worker runtime and alternate deployment bundles.

**Feature Layer:**
- Purpose: Group domain capabilities into route modules and services.
- Location: `src/features/*`
- Contains: auth, vault, backup, telegram, tools, health, emergency routes and services.
- Depends on: shared utilities, shared DB repositories, provider implementations.
- Used by: `src/app/index.ts`.

**Shared Layer:**
- Purpose: Hold reusable utilities, DB abstractions, and cross-feature middleware.
- Location: `src/shared/*`
- Contains: crypto, OTP, masking, UA helpers, logger, rate limiting, DB schema/repositories, health checks.
- Depends on: platform APIs, database client abstractions, and vendor SDKs.
- Used by: all feature modules and the worker bootstrap.

**Frontend Asset Layer:**
- Purpose: Ship the SPA and PWA shell as static assets.
- Location: `frontend/dist`
- Contains: `index.html`, `manifest.webmanifest`, `sw.js`, generated JS/CSS chunks, icons, WASM assets.
- Depends on: the backend only through `/api/*` calls and asset hosting.
- Used by: `ASSETS` binding in `wrangler.toml`.

## Data Flow

**Request Flow:**

1. `backend/dist/worker/worker.js` receives the request and builds a Drizzle-backed env object around Cloudflare D1.
2. `src/app/index.ts` runs global middleware, health validation, CSP headers, and route dispatch.
3. Feature routes handle the request and use shared repositories/services to read or write D1 state.
4. Unmatched non-API requests fall through to `env.ASSETS.fetch(...)`, which serves `frontend/dist`.

**Scheduled Flow:**

1. Cloudflare Cron triggers the `scheduled` export in `src/app/worker.ts`.
2. The worker builds the same DB abstraction and hands execution to backup scheduling logic.
3. `src/features/backup/backupService.ts` performs the backup task using provider implementations.

**State Management:**
- Persistent application state lives in D1 and is described by `src/shared/db/schema/*.ts` plus `backend/schema.sql`.
- Session, vault, backup, passkey, and rate-limit state are managed through shared repositories in `src/shared/db/repositories/*`.
- Runtime configuration and security gates come from environment variables read in `src/app/config.ts` and `src/shared/utils/health.ts`.

## Key Abstractions

**Hono App:**
- Purpose: HTTP routing and middleware composition.
- Examples: `src/app/index.ts`, `src/features/auth/authRoutes.ts`, `src/features/vault/vaultRoutes.ts`.
- Pattern: One root app mounts route sub-apps with `app.route("/api/...")`.

**Repository Layer:**
- Purpose: Keep persistence logic separate from route handlers.
- Examples: `src/shared/db/repositories/vaultRepository.ts`, `src/shared/db/repositories/sessionRepository.ts`, `src/shared/db/repositories/backupRepository.ts`.
- Pattern: Feature services call repositories instead of issuing raw SQL from route handlers.

**Provider Interfaces:**
- Purpose: Normalize external auth and backup integrations behind per-provider modules.
- Examples: `src/features/auth/providers/*`, `src/features/backup/providers/*`.
- Pattern: A shared base module plus concrete provider implementations selected by configuration.

**Environment Health Gate:**
- Purpose: Block unsafe deployments before sensitive routes execute.
- Examples: `src/shared/utils/health.ts`, `src/features/health/healthRoutes.ts`, `src/app/index.ts`.
- Pattern: The app checks license and secret configuration on API requests and returns structured failure data.

## Entry Points

**Worker Fetch Entry:**
- Location: `src/app/worker.ts`
- Triggers: Cloudflare request handling.
- Responsibilities: Initialize D1/Drizzle, run migrations, forward to the Hono app.

**Worker Scheduled Entry:**
- Location: `src/app/worker.ts`
- Triggers: Cloudflare cron expression in `wrangler.toml`.
- Responsibilities: Run scheduled backup jobs.

**API Shell Entry:**
- Location: `src/app/index.ts`
- Triggers: Worker `fetch` handler and alternate deployment bundles.
- Responsibilities: Middleware, route wiring, SPA fallback, error handling.

## Error Handling

**Strategy:** Centralized application error handling with typed application errors and structured JSON responses.

**Patterns:**
- Route modules throw `AppError` for expected failures; `src/app/index.ts` converts them into JSON error envelopes.
- The root handler logs unexpected errors as critical and returns `internal_server_error` for 5xx conditions.

## Cross-Cutting Concerns

**Logging:** `src/shared/utils/logger.ts` provides level-based logging, and `src/app/index.ts` wires request logs through Hono middleware.
**Validation:** `src/shared/utils/health.ts` enforces deployment prerequisites before most API requests proceed.
**Authentication:** `src/features/auth/*`, `src/shared/middleware/auth.ts`, and `src/shared/db/repositories/sessionRepository.ts` provide auth/session enforcement.

---

*Architecture analysis: 2026-05-02*
