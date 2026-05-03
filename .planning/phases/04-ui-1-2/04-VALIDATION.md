---
phase: 4
slug: ui-1-2
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-04
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `backend/vitest.config.ts` |
| **Quick run command** | `cd backend && npm test -- ../src/features/share/shareService.test.ts ../src/features/share/shareRoutes.test.ts` |
| **Full suite command** | `cd backend && npm test` |
| **Estimated runtime** | ~10-30 seconds |

---

## Sampling Rate

- **After every backend task commit:** Run `cd backend && npm test -- ../src/features/share/shareService.test.ts ../src/features/share/shareRoutes.test.ts`
- **After every plan wave:** Run `cd backend && npm test`
- **After backend source changes:** Regenerate runtime bundles with `cd backend && npm run build:worker && npm run build:docker && npm run build:netlify && npm run build:vercel`
- **Before `$gsd-verify-work`:** Full suite and required backend builds must be green
- **Max feedback latency:** 60 seconds for targeted tests, 5 minutes for full backend build/test gates

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PH4-BE-01 | T-04-01 | Creating or regenerating a share revokes older active shares for the same owner and vault item before returning the new one-time link. | unit/service | `cd backend && npm test -- ../src/features/share/shareService.test.ts` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | PH4-BE-01 | T-04-01 | Public access to the older link returns the existing generic inaccessible response after replacement. | unit/service | `cd backend && npm test -- ../src/features/share/shareService.test.ts` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 1 | PH4-BE-02 | T-04-03 | Batch share validates owner access per item and returns one-time raw public URL/access code only for successful rows. | route/service | `cd backend && npm test -- ../src/features/share/shareRoutes.test.ts` | ✅ | ⬜ pending |
| 04-02-02 | 02 | 1 | PH4-SEC-01 | T-04-03 | Batch partial failures expose only owner-safe item labels and generic failure data. | route/service | `cd backend && npm test -- ../src/features/share/shareRoutes.test.ts` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 2 | PH4-UI-01 | T-04-02 | UI execution is blocked unless editable Vue frontend source exists; generated Vite chunks are not the primary edit surface. | file/plan gate | `test -f frontend/package.json || test -d frontend/src` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 2 | PH4-UI-02 | T-04-02 | Account selection and batch share controls follow UI-SPEC, including Share between Delete and Cancel. | frontend/manual or component test | blocked until editable frontend source exists | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/share/shareService.test.ts` — add tests for latest-share-wins revocation on same owner and vault item.
- [ ] `src/features/share/shareRoutes.test.ts` — add tests for batch share response shape, one-time secrets, safe partial failures, and privacy allowlist.
- [ ] `frontend/package.json` or `frontend/src/**` — restore editable Vue frontend source before implementing left navigation, share management page, or My Accounts bulk share controls.
- [ ] Generated backend bundle assertions — after backend source changes, verify `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, and `backend/dist/netlify/api.mjs` contain the new route/service behavior.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Left navigation includes `Manage Shares` | PH4-UI-01 | Editable frontend source is absent in this checkout. | After source restoration and implementation, run the frontend locally, sign in, verify `Manage Shares` appears in the left menu and opens the owner share management page. |
| My Accounts toolbar order is `Delete`, `Share`, `Cancel` | PH4-UI-02 | Editable frontend source is absent in this checkout. | Select one account and a group of loaded accounts; verify the toolbar action order and that `Share` opens the batch one-time handoff flow. |
| Raw share secrets disappear after dialog close | PH4-SEC-01 | Browser storage and component state require runtime inspection. | Create single and batch shares, close result dialogs, refresh metadata, and verify access codes cannot be recovered from UI, local storage, IndexedDB, service-worker cache, URL, or logs. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5 minutes
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-04
