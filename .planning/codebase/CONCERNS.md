# Codebase Concerns

**Analysis Date:** 2026-05-02

## Tech Debt

**Distribution-only codebase:**
- Issue: The repository contains compiled artifacts but not the TypeScript source referenced by sourcemap comments such as `src/features/auth/authRoutes.ts`, `src/features/vault/vaultService.ts`, `src/features/backup/backupService.ts`, and `src/shared/middleware/rateLimitMiddleware.ts`.
- Files: `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, `backend/dist/netlify/api.mjs`, `frontend/dist/`, `backend/package.json`
- Impact: Future changes must patch minified/bundled output or require reconstructing the upstream source tree. Review, tests, type checks, and security fixes are high-risk because the files are 58k-80k lines and include bundled dependencies.
- Fix approach: Restore and commit the real source directories (`backend/src/**`, frontend source, build scripts such as `backend/scripts/**`) or replace this repository with a generated-release repo whose upstream source and release provenance are explicit. Do not implement feature work directly in `backend/dist/**` unless it is an emergency hotfix.

**Backend dependency lockfile gap:**
- Issue: `backend/package.json` declares runtime and test dependencies, but no backend-specific lockfile is present. The root `package-lock.json` only covers root dev dependencies such as `wrangler`, while Netlify and Docker run `npm install --prefix backend`.
- Files: `backend/package.json`, `package-lock.json`, `netlify.toml`, `Dockerfile`, `.github/workflows/netlify.yml`
- Impact: Backend installs are not reproducible. Native modules such as `better-sqlite3`, database clients, and security-sensitive libraries can resolve differently across CI, Docker, Netlify, and local machines.
- Fix approach: Generate and commit `backend/package-lock.json`, then use `npm ci --prefix backend` in `netlify.toml`, `Dockerfile`, and CI workflows.

**Multi-platform generated bundles duplicate the same backend:**
- Issue: Three compiled backend entrypoints are committed, each very large: Cloudflare Worker, Docker server, and Netlify function.
- Files: `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, `backend/dist/netlify/api.mjs`
- Impact: Hotfixes must be applied consistently across three generated files. A platform-specific file can drift from the others without test coverage catching it.
- Fix approach: Treat `backend/dist/**` as generated output. Regenerate all platform bundles from one source commit, and document the build command that produces all three artifacts.

**Schema management is raw SQL plus bundled Drizzle schemas:**
- Issue: `backend/schema.sql` is applied directly to remote D1, while the compiled backend contains Drizzle schemas for SQLite, MySQL, and PostgreSQL. There is no detected migration directory or versioned migration set.
- Files: `backend/schema.sql`, `.github/workflows/deploy.yml`, `backend/dist/worker/worker.js`
- Impact: Additive `CREATE TABLE IF NOT EXISTS` can create fresh databases but does not reliably evolve existing databases. Cross-engine schema drift can appear between D1, Docker SQLite, MySQL, and PostgreSQL deployments.
- Fix approach: Use one migration system with ordered migrations for all supported engines, or explicitly scope this distribution to one engine per platform and keep schema changes versioned.

**Deployment scripts mutate configuration with shell string replacement:**
- Issue: Cloudflare deployment copies and edits `wrangler.toml` with `sed`, route parsing, and appended D1 bindings before restore.
- Files: `.github/workflows/deploy.yml`, `wrangler.toml`
- Impact: TOML structure can be corrupted by unexpected secret values, route formatting, or future config changes. The generated deployment config is not validated before deploy.
- Fix approach: Generate deployment config from a structured TOML parser or template, then run `wrangler deploy --dry-run` or equivalent validation before remote schema sync and deploy.

**Dead or placeholder migration endpoint:**
- Issue: `/api/vault/migrate-crypto` returns success with a message that old salt migration is no longer supported and reports zero migrated items.
- Files: `backend/dist/worker/worker.js`
- Impact: Operators may assume a real migration ran. Legacy encrypted data that requires migration has no visible remediation path in this distribution.
- Fix approach: Remove the endpoint if obsolete, or replace it with a real migration status endpoint that detects legacy rows and gives a concrete remediation path.

## Known Bugs

**Backend tests cannot run from the checked-out distribution:**
- Symptoms: `npm --prefix backend test -- --runInBand` fails with `vitest: not found` because backend dependencies are not installed and there is no backend lockfile. No `*.test.*`, `*.spec.*`, `vitest.config.*`, or `jest.config.*` files are present.
- Files: `backend/package.json`, `package-lock.json`
- Trigger: Run `npm --prefix backend test` in a clean checkout.
- Workaround: Run `npm install --prefix backend` before the test command, but this uses unlocked dependency resolution and still has no detected test files.

**Export password policy is inconsistent:**
- Symptoms: A global security config defines `MIN_EXPORT_PASSWORD_LENGTH: 12`, but `VaultService.exportAccounts()` enforces a local `MIN_EXPORT_PASSWORD_LENGTH: 5`.
- Files: `backend/dist/worker/worker.js`
- Trigger: Export with type `encrypted` and a 5-11 character password.
- Workaround: Operators should require longer passwords outside the app until the service uses the shared `SECURITY_CONFIG.MIN_EXPORT_PASSWORD_LENGTH`.

**Trash empty count is inaccurate:**
- Symptoms: `emptyTrashPhysical()` deletes all soft-deleted vault rows but always returns `1`.
- Files: `backend/dist/worker/worker.js`
- Trigger: Call `/api/vault/trash_empty` with zero, one, or multiple deleted rows.
- Workaround: Refresh vault/trash counts after emptying instead of trusting the returned `deletedCount`.

**Rate limit can be bypassed when the rate-limit database path errors:**
- Symptoms: `rateLimit()` logs database errors and then calls `next()`, allowing the request.
- Files: `backend/dist/worker/worker.js`
- Trigger: Missing `rate_limits` table, DB outage, schema mismatch, or query failure on login/export/import rate-limited endpoints.
- Workaround: Monitor logs for `[RateLimit] Database error` and keep `rate_limits` schema healthy. Fix should fail closed for authentication-sensitive routes.

**OAuth/PKCE verifier is returned to the client:**
- Symptoms: `/api/auth/authorize/:provider` returns `codeVerifier` in the JSON body and stores only `state` in an HTTP-only cookie.
- Files: `backend/dist/worker/worker.js`
- Trigger: Start OAuth authorization for providers using PKCE.
- Workaround: Keep the frontend origin trusted. Fix should bind the verifier to an HTTP-only server-side cookie or short-lived server-side state record instead of returning it in JSON.

## Security Considerations

**Emergency flow exposes the server encryption key to authenticated clients:**
- Risk: Before `_schema_metadata.emergency_confirmed` is set, successful OAuth, passkey, Web3 login, and `/api/auth/me` can include `encryptionKey: this.env.ENCRYPTION_KEY` in responses.
- Files: `backend/dist/worker/worker.js`, `backend/schema.sql`, `.github/workflows/deploy.yml`
- Current mitigation: Requires authentication and an unconfirmed emergency state; `OAUTH_ALLOWED_USERS` and `OAUTH_ALLOW_ALL` control who can authenticate.
- Recommendations: Treat emergency mode as a break-glass bootstrap flow. Require a dedicated one-time bootstrap secret or admin claim before returning `ENCRYPTION_KEY`, expire the emergency window, audit every disclosure, and make `OAUTH_ALLOW_ALL` impossible during emergency mode.

**Application depends on a single long-lived server encryption key:**
- Risk: Vault secrets, backup provider config, OAuth backup tokens, and auto-backup passwords rely on `ENCRYPTION_KEY` or fallback key material in compiled service paths.
- Files: `backend/dist/worker/worker.js`, `backend/schema.sql`, `.github/workflows/deploy.yml`, `DEPLOY.md`
- Current mitigation: Deployment docs warn not to modify `ENCRYPTION_KEY`, `JWT_SECRET`, and `NODEAUTH_LICENSE`.
- Recommendations: Add key versioning, rotation support, encrypted key wrapping, and explicit backup/restore procedures. Store a key identifier with encrypted rows so future rotations can be incremental.

**Plaintext secret export is supported:**
- Risk: `json`, `2fas`, and `text` export modes return decrypted TOTP secrets without requiring an export password. Encrypted export mode accepts passwords as short as five characters.
- Files: `backend/dist/worker/worker.js`
- Current mitigation: Export route requires `authMiddleware` and has DB-backed rate limiting.
- Recommendations: Require explicit re-authentication or passkey confirmation for plaintext exports, enforce the shared 12-character minimum for encrypted exports, and audit export events.

**Standalone decrypt script leaks decrypted backup contents to terminal and disk:**
- Risk: `scripts/decrypt_backup.js` accepts the password as a CLI argument, prints decrypted JSON to stdout, and writes `decrypted-<backup>` in the current directory.
- Files: `scripts/decrypt_backup.js`
- Current mitigation: Intended as a manual standalone tool.
- Recommendations: Read passwords from an interactive prompt or file descriptor, avoid printing secrets by default, require an explicit output path, set restrictive file permissions, and warn before writing decrypted data.

**Netlify disables secret scanning:**
- Risk: `SECRETS_SCAN_ENABLED = "false"` disables Netlify's deploy-time secret scan.
- Files: `netlify.toml`
- Current mitigation: The repo did not expose `.env` files during this audit.
- Recommendations: Re-enable secret scanning unless there is a documented false-positive list. Keep generated bundles scanned because secrets can be injected into `frontend/dist/**` or `backend/dist/**`.

**CORS and credentials need explicit production review:**
- Risk: The bundled Hono CORS middleware default includes permissive `origin: "*"` behavior, and the app uses cookie auth plus CSRF tokens.
- Files: `backend/dist/worker/worker.js`
- Current mitigation: Mutating API routes require `X-CSRF-Token` matching the non-HTTP-only `csrf_token` cookie.
- Recommendations: Verify the app-level CORS configuration restricts credentialed requests to the deployed frontend origins. Add tests for cross-origin credential handling and CSRF failures.

**OAuth allow-all is a high-impact switch:**
- Risk: `OAUTH_ALLOW_ALL` values `"true"`, `"1"`, or `"2"` bypass whitelist checks for OAuth and Web3 users.
- Files: `backend/dist/worker/worker.js`, `.github/workflows/deploy.yml`
- Current mitigation: Default in deploy workflow is `false`, and `OAUTH_ALLOWED_USERS` is checked as a required secret.
- Recommendations: Reject allow-all in production unless an explicit `ENVIRONMENT=development` or separate unsafe flag is set. Surface a health-check warning when allow-all is enabled.

## Performance Bottlenecks

**Search and pagination scan encrypted vault metadata without indexes:**
- Problem: Search uses `%term%` `LIKE` filters on `service`, `account`, and `category`, then separately counts, gathers category stats, and counts trash rows.
- Files: `backend/dist/worker/worker.js`, `backend/schema.sql`
- Cause: `backend/schema.sql` defines no indexes for `vault.deleted_at`, `sort_order`, `created_at`, `category`, or normalized service/account lookup.
- Improvement path: Add indexes for common filters and ordering, introduce normalized searchable columns if needed, and combine count/stat queries where possible.

**Rate limit table can grow without cleanup:**
- Problem: `rate_limits` stores attempts by key and expiry but no cleanup path was detected.
- Files: `backend/schema.sql`, `backend/dist/worker/worker.js`
- Cause: The limiter updates and inserts rows but does not delete expired keys except explicit reset for successful logins.
- Improvement path: Add scheduled cleanup using the existing Cloudflare cron trigger, delete expired keys opportunistically, and index `expires_at`.

**Bulk sync and import are sequential for many operations:**
- Problem: `batchSync()` processes actions one by one; import validates all existing rows in memory and then batches inserts/revives.
- Files: `backend/dist/worker/worker.js`
- Cause: Offline conflict handling and duplicate detection are implemented in service logic instead of set-based database operations.
- Improvement path: Keep correctness checks, but batch independent updates/deletes and use database uniqueness/indexes for service/account signatures.

**Committed frontend and backend bundles increase repo weight and review cost:**
- Problem: `frontend/dist/**` and `backend/dist/**` contain large generated JS, WASM, images, and source maps.
- Files: `frontend/dist/`, `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, `backend/dist/netlify/api.mjs`
- Cause: The repository is packaged as a distribution artifact.
- Improvement path: If this is the source repo, stop committing generated bundles. If this is intentionally a release repo, add provenance metadata and keep generated files isolated from hand-edited code.

## Fragile Areas

**Authentication and bootstrap boundary:**
- Files: `backend/dist/worker/worker.js`, `backend/schema.sql`, `.github/workflows/deploy.yml`
- Why fragile: OAuth, passkey, Web3, sessions, CSRF, emergency bootstrap, and encryption-key delivery intersect in one compiled bundle. Small changes can alter who receives key material.
- Safe modification: Work from source modules (`src/features/auth/**`, `src/shared/middleware/auth.ts`, `src/features/auth/webAuthnService.ts`, `src/features/auth/web3WalletAuthService.ts`) and add route-level tests before regenerating bundles.
- Test coverage: No test files detected in this distribution.

**Vault encryption, import, export, and offline sync:**
- Files: `backend/dist/worker/worker.js`, `backend/schema.sql`
- Why fragile: The service decrypts server-side secrets, wraps/unmasks device-specific values, revives soft-deleted entries, exports plaintext formats, and resolves offline conflicts.
- Safe modification: Add fixtures for encrypted rows, deleted rows, duplicate service/account pairs, HOTP counters, and all import/export formats. Test both D1-style and Drizzle-style DB clients.
- Test coverage: No detected unit or integration tests for vault flows.

**Backup provider storage and token handling:**
- Files: `backend/dist/worker/worker.js`, `backend/schema.sql`
- Why fragile: Backup config, auto-backup passwords, OAuth tokens, WebDAV/S3/Telegram/email histories, and external API calls are bundled into one generated artifact. Several paths use `ENCRYPTION_KEY || JWT_SECRET` fallback behavior.
- Safe modification: Add typed config schemas per provider, forbid fallback key changes, and test token revocation/refresh paths per provider.
- Test coverage: No detected tests for backup provider encryption, token refresh, or failed remote backup behavior.

**Database engine abstraction:**
- Files: `backend/dist/worker/worker.js`, `backend/schema.sql`, `docker-compose.yml`, `docker-compose-mysql-local.yml`, `docker-compose-postgresql-local.yml`, `docker-compose-mysql-remote.yml`, `docker-compose-postgresql-remote.yml`
- Why fragile: The compiled bundle selects SQLite/MySQL/PostgreSQL schemas based on `DB_ENGINE`, while Cloudflare D1 uses raw SQL and a D1 binding. Behavior can differ by engine around booleans, bigint timestamps, BLOB public keys, conflicts, and batch operations.
- Safe modification: Run the same repository contract tests against D1/local SQLite, MySQL, and PostgreSQL before changing schema or repository code.
- Test coverage: No cross-engine tests detected.

**CI/CD deployment order:**
- Files: `.github/workflows/deploy.yml`, `.github/workflows/docker.yml`, `.github/workflows/netlify.yml`, `wrangler.toml`, `netlify.toml`
- Why fragile: Cloudflare deployment applies schema to the remote database before deploying code, while Docker/Netlify rely on prebuilt dist output and install backend dependencies independently.
- Safe modification: Validate config generation, run health checks after deploy, and gate deploy on tests/build provenance from the same commit.
- Test coverage: Workflows do not run tests before deployment in the checked files.

## Scaling Limits

**Single-user/global vault model:**
- Current capacity: Tables such as `vault` have `created_by`/`updated_by`, but repository reads and writes are not consistently scoped by user.
- Limit: Multiple allowed users can share or affect the same vault dataset unless intentionally operated as a shared vault.
- Scaling path: Decide whether NodeAuth is a shared team vault or per-user vault. If per-user, add user scoping to repository queries and database indexes. If shared, document access model and add audit logs.

**D1 parameter and batch limits are manually encoded:**
- Current capacity: Sort-order updates chunk at 30 rows because Cloudflare D1 allows 100 bind parameters per statement; batch insert chunks at 50.
- Limit: Large imports/reorders depend on hardcoded chunk sizes and may fail if query shape changes.
- Scaling path: Centralize per-platform database limits and add tests for max-size import, reorder, batch delete, and sync payloads.

**Session and rate-limit stores lack retention indexes:**
- Current capacity: `auth_sessions` and `rate_limits` store timestamps but `backend/schema.sql` has no indexes or visible cleanup for expired rate-limit keys.
- Limit: Long-running deployments accumulate stale operational rows and slow auth/session checks.
- Scaling path: Add indexes on `auth_sessions.user_id`, `auth_sessions.last_active_at`, `rate_limits.expires_at`, and scheduled cleanup tasks.

## Dependencies at Risk

**Native SQLite dependency in container and Netlify paths:**
- Risk: `better-sqlite3` requires native compilation and is installed during Docker builds and Netlify builds without a backend lockfile.
- Impact: Build failures or ABI mismatches can break Docker/Netlify deployments.
- Migration plan: Commit backend lockfile, pin Node versions consistently, and consider a pure JS or managed database path for serverless deployments where native modules are brittle.

**Node 24 adoption across deploy surfaces:**
- Risk: Docker uses `node:24-bookworm-slim`, Netlify sets Node 24, and backend dev dependencies include `@types/node` 25. Some hosting/runtime ecosystems lag current Node releases.
- Impact: Local, Docker, and Netlify behavior can diverge from Cloudflare Workers and from developer machines.
- Migration plan: Pin an LTS Node version in `.nvmrc`/`.node-version`, align `@types/node`, Docker, Netlify, and CI, and document runtime support.

**Wrangler/action version split:**
- Risk: Root `package.json` pins `wrangler` 4.75.0, while Cloudflare workflow uses `cloudflare/wrangler-action@v3` with `wranglerVersion: '4.75.0'`.
- Impact: Local deploy and CI deploy can drift if one path is updated without the other.
- Migration plan: Keep a single version source or add CI that verifies `package.json`, lockfile, and workflow `wranglerVersion` match.

## Missing Critical Features

**Source-level test suite:**
- Problem: No test files or test config were detected, and the backend test command cannot run from a clean checkout.
- Blocks: Safe changes to authentication, encryption, backup, import/export, DB abstraction, and generated bundles.

**Release provenance for generated artifacts:**
- Problem: `backend/dist/**` and `frontend/dist/**` do not include a manifest linking each bundle to source commit, build command, dependency lockfiles, and checksums.
- Blocks: Auditing whether the committed distribution matches reviewed source.

**Key rotation and recovery procedure:**
- Problem: Deployment docs warn not to change encryption/JWT/license secrets, but the app has no detected key rotation workflow.
- Blocks: Recovery from compromised keys and routine cryptographic hygiene.

**Production observability policy:**
- Problem: `wrangler.toml` has `[observability] enabled = false` while logs are enabled under `[observability.logs]`.
- Blocks: Clear incident response posture for auth failures, rate-limit failures, backup failures, and emergency key disclosure.

## Test Coverage Gaps

**Authentication security flows:**
- What's not tested: OAuth state/PKCE handling, whitelist enforcement, allow-all behavior, CSRF mismatch, session invalidation, passkey challenge verification, Web3 nonce verification, and emergency key disclosure.
- Files: `backend/dist/worker/worker.js`
- Risk: Login bypasses, CSRF regressions, or unintended `ENCRYPTION_KEY` disclosure can ship unnoticed.
- Priority: High

**Vault crypto and data lifecycle:**
- What's not tested: Create/update encryption, zero-knowledge masking/unmasking, plaintext export, encrypted export password enforcement, import duplicate handling, soft delete/restore/hard delete, HOTP counter conflicts, and offline sync.
- Files: `backend/dist/worker/worker.js`, `backend/schema.sql`
- Risk: Secret loss, plaintext exposure, duplicate records, and sync conflicts can ship unnoticed.
- Priority: High

**Backup providers and external APIs:**
- What's not tested: WebDAV/S3/Telegram/email provider config encryption, backup retention, token refresh/revocation, remote failure handling, and scheduled auto-backups.
- Files: `backend/dist/worker/worker.js`, `backend/schema.sql`
- Risk: Backup failure or provider credential exposure can ship unnoticed.
- Priority: High

**Database compatibility:**
- What's not tested: D1, SQLite, MySQL, and PostgreSQL behavior for schema creation, timestamps, booleans, BLOB passkey storage, conflict handling, and batch operations.
- Files: `backend/dist/worker/worker.js`, `backend/schema.sql`, `docker-compose*.yml`
- Risk: One deployment target can pass while another loses data or fails at runtime.
- Priority: Medium

**Deployment workflows:**
- What's not tested: Generated `wrangler.toml`, D1 schema sync safety, Netlify build dependency resolution, Docker image runtime startup, and post-deploy health checks.
- Files: `.github/workflows/deploy.yml`, `.github/workflows/docker.yml`, `.github/workflows/netlify.yml`, `wrangler.toml`, `netlify.toml`, `Dockerfile`
- Risk: Main branch pushes can deploy broken runtime artifacts because tests are not run in the workflows.
- Priority: Medium

---

*Concerns audit: 2026-05-02*
