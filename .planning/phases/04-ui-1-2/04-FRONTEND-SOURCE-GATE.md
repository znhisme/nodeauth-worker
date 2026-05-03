---
phase: 04-ui-1-2
plan: 03
status: blocked
created: 2026-05-04
gate: frontend-source
---

# Frontend Source Gate

## Status

status: blocked

Editable Vue frontend source is not available in this checkout. This plan must not implement the requested UI by patching generated Vite output.

## Command Result

Source presence command:

```bash
test -f frontend/package.json || test -d frontend/src
```

Result:

```text
exit:1
```

Discovery command:

```bash
find frontend -maxdepth 3 -type f \( -name 'package.json' -o -path '*/src/*' \) | sort
```

Result:

```text
<no files>
```

Observed frontend directories:

```text
frontend
frontend/dist
frontend/dist/assets
```

## Generated Output Rule

Do not hand-edit frontend/dist/assets/*.js as the primary UI implementation path.

`frontend/dist/**` may be used as evidence of existing Vue, Vite, Element Plus, navigation, and selection behavior, but it is generated output. Restore editable Vue source before implementing owner share-management UI.

## Required Source Restoration

Before implementing Phase 4 UI work, restore a maintainable frontend source tree such as:

- `frontend/package.json`
- `frontend/src/**`
- Vue/Vite build configuration needed to regenerate `frontend/dist/**`

After source restoration, implementation must regenerate frontend build output through package scripts rather than manually editing generated chunks.

## UI Implementation Contract

Restored editable source must implement these surfaces from `04-UI-SPEC.md`:

- Add authenticated left navigation item `Manage Shares`.
- Add a `Manage Shares` page for owner-safe share metadata.
- Support single-account create, create-new-link/regenerate, and revoke flows.
- Preserve My Accounts bulk selection semantics.
- Preserve select-all-loaded behavior.
- Preserve group-select-all behavior as loaded accounts in the current group unless a backend all-matching selection endpoint is added.
- Add the My Accounts toolbar actions in this order: `Delete`, `Share`, `Cancel`.
- Keep batch share online-only.
- Show one-time result dialogs for single and batch share creation.
- Include one-time copy text: `Copy the link and access code now. NodeAuth cannot show this access code again.`
- Include batch one-time copy text: `Copy each link and access code now. Access codes are shown only once.`
- Include offline disabled text: `Sharing requires a network connection. Reconnect and try again.`
- Include replacement warning text that creating new links replaces current active links and old links stop working.
- Include revocation limitation copy that revocation blocks future access but cannot retract already viewed or copied credentials.

## Privacy And Storage Requirements

Restored-source UI work must not persist or log sensitive share material:

- Do not store raw share tokens.
- Do not store raw share URLs.
- Do not store access codes.
- Do not store passwords.
- Do not store OTP codes.
- Do not store OTP seeds.
- Do not store shared item responses.
- Do not place raw share tokens, URLs, access codes, passwords, OTP codes, or OTP seeds in local storage.
- Do not place those values in IndexedDB.
- Do not place those values in service-worker cache.
- Do not place those values in route state or query params.
- Do not log full share URLs, access codes, passwords, OTP codes, OTP seeds, token hashes, access-code hashes, limiter keys, owner IDs, or internal diagnostics.
- Do not enqueue share creation, batch sharing, revoke, or recipient unlock in offline sync.

## Backend Dependency

The UI must rely on backend truth for latest-share-wins. It must not simulate share replacement by hiding older active rows while old links remain usable.

Required backend behaviors are now covered by regenerated Worker, Docker, and Netlify bundles:

- `revokeActiveForOwnerVaultItem`
- `createSharesForOwnerBatch`
- generic public `share_inaccessible` responses
- `Cache-Control` and `Referrer-Policy` public privacy headers

## Verification Commands

```bash
test -f .planning/phases/04-ui-1-2/04-FRONTEND-SOURCE-GATE.md
rg -n "status: blocked|status: source-present" .planning/phases/04-ui-1-2/04-FRONTEND-SOURCE-GATE.md
rg -n "Do not hand-edit frontend/dist/assets/\*\.js" .planning/phases/04-ui-1-2/04-FRONTEND-SOURCE-GATE.md
rg -n "Manage Shares|Delete.*Share.*Cancel|Copy the link and access code now|Sharing requires a network connection" .planning/phases/04-ui-1-2/04-FRONTEND-SOURCE-GATE.md
```
