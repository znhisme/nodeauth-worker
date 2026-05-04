---
status: complete
completed: 2026-05-04
files:
  - docs/api-token-import.md
  - scripts/import_accounts_with_token.js
---

# API Token Import Guide Summary

Added a stored tutorial for obtaining the logged-in `auth_token` and importing accounts through `POST /api/vault/import` with `Authorization: Bearer <token>`.

Added a reusable Node.js helper script that reads an import file and calls the existing API with the supplied token.

