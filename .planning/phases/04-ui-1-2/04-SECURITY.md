---
phase: 04-ui-1-2
slug: ui-1-2
status: verified
threats_open: 0
asvs_level: 1
audited: 2026-05-04
---

# Phase 04-ui-1-2 - Security

Per-phase security verification for the supplied Phase 04 open threat register. This audit verifies only the three declared mitigations for latest-share-wins concurrency and generated backend bundle parity.

## Config

| Key | Value |
|-----|-------|
| ASVS Level | 1 |
| block_on | open_mitigations |

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Expected | Status |
|-----------|----------|-----------|-------------|---------------------|--------|
| 04-01/T-04-01 | Tampering | `ShareService.createShare` / `ShareRepository.revokeActiveForOwnerVaultItem` | mitigate | Atomic replace-active-share persistence primitive or database-enforced active-share guard with retry/conflict handling, plus regression coverage proving concurrent creates cannot leave multiple active owner+vault shares. | closed |
| 04-02/T-04-01 | Tampering | `createSharesForOwnerBatch` | mitigate | Batch create must rely on a concurrency-safe latest-share-wins implementation, not only sequential delegation to `createShareForOwner`. | closed |
| 04-03/T-04-01 | Tampering | generated backend bundles | mitigate | Regenerated Worker, Docker, and Netlify bundles must contain the fixed atomic/latest-share-wins implementation after source remediation, not only current marker strings. | closed |

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| 04-01/T-04-01 | Tampering | mitigate | closed | `src/shared/db/schema/sqlite.ts`, `src/shared/db/schema/mysql.ts`, and `src/shared/db/schema/pg.ts` now define nullable `activeShareKey` / `active_share_key`; `backend/schema.sql` and `src/shared/db/migrator.ts` create unique `idx_share_links_active_share_key`. Migration v14 revokes older duplicate active rows and assigns the active key only to the latest retained owner+vault share before creating the unique index. `ShareRepository.createReplacingShareLink()` writes `activeShareKey = ownerId:vaultItemId`, retries unique conflicts, and `revokeActiveForOwnerVaultItem()` clears the key while revoking. Tests cover active-key insertion and unique-conflict retry in `src/shared/db/repositories/shareRepository.test.ts`. |
| 04-02/T-04-01 | Tampering | mitigate | closed | `ShareService.createShare()` now delegates replacement to `createReplacingShareLink()` at `src/features/share/shareService.ts:96`, so `createSharesForOwnerBatch()` continues to inherit the same conflict-safe single-share path through `createShareForOwner()`. Service tests still cover batch delegation, ordered successes/failures, and privacy-safe failure rows. |
| 04-03/T-04-01 | Tampering | mitigate | closed | Worker, Docker, and Netlify bundles were regenerated and contain `active_share_key`, `idx_share_links_active_share_key`, `createReplacingShareLink`, `share_replace_conflict`, and `createSharesForOwnerBatch` markers. `node scripts/restore_backend_source_from_sourcemaps.js --verify` exited 0. |

## Closed Threats

| Threat ID | Category | Mitigation Expected | Files Searched |
|-----------|----------|---------------------|----------------|
| 04-01/T-04-01 | Tampering | Atomic replace-active-share persistence primitive or database-enforced active-share guard with retry/conflict handling, plus regression coverage proving concurrent creates cannot leave multiple active owner+vault shares. | `src/features/share/shareService.ts`, `src/shared/db/repositories/shareRepository.ts`, `src/features/share/shareService.test.ts`, `src/shared/db/repositories/shareRepository.test.ts`, `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, `backend/dist/netlify/api.mjs` |
| 04-02/T-04-01 | Tampering | Batch create must rely on a concurrency-safe latest-share-wins implementation, not only sequential delegation to `createShareForOwner`. | `src/features/share/shareService.ts`, `src/features/share/shareService.test.ts`, `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, `backend/dist/netlify/api.mjs` |
| 04-03/T-04-01 | Tampering | Regenerated Worker, Docker, and Netlify bundles must contain the fixed atomic/latest-share-wins implementation after source remediation, not only current marker strings. | `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, `backend/dist/netlify/api.mjs` |

## Threat Flags

The `## Threat Flags` sections in `04-01-SUMMARY.md`, `04-02-SUMMARY.md`, and `04-03-SUMMARY.md` all report `None`. No unregistered flags were added.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | ASVS Level | Run By |
|------------|---------------|--------|------|------------|--------|
| 2026-05-04 | 3 | 0 | 3 | 1 | Codex gsd-security-auditor |
| 2026-05-04 | 3 | 3 | 0 | 1 | Codex re-run after quick task 260504-h9f |

## Sign-Off

- [x] All supplied threats classified by disposition
- [x] Threat flags from summaries incorporated
- [x] Runtime bundles regenerated from source
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

Approval: verified 2026-05-04 after atomic/latest-share-wins uniqueness guard, retry handling, tests, and Worker/Docker/Netlify bundle regeneration.
