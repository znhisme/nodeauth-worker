---
phase: 03-cleanup-compatibility-and-hardening
reviewed: 2026-05-03T13:08:42Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - backend/dist/docker/server.js
  - backend/dist/docker/server.js.map
  - backend/dist/netlify/api.mjs
  - backend/dist/netlify/api.mjs.map
  - backend/dist/worker/worker.js
  - backend/dist/worker/worker.js.map
  - docs/share-link-security-contract.md
  - scripts/validate_share_schema_alignment.js
  - src/app/index.test.ts
  - src/app/netlify.ts
  - src/app/server.ts
  - src/app/worker.ts
  - src/features/share/shareRoutes.test.ts
  - src/features/share/shareRoutes.ts
  - src/features/share/shareService.test.ts
  - src/features/share/shareService.ts
  - src/features/share/shareTypes.ts
  - src/shared/db/migrator.ts
  - src/shared/db/repositories/shareRepository.test.ts
  - src/shared/db/repositories/shareRepository.ts
  - src/shared/db/schema/mysql.ts
  - src/shared/db/shareSchemaAlignmentValidator.test.ts
  - src/shared/middleware/shareRateLimitMiddleware.test.ts
  - src/shared/middleware/shareRateLimitMiddleware.ts
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-03T13:08:42Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Reviewed the Phase 03 share-link source, runtime bundles, source maps, schema/migration changes, cleanup scheduling, route tests, and validator script. The share privacy and generic public failure behavior is well covered, and the checked runtime bundles include the share routes, service, migrator, and rate-limit middleware. Two MySQL compatibility issues remain in the share schema path.

## Warnings

### WR-01: MySQL Share ID Columns Are Too Short For Generated IDs

**File:** `src/shared/db/schema/mysql.ts:23`
**Issue:** The MySQL `share_links.id` column is `VARCHAR(36)`, but share IDs are generated as `share-${crypto.randomUUID()}` in `src/features/share/shareService.ts:32`, which is 42 characters. Audit IDs use `share-audit-${crypto.randomUUID()}` in `src/shared/db/repositories/shareRepository.ts:94`, which is 48 characters, while `share_audit_events.id` and `share_audit_events.share_id` are also `VARCHAR(36)` in `src/shared/db/schema/mysql.ts:36-37`. On MySQL deployments this can reject share creation/audit inserts or truncate IDs depending on SQL mode. The same too-short widths are present in the MySQL migration block at `src/shared/db/migrator.ts:360` and `src/shared/db/migrator.ts:372-373`, and in all reviewed runtime bundles.

**Fix:**
```typescript
export const shareLinks = mysqlTable('share_links', {
    id: varchar('id', { length: 64 }).primaryKey(),
    vaultItemId: varchar('vault_item_id', { length: 64 }).notNull(),
    // ...
});

export const shareAuditEvents = mysqlTable('share_audit_events', {
    id: varchar('id', { length: 64 }).primaryKey(),
    shareId: varchar('share_id', { length: 64 }).notNull(),
    // ...
});
```

Also update migration 13's MySQL DDL and `scripts/validate_share_schema_alignment.js` expected strings/tests to require the widened columns, then rebuild the Docker, Netlify, and Worker bundles.

### WR-02: MySQL Self-Healing Baseline Can Create Unbounded TEXT Share Columns Before The Fixed Migration Runs

**File:** `src/shared/db/migrator.ts:84`
**Issue:** `BASE_SCHEMA` adds `share_links`, `share_audit_events`, and `share_rate_limits` using SQLite-style `TEXT` columns. During `migrateDatabase`, the baseline runs before pending migrations. For MySQL, `transformSqlForDialect` only rewrites `TEXT PRIMARY KEY`, so columns like `token_hash TEXT NOT NULL` and `owner_id TEXT NOT NULL` remain unbounded `TEXT`. Because migration 13 uses `CREATE TABLE IF NOT EXISTS`, it will not replace these tables once the baseline created them, leaving the exact unbounded MySQL indexed columns that Phase 03's validator is meant to prevent. Docker additionally executes `backend/schema.sql` through the same dialect transformer before `migrateDatabase`, so this can occur before the source migration is reached.

**Fix:** Make the baseline share-table DDL dialect-aware, or define MySQL-safe baseline statements for share tables before executing them. At minimum, for MySQL use bounded columns matching the migration:
```sql
CREATE TABLE IF NOT EXISTS share_links (
    id VARCHAR(64) PRIMARY KEY,
    vault_item_id VARCHAR(64) NOT NULL,
    owner_id VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    access_code_hash VARCHAR(255) NOT NULL,
    expires_at BIGINT NOT NULL,
    revoked_at BIGINT,
    created_at BIGINT NOT NULL,
    last_accessed_at BIGINT,
    access_count BIGINT DEFAULT 0
);
```

Extend `scripts/validate_share_schema_alignment.js` so it checks the transformed baseline path or raw baseline share DDL, not only the migration 13 MySQL block.

---

_Reviewed: 2026-05-03T13:08:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
