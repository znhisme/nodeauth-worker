# Source Provenance

Source maps used
- backend/dist/worker/worker.js.map (71 src entries)
- backend/dist/docker/server.js.map (75 src entries)
- backend/dist/netlify/api.mjs.map (74 src entries)

Editable backend source: restored to src/**

Generated bundles are not primary implementation files

Frontend source: not present; frontend/dist/** only

UX-04 Phase 1 scope: API-only with documented future UI surfaces

## Restored Backend Source Files

- src/app/config.ts
- src/app/index.ts
- src/app/netlify.ts
- src/app/server.ts
- src/app/worker.ts
- src/features/auth/authRoutes.ts
- src/features/auth/authService.ts
- src/features/auth/providers/baseOAuthProvider.ts
- src/features/auth/providers/cloudflareAccessProvider.ts
- src/features/auth/providers/giteeProvider.ts
- src/features/auth/providers/githubProvider.ts
- src/features/auth/providers/googleProvider.ts
- src/features/auth/providers/index.ts
- src/features/auth/providers/nodeLocProvider.ts
- src/features/auth/providers/telegramProvider.ts
- src/features/auth/sessionService.ts
- src/features/auth/wcProxyRoutes.ts
- src/features/auth/web3WalletAuthService.ts
- src/features/auth/webAuthnService.ts
- src/features/backup/backupRoutes.ts
- src/features/backup/backupService.ts
- src/features/backup/providers/backupProvider.ts
- src/features/backup/providers/baiduNetdiskProvider.ts
- src/features/backup/providers/dropboxProvider.ts
- src/features/backup/providers/emailProvider.ts
- src/features/backup/providers/githubProvider.ts
- src/features/backup/providers/googleDriveProvider.ts
- src/features/backup/providers/index.ts
- src/features/backup/providers/oneDriveProvider.ts
- src/features/backup/providers/s3Provider.ts
- src/features/backup/providers/telegramProvider.ts
- src/features/backup/providers/webDavProvider.ts
- src/features/emergency/emergencyRoutes.ts
- src/features/health/healthRoutes.ts
- src/features/share/sharePrimitives.ts
- src/features/share/shareRoutes.ts
- src/features/share/shareSecurity.ts
- src/features/share/shareService.ts
- src/features/share/shareTypes.ts
- src/features/telegram/telegramRoutes.ts
- src/features/tools/toolsRoutes.ts
- src/features/vault/trashService.ts
- src/features/vault/vaultRoutes.ts
- src/features/vault/vaultService.ts
- src/shared/db/d1Executor.ts
- src/shared/db/db.ts
- src/shared/db/dialects.ts
- src/shared/db/executor.ts
- src/shared/db/factory.ts
- src/shared/db/migrator.ts
- src/shared/db/mySqlExecutor.ts
- src/shared/db/pgExecutor.ts
- src/shared/db/repositories/backupRepository.ts
- src/shared/db/repositories/emergencyRepository.ts
- src/shared/db/repositories/sessionRepository.ts
- src/shared/db/repositories/shareRepository.ts
- src/shared/db/repositories/vaultRepository.ts
- src/shared/db/schema/index.ts
- src/shared/db/schema/mysql.ts
- src/shared/db/schema/pg.ts
- src/shared/db/schema/sqlite.ts
- src/shared/db/sqliteExecutor.ts
- src/shared/middleware/auth.ts
- src/shared/middleware/rateLimitMiddleware.ts
- src/shared/middleware/shareRateLimitMiddleware.ts
- src/shared/utils/common.ts
- src/shared/utils/crypto.ts
- src/shared/utils/health.ts
- src/shared/utils/logger.ts
- src/shared/utils/masking.ts
- src/shared/utils/otp/base.ts
- src/shared/utils/otp/index.ts
- src/shared/utils/otp/protocols/blizzard.ts
- src/shared/utils/otp/protocols/hotp.ts
- src/shared/utils/otp/protocols/steam.ts
- src/shared/utils/otp/protocols/totp.ts
- src/shared/utils/staticServer.ts
- src/shared/utils/ua.ts
