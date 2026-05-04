---
quick_id: 260504-i3a
slug: fix-cloudflare-d1-schema-sync-for-active
status: planned
created: 2026-05-04
---

# Quick Task: Fix Cloudflare D1 schema sync for active_share_key deployment

## Objective

Make the Cloudflare GitHub Actions schema sync safe for existing D1 databases that do not yet have `share_links.active_share_key`.

## Plan

1. Keep `backend/schema.sql` as a bootstrap schema for fresh databases.
2. Avoid creating the `active_share_key` unique index from `backend/schema.sql`, because `CREATE TABLE IF NOT EXISTS` does not add new columns to existing D1 tables.
3. Leave active-share uniqueness creation in runtime migration v14, which adds the column, normalizes existing rows, and then creates the unique index.
4. Run backend tests and commit the deployment fix.

## Success Criteria

- `backend/schema.sql` no longer references `idx_share_links_active_share_key`.
- Runtime migration v14 still creates `idx_share_links_active_share_key`.
- Backend tests pass.
