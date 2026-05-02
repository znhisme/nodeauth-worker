PASS

Phase 1 schema, migration, repository, tests, and generated backend outputs are aligned across the supported backend targets.

## Command Evidence

All commands exited `0` on 2026-05-02:

- `node scripts/restore_backend_source_from_sourcemaps.js --verify`
- `npm ci --prefix backend`
- `npm --prefix backend test`
- `npm --prefix backend run build:worker`
- `npm --prefix backend run build:docker`
- `npm --prefix backend run build:netlify`
- `node scripts/validate_share_schema_alignment.js`

## Validation Coverage

- Source schema files include `share_links`, `share_audit_events`, `share_rate_limits`, hashed token/access-code columns, owner/vault item columns, expiration, revocation, and runtime migration version `13`.
- `backend/schema.sql` includes the D1/SQLite baseline share tables and indexes.
- Worker, Docker, and Netlify generated backend outputs include share table names plus `share_item_inaccessible` and `share_inaccessible` enforcement signals.
- Share primitives are intentionally imported by the app bundle through `SHARE_PRIMITIVES` without mounting public share routes before the route phase owns that behavior.
