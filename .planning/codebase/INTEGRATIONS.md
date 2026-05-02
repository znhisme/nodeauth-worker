# External Integrations

**Analysis Date:** 2026-05-02

## APIs & External Services

**OAuth Login Providers:**
- GitHub OAuth - Login provider implemented in original source-map path `src/features/auth/providers/githubProvider.ts`, bundled into `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, and `backend/dist/netlify/api.mjs`.
  - SDK/Client: Native `fetch`
  - Auth: `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET`, `OAUTH_GITHUB_REDIRECT_URI`
- Google OAuth - Login provider implemented in original `src/features/auth/providers/googleProvider.ts`.
  - SDK/Client: Native `fetch`
  - Auth: `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`, `OAUTH_GOOGLE_REDIRECT_URI`
- Cloudflare Access OIDC - Login provider implemented in original `src/features/auth/providers/cloudflareAccessProvider.ts`.
  - SDK/Client: Native `fetch` with PKCE
  - Auth: `OAUTH_CLOUDFLARE_CLIENT_ID`, `OAUTH_CLOUDFLARE_CLIENT_SECRET`, `OAUTH_CLOUDFLARE_ORG_DOMAIN`, `OAUTH_CLOUDFLARE_REDIRECT_URI`
- Gitee OAuth - Login provider implemented in original `src/features/auth/providers/giteeProvider.ts`.
  - SDK/Client: Native `fetch`
  - Auth: `OAUTH_GITEE_CLIENT_ID`, `OAUTH_GITEE_CLIENT_SECRET`, `OAUTH_GITEE_REDIRECT_URI`
- NodeLoc OAuth - Login provider implemented in original `src/features/auth/providers/nodeLocProvider.ts`.
  - SDK/Client: Native `fetch`
  - Auth: `OAUTH_NODELOC_CLIENT_ID`, `OAUTH_NODELOC_CLIENT_SECRET`, `OAUTH_NODELOC_REDIRECT_URI`
- Telegram login - Bot-based login flow implemented in original `src/features/auth/providers/telegramProvider.ts`.
  - SDK/Client: Telegram login signature verification through Web Crypto
  - Auth: `OAUTH_TELEGRAM_BOT_NAME`, `OAUTH_TELEGRAM_BOT_TOKEN`
- WalletConnect/Web3 wallet login - Web3 login surfaced by original `src/features/auth/providers/index.ts` and verified by `src/features/auth/web3WalletAuthService.ts`.
  - SDK/Client: `viem`
  - Auth: `OAUTH_WALLETCONNECT_PROJECT_ID`, optional `OAUTH_WALLETCONNECT_RPC_URL`, optional `OAUTH_WALLETCONNECT_SELF_PROXY`

**Backup Storage Providers:**
- WebDAV - Backup provider implemented in original `src/features/backup/providers/webDavProvider.ts`.
  - SDK/Client: `webdav`
  - Auth: Provider config stored in `backup_providers.config` from `backend/schema.sql`; sensitive fields are encrypted by original `src/features/backup/backupService.ts`
- S3-compatible object storage - Backup provider implemented in original `src/features/backup/providers/s3Provider.ts`.
  - SDK/Client: `aws4fetch`, `fast-xml-parser`
  - Auth: Provider config stored encrypted in `backup_providers.config`
- Telegram Bot backup - Backup provider implemented in original `src/features/backup/providers/telegramProvider.ts`.
  - SDK/Client: Native `fetch` to Telegram Bot API
  - Auth: Provider config stored encrypted in `backup_providers.config`; bot webhook env uses `OAUTH_TELEGRAM_BOT_TOKEN`
- Google Drive backup - Backup provider implemented in original `src/features/backup/providers/googleDriveProvider.ts`.
  - SDK/Client: Native `fetch` to Google OAuth and Drive APIs
  - Auth: `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`, `OAUTH_GOOGLE_BACKUP_REDIRECT_URI`
- Microsoft OneDrive backup - Backup provider implemented in original `src/features/backup/providers/oneDriveProvider.ts`.
  - SDK/Client: Native `fetch` to Microsoft OAuth and Graph APIs
  - Auth: `OAUTH_MICROSOFT_CLIENT_ID`, `OAUTH_MICROSOFT_CLIENT_SECRET`, `OAUTH_MICROSOFT_BACKUP_REDIRECT_URI`
- Baidu Netdisk backup - Backup provider implemented in original `src/features/backup/providers/baiduNetdiskProvider.ts`.
  - SDK/Client: Native `fetch` to Baidu OAuth and Pan APIs
  - Auth: `OAUTH_BAIDU_CLIENT_ID`, `OAUTH_BAIDU_CLIENT_SECRET`, `OAUTH_BAIDU_BACKUP_REDIRECT_URI`
- Dropbox backup - Backup provider implemented in original `src/features/backup/providers/dropboxProvider.ts`.
  - SDK/Client: Native `fetch` to Dropbox OAuth, API, and content endpoints
  - Auth: `OAUTH_DROPBOX_CLIENT_ID`, `OAUTH_DROPBOX_CLIENT_SECRET`, `OAUTH_DROPBOX_BACKUP_REDIRECT_URI`
- Email backup - Backup provider implemented in original `src/features/backup/providers/emailProvider.ts`.
  - SDK/Client: `nodemailer`
  - Auth: SMTP provider config stored encrypted in `backup_providers.config`
- GitHub repository backup - Backup provider implemented in original `src/features/backup/providers/githubProvider.ts`.
  - SDK/Client: Native `fetch` to GitHub REST API
  - Auth: GitHub PAT stored in encrypted provider config, not the OAuth client secret

**Utility and Metadata Services:**
- Favicon providers - CSP permits `https://www.google.com`, `https://icons.bitwarden.net`, and `https://favicon.im` from original `src/app/config.ts`; frontend icon loading is visible in `frontend/dist/assets/vaultList-DKLqW51h.js`.
  - SDK/Client: Browser image requests
  - Auth: None
