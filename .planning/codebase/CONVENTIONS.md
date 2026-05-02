# Coding Conventions

**Analysis Date:** 2026-05-02

## Naming Patterns

**Files:**
- Distribution checkout contains compiled/generated bundles under `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, `backend/dist/netlify/api.mjs`, and `frontend/dist/`; treat these as generated artifacts when adding source changes.
- Embedded TypeScript source paths in `backend/dist/worker/worker.js.map` use feature folders and lower camelCase file names: `src/features/vault/vaultRoutes.ts`, `src/features/vault/vaultService.ts`, `src/features/auth/sessionService.ts`, `src/features/backup/providers/googleDriveProvider.ts`.
- Route modules use `*Routes.ts` names: `src/features/auth/authRoutes.ts`, `src/features/backup/backupRoutes.ts`, `src/features/health/healthRoutes.ts`.
- Service modules use `*Service.ts` names: `src/features/vault/vaultService.ts`, `src/features/backup/backupService.ts`, `src/features/auth/webAuthnService.ts`.
- Repository modules use `*Repository.ts` names under `src/shared/db/repositories/`: `src/shared/db/repositories/vaultRepository.ts`, `src/shared/db/repositories/backupRepository.ts`, `src/shared/db/repositories/sessionRepository.ts`.
- Provider modules use `*Provider.ts` names under feature-specific provider folders: `src/features/auth/providers/githubProvider.ts`, `src/features/backup/providers/s3Provider.ts`.
- Root operational scripts use snake_case JavaScript names: `scripts/decrypt_backup.js`, `scripts/inject_vars.js`.

**Functions:**
- Use lower camelCase for functions and methods: `getEffectiveCSP` in `src/app/config.ts`, `authMiddleware` in `src/shared/middleware/auth.ts`, `generateTOTP` in `src/shared/utils/otp/protocols/totp.ts`, `normalizeOtpAccount` in `src/shared/utils/otp/index.ts`.
- Factory/helper functions should start with `get`, `create`, `detect`, `normalize`, `validate`, `generate`, or `parse` when that describes the action: `getOAuthProvider` in `src/features/auth/providers/index.ts`, `detectPlatform` in `scripts/inject_vars.js`, `parseOTPAuthURI` in `src/shared/utils/otp/index.ts`.
- Route-local service factories use small `getService(c)` helpers and instantiate repositories from `c.env.DB`, as shown in `src/features/vault/vaultRoutes.ts`.
- Async functions return promises explicitly in TypeScript where the source annotates public utility APIs: `generateTOTP(...): Promise<string>` in `src/shared/utils/otp/protocols/totp.ts`, `findAll(): Promise<VaultItem[]>` in `src/shared/db/repositories/vaultRepository.ts`.

**Variables:**
- Use lower camelCase for locals and parameters: `securityResult`, `statusCode`, `isAppError`, `rawJwt`, `rootKey`, `normalizedService`.
- Use all caps with underscores for constants and env-style replacement keys: `SECURITY_CONFIG`, `CSP_POLICY`, `CRYPTO_CONFIG`, `PLATFORM_REGISTRY`, `__DIST_COMMIT_HASH__`.
- Use domain-specific plural names for collections: `providers` in `src/features/auth/providers/index.ts`, `conditions` and `updates` in `src/shared/db/repositories/vaultRepository.ts`.
- Environment variables are all caps with underscores and live in `EnvBindings` in `src/app/config.ts`: `JWT_SECRET`, `ENCRYPTION_KEY`, `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_WALLETCONNECT_SELF_PROXY`.

**Types:**
- Use PascalCase for classes, interfaces, enums, and exported data types: `AppError`, `EnvBindings`, `BaseOAuthProvider`, `OAuthUserInfo`, `LogLevel`, `VaultItem`, `NewVaultItem`.
- Repository and service classes use PascalCase names matching their file role: `VaultRepository` in `src/shared/db/repositories/vaultRepository.ts`, `VaultService` in `src/features/vault/vaultService.ts`.
- Database inferred types use noun and `New*` insert pairs in `src/shared/db/schema/index.ts`: `BackupProvider` and `NewBackupProvider`, `AuthSession` and `NewAuthSession`.

## Code Style

**Formatting:**
- No formatter config is committed: `.prettierrc`, `prettier.config.*`, `biome.json`, `.eslintrc*`, and `eslint.config.*` are not detected.
- TypeScript embedded in `backend/dist/*/*.map` uses 4-space indentation, semicolons, single quotes, and trailing commas in multi-line arrays/objects. Match this style for recovered or new TypeScript source.
- Root JavaScript scripts use CommonJS, 4-space indentation, semicolons, and single quotes: `scripts/decrypt_backup.js`, `scripts/inject_vars.js`.
- SQL uses uppercase DDL keywords and snake_case column names in `backend/schema.sql`.

**Linting:**
- No lint command is declared in `package.json` or `backend/package.json`.
- No lint configuration file is detected in the checkout.
- Use TypeScript type checking and targeted tests as the practical quality gate for source changes; do not rely on a configured linter in this distribution.

## Import Organization

**Order:**
1. Runtime/framework imports first, e.g. `hono`, `hono/cors`, `hono/logger`, `hono/secure-headers` in `src/app/index.ts`.
2. Local app/shared imports through the `@/` alias next, e.g. `@/app/config`, `@/shared/utils/crypto`, `@/shared/middleware/auth`.
3. Feature route/service/provider imports after shared imports when composing the application, e.g. `@/features/auth/authRoutes`, `@/features/vault/vaultRoutes` in `src/app/index.ts`.
4. Drizzle imports before local schema imports in repositories, e.g. `drizzle-orm` then `@/shared/db/schema/index` in `src/shared/db/repositories/vaultRepository.ts`.

**Path Aliases:**
- Use the `@/` alias for TypeScript application imports visible in source maps: `@/shared/utils/logger`, `@/features/backup/backupService`, `@/shared/db/repositories/vaultRepository`.
- Root scripts use Node CommonJS built-ins through `require(...)`: `fs`, `crypto`, `path`, `child_process` in `scripts/decrypt_backup.js` and `scripts/inject_vars.js`.
- The actual `tsconfig.json` defining `@/` is not present in this distribution; keep alias usage consistent with embedded source paths if source files are restored.

## Error Handling

**Patterns:**
- Throw `AppError` from `src/app/config.ts` for expected application errors with HTTP status codes, e.g. `throw new AppError('no_session', 401)` in `src/shared/middleware/auth.ts` and `throw new AppError('account_exists', 409)` in `src/features/vault/vaultService.ts`.
- Global Hono error handling lives in `src/app/index.ts` via `app.onError`; it converts thrown errors to JSON `{ code, success, message, data }` responses.
- Mask unexpected 500-level errors in production-style paths: `src/app/index.ts` logs stack/details with `logger.error` and returns `internal_server_error` for non-`AppError` server failures.
- Route handlers return explicit JSON errors for simple request validation failures: `ids must be an array` and `sortOrder must be a number` in `src/features/vault/vaultRoutes.ts`.
- Utility parsing functions may return `null` for invalid user input instead of throwing when parsing is a recoverable failure: `parseOTPAuthURI` in `src/shared/utils/otp/index.ts`.
- CLI scripts catch fatal errors, print user-facing messages, and exit with non-zero status: `scripts/decrypt_backup.js` uses `process.exit(1)` after read/parse/decrypt failures.

## Logging

**Framework:** Custom logger plus Hono request logger.

**Patterns:**
- Use `logger` from `src/shared/utils/logger.ts` for application logs instead of raw `console` in TypeScript application code.
- Log level is controlled by `LOG_LEVEL`, normalized from `process.env.LOG_LEVEL` in `src/shared/utils/logger.ts`.
- Hono request logging is bridged through `hLogger((str) => logger.info(str))` in `src/app/index.ts`.
- Use `logger.warn` for recoverable normalization/decoding failures, as in `normalizeSecret` in `src/shared/utils/crypto.ts`.
- Root operational scripts may use `console.log`, `console.warn`, and `console.error` with terminal formatting because they are standalone CLI tools: `scripts/decrypt_backup.js`, `scripts/inject_vars.js`.

## Comments

**When to Comment:**
- Comments are common and often bilingual Chinese/English. Preserve existing language style within nearby code.
- Use section-divider comments for major route/app organization, as in `src/app/index.ts`.
- Use comments for security-sensitive reasoning and protocol compatibility, as in `src/shared/utils/crypto.ts`, `src/shared/middleware/auth.ts`, and `src/shared/utils/otp/index.ts`.
- Use comments for performance-sensitive database decisions, especially batch sizes and platform limits, as in `src/shared/db/repositories/vaultRepository.ts`.
- Avoid comments for trivial assignments; existing comments justify behavior, constraints, or domain decisions.

**JSDoc/TSDoc:**
- Use short JSDoc blocks for exported classes/functions and important internal helpers: `Logger` methods in `src/shared/utils/logger.ts`, `BaseOAuthProvider` contracts in `src/features/auth/providers/baseOAuthProvider.ts`, `parseOTPAuthURI` in `src/shared/utils/otp/index.ts`.
- Root scripts include file-level block comments explaining purpose and usage: `scripts/decrypt_backup.js`, `scripts/inject_vars.js`.

## Function Design

**Size:** Keep pure utilities small and focused, like `generateTOTP` in `src/shared/utils/otp/protocols/totp.ts`; larger orchestration functions exist in route/service modules such as `src/features/backup/backupRoutes.ts` and should be split by feature when changing behavior.

**Parameters:** Prefer explicit primitive/domain parameters for reusable utilities (`secret`, `digits`, `algorithm`, `timestamp` in `src/shared/utils/otp/protocols/totp.ts`) and contextual `env`/repository constructor injection for services/providers (`BaseOAuthProvider(env)` and `VaultRepository(dbClient)`).

**Return Values:** Use JSON-compatible plain objects for API responses in routes, domain entities from repositories, and `Promise<T>` for async APIs. Use `{ success: true/false, ... }` consistently in route responses under `src/features/*/*Routes.ts`.

## Module Design

**Exports:** Use named exports for utilities, types, classes, and constants (`AppError`, `EnvBindings`, `generateTOTP`, `VaultRepository`), and default exports for Hono route/app modules (`src/app/index.ts`, `src/features/vault/vaultRoutes.ts`).

**Barrel Files:** Use index/barrel modules for grouped provider or utility exports: `src/features/auth/providers/index.ts`, `src/shared/utils/otp/index.ts`, `src/shared/db/schema/index.ts`.

---

*Convention analysis: 2026-05-02*
