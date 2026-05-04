---
quick_id: 260504-h9f
slug: fix-phase-04-latest-share-wins-concurren
status: complete
completed: 2026-05-04
---

# Summary: Fix Phase 04 latest-share-wins concurrency security gap

## Completed

- Added nullable `active_share_key` / `activeShareKey` to share schemas.
- Added unique `idx_share_links_active_share_key` in baseline schema and migration v14.
- Made migration v14 revoke older duplicate active owner+vault rows and retain only the newest active share before creating the unique index.
- Added `ShareRepository.createReplacingShareLink()` with active-key insertion and unique-conflict retry.
- Updated `ShareService.createShare()` to use the conflict-safe replacement path.
- Added focused repository regression tests for active-key writes and unique-conflict retry.
- Regenerated Worker, Docker, and Netlify backend bundles.
- Updated Phase 04 security and verification artifacts to `verified`.

## Verification

- `cd backend && npm test`
- `cd backend && npm run build:worker && npm run build:docker && npm run build:netlify`
- `node scripts/restore_backend_source_from_sourcemaps.js --verify`
- Bundle marker checks for `active_share_key`, `idx_share_links_active_share_key`, `createReplacingShareLink`, `share_replace_conflict`, and `createSharesForOwnerBatch`.

## Result

Phase 04 latest-share-wins security blocker is closed. `04-SECURITY.md` now reports `threats_open: 0`, and `04-VERIFICATION.md` now reports `status: verified`.