- WalletConnect relay/RPC/verify/explorer APIs - Proxy routes implemented in original `src/features/auth/wcProxyRoutes.ts` and mounted at `/api/oauth/wc-proxy` from original `src/app/index.ts`.
  - SDK/Client: Native `fetch`
  - Auth: `OAUTH_WALLETCONNECT_PROJECT_ID`; optional self-proxy controlled by `OAUTH_WALLETCONNECT_SELF_PROXY`
- Cloudflare Ethereum RPC - Default Web3 verification RPC is `https://cloudflare-eth.com` in original `src/features/auth/web3WalletAuthService.ts`.
  - SDK/Client: `viem`
  - Auth: Optional replacement via `OAUTH_WALLETCONNECT_RPC_URL`

## Data Storage

**Databases:**
- Cloudflare D1
  - Connection: Wrangler binding `DB` in `wrangler.toml`; deployment injects `CLOUDFLARE_D1_DATABASE_ID` and `CLOUDFLARE_D1_DATABASE_NAME` in `.github/workflows/deploy.yml`
  - Client: `drizzle-orm/d1` with `D1Executor`, from original `src/app/worker.ts` and `src/shared/db/d1Executor.ts`
- SQLite
  - Connection: `DB_ENGINE=sqlite` and optional `SQLITE_DB_PATH` in `docker-compose.yml`; schema in `backend/schema.sql`
  - Client: `better-sqlite3` with `drizzle-orm/better-sqlite3`, from original `src/shared/db/factory.ts`
- MySQL
  - Connection: `DB_ENGINE=mysql`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in `docker-compose-mysql-local.yml` and `docker-compose-mysql-remote.yml`
  - Client: `mysql2` and `mysql2/promise` with `drizzle-orm/mysql2`, from original `src/shared/db/factory.ts` and `src/shared/db/mySqlExecutor.ts`
- PostgreSQL
  - Connection: `DB_ENGINE=postgresql`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, optional `DB_SSL` in `docker-compose-postgresql-local.yml` and `docker-compose-postgresql-remote.yml`
  - Client: `pg` with `drizzle-orm/node-postgres`, from original `src/shared/db/factory.ts` and `src/shared/db/pgExecutor.ts`

**File Storage:**
- Cloudflare Workers Assets serves the SPA from `frontend/dist` through `ASSETS` in `wrangler.toml`.
- Docker serves static files from copied `frontend/dist` through original `src/shared/utils/staticServer.ts`, bundled into `backend/dist/docker/server.js`.
- User backup files are externalized through provider implementations under original `src/features/backup/providers/*`.
- Local Docker data is persisted through `./data:/app/data` in `docker-compose.yml` for SQLite and runtime storage.

**Caching:**
- No external cache service detected.
- Frontend service worker and Workbox assets are present in `frontend/dist/sw.js` and `frontend/dist/workbox-268bc380.js`.
- Runtime rate limiting persists to the database table `rate_limits` defined in `backend/schema.sql`.

## Authentication & Identity

**Auth Provider:**
- Multi-provider custom auth system
  - Implementation: Hono routes in original `src/features/auth/authRoutes.ts`, provider registry in `src/features/auth/providers/index.ts`, JWT generation in original `src/shared/utils/crypto.ts`, and session persistence in `auth_sessions` from `backend/schema.sql`
- WebAuthn/passkeys
  - Implementation: `@simplewebauthn/server` in original `src/features/auth/webAuthnService.ts`; credentials stored in `auth_passkeys` from `backend/schema.sql`
- Web3 wallet auth
  - Implementation: `viem` signature verification in original `src/features/auth/web3WalletAuthService.ts`; whitelist controlled by `OAUTH_ALLOWED_USERS` and `OAUTH_ALLOW_ALL`
- Authorization allowlist
  - Implementation: `OAUTH_ALLOWED_USERS` and optional `OAUTH_ALLOW_ALL` are checked by original `src/shared/utils/health.ts` and auth services

