---
phase: 04-ui-1-2
slug: ui-1-2
status: blocked
threats_open: 3
asvs_level: 1
audited: 2026-05-04
---

# Phase 04-ui-1-2 - Security

Per-phase security verification for the supplied Phase 04 open threat register. This audit verifies only the three declared mitigations for latest-share-wins concurrency and generated backend bundle parity. Implementation files were read only; no source or bundle files were modified.

## Config

| Key | Value |
|-----|-------|
| ASVS Level | 1 |
| block_on | open_mitigations |

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Expected | Status |
|-----------|----------|-----------|-------------|---------------------|--------|
| 04-01/T-04-01 | Tampering | `ShareService.createShare` / `ShareRepository.revokeActiveForOwnerVaultItem` | mitigate | Atomic replace-active-share persistence primitive or database-enforced active-share guard with retry/conflict handling, plus regression coverage proving concurrent creates cannot leave multiple active owner+vault shares. | open |
| 04-02/T-04-01 | Tampering | `createSharesForOwnerBatch` | mitigate | Batch create must rely on a concurrency-safe latest-share-wins implementation, not only sequential delegation to `createShareForOwner`. | open |
| 04-03/T-04-01 | Tampering | generated backend bundles | mitigate | Regenerated Worker, Docker, and Netlify bundles must contain the fixed atomic/latest-share-wins implementation after source remediation, not only current marker strings. | open |

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| 04-01/T-04-01 | Tampering | mitigate | open | `src/features/share/shareService.ts:89` revokes active shares, but `src/features/share/shareService.ts:114` inserts the new active share later as a separate operation. `src/shared/db/repositories/shareRepository.ts:62`-`87` performs separate select/update revocation and provides no atomic replace primitive, transaction boundary, active-share uniqueness guard, conflict handling, or retry loop. Tests assert sequential call order at `src/features/share/shareService.test.ts:247`-`252` and repository predicates at `src/shared/db/repositories/shareRepository.test.ts:153`-`184`, but no concurrent-create regression proves one active share remains. |
| 04-02/T-04-01 | Tampering | mitigate | open | Batch creation at `src/features/share/shareService.ts:178`-`195` loops through IDs and delegates each successful row to `createShareForOwner` at `src/features/share/shareService.ts:185`. Because the delegated create path is still non-atomic, the batch implementation relies on sequential delegation rather than a concurrency-safe latest-share-wins implementation. Tests at `src/features/share/shareService.test.ts:293`-`390` cover ordered delegation and privacy-safe failures, not concurrent owner+vault replacement safety. |
| 04-03/T-04-01 | Tampering | mitigate | open | Generated runtimes contain the same non-atomic revoke-then-insert sequence: Worker revokes at `backend/dist/worker/worker.js:7448` and inserts at `backend/dist/worker/worker.js:7471`; Docker revokes at `backend/dist/docker/server.js:7478` and inserts at `backend/dist/docker/server.js:7501`; Netlify revokes at `backend/dist/netlify/api.mjs:7469` and inserts at `backend/dist/netlify/api.mjs:7492`. Repository bundle code likewise uses separate select/update revocation in Worker `backend/dist/worker/worker.js:7197`-`7213`, Docker `backend/dist/docker/server.js:7227`-`7243`, and Netlify `backend/dist/netlify/api.mjs:7218`-`7234`. |

## Open Threats

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

## Sign-Off

- [x] All supplied threats classified by disposition
- [x] Threat flags from summaries incorporated
- [x] Implementation files left read-only
- [ ] `threats_open: 0` confirmed
- [ ] `status: verified` set in frontmatter

Approval: blocked pending atomic/latest-share-wins concurrency mitigation and regenerated Worker/Docker/Netlify bundles containing that fixed implementation.
