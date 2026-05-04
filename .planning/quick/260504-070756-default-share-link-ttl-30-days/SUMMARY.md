---
status: complete
completed: "2026-05-04T07:10:00Z"
---

# Summary: Default Share Link TTL 30 Days

## Completed

- Changed share-link default TTL to 30 days.
- Raised share-link max TTL to 30 days so the new default is accepted by clamp/validation.
- Added a service regression test proving default share creation expires after 30 days.
- Rebuilt Worker, Docker, and Netlify backend bundles.

## Verification

- `cd backend && npm test` passed: 11 files, 113 tests.
- Bundle marker check confirms `SHARE_DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60` and `SHARE_MAX_TTL_SECONDS = 30 * 24 * 60 * 60` in Worker, Docker, and Netlify outputs.