## Monitoring & Observability

**Error Tracking:**
- None detected. No Sentry, Rollbar, OpenTelemetry collector, or hosted error-tracking dependency appears in `package.json`, `backend/package.json`, or deployment configs.

**Logs:**
- Application logger is implemented in original `src/shared/utils/logger.ts`, bundled into `backend/dist/*`.
- Cloudflare observability config in `wrangler.toml` has `[observability] enabled = false`, while `[observability.logs] enabled = true` with invocation logs and full sampling.
- Hono request logging is mounted in original `src/app/index.ts`, visible through source maps in `backend/dist/worker/worker.js.map`.
- Docker/Node logs go to stdout/stderr from `backend/dist/docker/server.js`.

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers is the primary hosting path via `wrangler.toml` and `.github/workflows/deploy.yml`.
- Docker image deployment is supported by `Dockerfile`, `docker-compose.yml`, and `.github/workflows/docker.yml`.
- Netlify deployment is supported by `netlify.toml` and `.github/workflows/netlify.yml`.

**CI Pipeline:**
- GitHub Actions deploys Cloudflare Workers on pushes to `main` via `.github/workflows/deploy.yml`.
- GitHub Actions builds and pushes multi-arch Docker images on pushes to `main` via `.github/workflows/docker.yml`.
- GitHub Actions deploys Netlify on pushes to `main` via `.github/workflows/netlify.yml`.
- `.github/workflows/deploy.yml` runs `wrangler d1 execute` against `backend/schema.sql` before deploying the Worker.
- `DEPLOY.md` documents the current production deployment path and required GitHub Actions secrets by name.

## Environment Configuration

**Required env vars:**
- Runtime security: `NODEAUTH_LICENSE`, `JWT_SECRET`, `ENCRYPTION_KEY`, `OAUTH_ALLOWED_USERS`
- Cloudflare deployment: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, optional `CLOUDFLARE_D1_DATABASE_NAME`, optional `CLOUDFLARE_WORKERS_NAME`, optional `CLOUDFLARE_WORKERS_ROUTES`
- Docker database selection: `DB_ENGINE`; for remote MySQL/PostgreSQL also use `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`
- Netlify deployment: `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`
- DockerHub publishing: `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `DOCKER_REPO`

**Secrets location:**
- Cloudflare Worker secrets are passed from GitHub Actions secrets in `.github/workflows/deploy.yml` to `cloudflare/wrangler-action@v3`.
- Netlify secrets are GitHub Actions secrets consumed by `.github/workflows/netlify.yml`.
- DockerHub credentials are GitHub Actions secrets consumed by `.github/workflows/docker.yml`.
- Docker runtime examples list placeholder env vars in `docker-compose*.yml`; no `.env` file was detected and no secret file contents were read.
- User-configured backup provider credentials are encrypted and stored in the database column `backup_providers.config` from `backend/schema.sql`.

## Webhooks & Callbacks

**Incoming:**
- OAuth login callback: `/api/oauth/callback/:provider` in original `src/features/auth/authRoutes.ts`.
- Backup OAuth callbacks:
  - `/api/backups/oauth/google/callback` in original `src/features/backup/backupRoutes.ts`
  - `/api/backups/oauth/microsoft/callback` in original `src/features/backup/backupRoutes.ts`
  - `/api/backups/oauth/baidu/callback` in original `src/features/backup/backupRoutes.ts`
  - `/api/backups/oauth/dropbox/callback` in original `src/features/backup/backupRoutes.ts`
- Telegram webhook: `/api/telegram/webhook` in original `src/features/telegram/telegramRoutes.ts`, authenticated with `OAUTH_TELEGRAM_WEBHOOK_SECRET`.
- WalletConnect proxy endpoints: `/api/oauth/wc-proxy/relay`, `/api/oauth/wc-proxy/rpc/*`, `/api/oauth/wc-proxy/verify/*`, and `/api/oauth/wc-proxy/explorer/*` in original `src/features/auth/wcProxyRoutes.ts`.
- Cloudflare scheduled trigger: cron `0 2 * * *` in `wrangler.toml` invokes scheduled backup handling from original `src/app/worker.ts` and `src/features/backup/backupRoutes.ts`.

**Outgoing:**
- OAuth token/userinfo calls to GitHub, Google, Cloudflare Access, Gitee, NodeLoc, and Telegram from original `src/features/auth/providers/*`.
- Backup API calls to WebDAV, S3-compatible storage, Telegram Bot API, Google Drive, Microsoft Graph, Baidu Pan, Dropbox, GitHub REST, and SMTP from original `src/features/backup/providers/*`.
- WalletConnect relay/RPC/verify/explorer proxy calls from original `src/features/auth/wcProxyRoutes.ts`.
- Cloudflare D1 schema sync from `.github/workflows/deploy.yml` to Cloudflare D1 using `cloudflare/wrangler-action@v3`.

---

*Integration audit: 2026-05-02*
