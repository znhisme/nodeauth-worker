# Codebase Structure

**Analysis Date:** 2026-05-02

## Directory Layout

```text
nodeauth-worker/
├── backend/              # Server runtime source, bundled outputs, schema, and deployment scripts
├── frontend/             # SPA source output and static PWA assets
├── scripts/              # Build/deployment helper scripts used by backend and wrangler
├── .planning/            # Generated project mapping and planning artifacts
├── wrangler.toml         # Cloudflare Workers deployment config
├── package.json          # Root deployment script and package metadata
└── README.md             # Project overview and deployment references
```

## Directory Purposes

**`backend`:**
- Purpose: Worker backend, database schema, and alternate deployment bundles.
- Contains: Source-derived build outputs in `dist/`, database schema in `schema.sql`, backend package manifest in `package.json`.
- Key files: `backend/package.json`, `backend/schema.sql`, `backend/dist/worker/worker.js`, `backend/dist/netlify/api.mjs`, `backend/dist/docker/server.js`.

**`frontend`:**
- Purpose: Static SPA/PWA assets served by Cloudflare assets.
- Contains: Bundled HTML, JS, CSS, icons, service worker, and WASM assets.
- Key files: `frontend/dist/index.html`, `frontend/dist/manifest.webmanifest`, `frontend/dist/sw.js`, `frontend/dist/assets/*`.

**`scripts`:**
- Purpose: Build-time and runtime helpers for deployment packaging.
- Contains: Node scripts that inject platform variables and prepare Docker/Worker/Netlify builds.
- Key files: `scripts/inject_vars.js`, `scripts/decrypt_backup.js`.

**`.planning`:**
- Purpose: Generated codebase map and planning data.
- Contains: Architecture, structure, and related planning documents.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`.

## Key File Locations

**Entry Points:**
- `backend/dist/worker/worker.js`: Cloudflare Worker bundle exported in `wrangler.toml`.
- `backend/dist/netlify/api.mjs`: Alternate Netlify API bundle.
- `backend/dist/docker/server.js`: Alternate Docker server bundle.
- `frontend/dist/index.html`: SPA shell and asset bootstrap.

**Configuration:**
- `wrangler.toml`: Cloudflare worker entrypoint, assets binding, D1 binding, cron trigger, build command.
- `package.json`: Root deploy script for `wrangler deploy`.
- `backend/package.json`: Backend build, dev, test, and alternate deployment scripts.
- `frontend/dist/manifest.webmanifest`: PWA metadata.

**Core Logic:**
- `src/app/index.ts`: Root Hono app, middleware, route registration, SPA fallback, error handling.
- `src/app/worker.ts`: Worker fetch/scheduled bridge and migration bootstrap.
- `src/features/auth/*`: Authentication routes, providers, sessions, WebAuthn, Web3 auth.
- `src/features/vault/*`: Vault CRUD and trash handling.
- `src/features/backup/*`: Backup scheduling, providers, and routes.
- `src/shared/db/*`: Schema, migrations, repositories, and dialect helpers.
- `src/shared/utils/*`: Logger, crypto, OTP, health checks, masking, user-agent helpers.

**Testing:**
- Not detected in the repository root. No dedicated `tests/`, `*.test.*`, or `*.spec.*` sources were present in the observed tree.

## Naming Conventions

**Files:**
- Route modules use feature-prefixed names such as `authRoutes.ts`, `vaultRoutes.ts`, `backupRoutes.ts`, `healthRoutes.ts`.
- Provider implementations use provider-specific names such as `githubProvider.ts`, `dropboxProvider.ts`, `telegramProvider.ts`.
- Shared helpers use short capability names such as `crypto.ts`, `health.ts`, `masking.ts`, `ua.ts`.

**Directories:**
- Feature domains are grouped under `src/features/<domain>/`.
- Shared cross-cutting code is grouped under `src/shared/<area>/`.
- Database schema and repository code is grouped under `src/shared/db/`.

## Where to Add New Code

**New Feature:**
- Primary code: `src/features/<new-feature>/`
- Tests: `backend/`-level test location is not present; colocate tests beside the feature modules or add a dedicated backend test directory if one is introduced.

**New Component/Module:**
- Implementation: `src/features/<domain>/` for domain code, `src/shared/<area>/` for reusable helpers.

**Utilities:**
- Shared helpers: `src/shared/utils/`
- Database access helpers: `src/shared/db/`

## Special Directories

**`backend/dist`:**
- Purpose: Generated deployment bundles for worker, Docker, and Netlify targets.
- Generated: Yes
- Committed: Yes

**`frontend/dist`:**
- Purpose: Generated static frontend assets, service worker, WASM blobs, and PWA media.
- Generated: Yes
- Committed: Yes

**`.planning/codebase`:**
- Purpose: Generated codebase mapping documents consumed by later GSD steps.
- Generated: Yes
- Committed: Yes

---

*Structure analysis: 2026-05-02*
