---
status: completed
created: "2026-05-04T07:07:56Z"
completed: "2026-05-04T07:35:00Z"
---

# Quick Task: Default Share Link TTL 30 Days

## Goal

Change default owner-created share link expiration to 30 days.

## Plan

1. Update share-link TTL constants so default creation uses 30 days and the max clamp allows that default.
2. Add regression coverage for default expiration.
3. Rebuild generated backend runtime bundles.
4. Run targeted/full backend verification.

## Result

Completed. Default owner-created share links now expire after 30 days, generated backend bundles were rebuilt, and backend tests pass.
