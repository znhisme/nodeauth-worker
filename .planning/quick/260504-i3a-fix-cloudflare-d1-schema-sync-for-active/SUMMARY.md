---
quick_id: 260504-i3a
slug: fix-cloudflare-d1-schema-sync-for-active
status: complete
completed: 2026-05-04
---

# Summary: Fix Cloudflare D1 schema sync for active_share_key deployment

## Completed

- Removed `idx_share_links_active_share_key` creation from `backend/schema.sql`.
- Kept `active_share_key` bootstrap column in `backend/schema.sql` for fresh databases.
- Left unique index creation in runtime migration v14, after the migration adds the column and normalizes existing active share rows.

## Verification

- `cd backend && npm test`
- Confirmed `backend/schema.sql` no longer references `idx_share_links_active_share_key`.
- Confirmed `src/shared/db/migrator.ts` still creates `idx_share_links_active_share_key`.

## Result

Cloudflare `d1 execute --file=backend/schema.sql` no longer tries to create an index on a column that may not exist in pre-upgrade D1 databases. Runtime migration v14 remains responsible for the actual active-share uniqueness enforcement.
