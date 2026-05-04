---
phase: 05
slug: api-token-api-api-token
status: complete
created: 2026-05-04
---

# Phase 05 Research — API Token Account Import

## Research Complete

Phase 5 should add an automation-friendly import API while preserving the existing vault import behavior and the current browser session security model.

## Current Implementation Facts

- `src/features/vault/vaultRoutes.ts` already exposes `POST /api/vault/import` behind `vault.use('/*', authMiddleware)` and a strict `rateLimit({ windowMs: 60 * 1000, max: 5 })`.
- `src/features/vault/vaultService.ts` already centralizes import parsing in `importAccounts(userId, type, content, password?)`.
- Existing import formats are `encrypted`, `json`, `2fas`, `text`, and `raw`.
- Existing import logic handles NodeAuth JSON, array imports, 2FAS `services`, `secrets`, otpauth text lines, encrypted exports, duplicate skipping, batch de-duplication, and soft-deleted account revival.
- Account creation and import both rely on `normalizeOtpAccount()` and `validateBase32Secret()` before encrypted persistence.
- Existing `authMiddleware` in `src/shared/middleware/auth.ts` only accepts the `auth_token` cookie and always requires matching `csrf_token` cookie plus `X-CSRF-Token` header.
- JWT verification is implemented by `verifySecureJWT()` in `src/shared/utils/crypto.ts`; valid JWT payloads include `userInfo` and `sessionId`.
- The middleware validates `sessionId` with `SessionService.validateSession(sessionId)`, so kicked-out or expired sessions are rejected even if the JWT signature is valid.
- `src/app/index.ts` already allows the `Authorization` header in API CORS, but there is no first-party Bearer-token auth path for vault routes yet.
- Backend source is restored under `src/`; generated runtime bundles live under `backend/dist/**` and must be regenerated through `backend/scripts/build-worker.js`, `build-docker.js`, and `build-netlify.js`.

## API Contract Recommendation

Use the existing endpoint path where possible:

- `POST /api/vault/import`
- Browser clients keep using cookie + CSRF exactly as today.
- Automation clients may send `Authorization: Bearer <auth_token_jwt>`.
- Bearer mode must not require the CSRF cookie/header because Bearer tokens are not automatically attached by browsers.
- Bearer mode must still validate the JWT signature, `payload.userInfo`, `payload.sessionId`, and active DB session.
- The route body remains `{ type, content, password? }`, and the response remains `{ success: true, count, duplicates, pending }`.

This route-level compatibility avoids introducing a second import implementation. It also means frontend callers and API callers share the same service contract and validation rules.

## Implementation Shape

Create a small shared authentication helper instead of weakening `authMiddleware` directly:

- Add `getAuthTokenFromRequest(c)` or `resolveRequestAuth(c)` in `src/shared/middleware/auth.ts`.
- Prefer cookie auth when `auth_token` is present so existing browser CSRF behavior is unchanged.
- Accept `Authorization: Bearer <token>` only when no cookie token is used, or define an explicit precedence rule that still enforces CSRF for cookie-authenticated requests.
- Reject malformed authorization schemes with `no_session` or `invalid_authorization_header` using `AppError`.
- Verify Bearer token with the same `verifySecureJWT()` and `SessionService.validateSession()` path used by cookie auth.
- Set both `user` and `sessionId` on Hono context for either auth source.
- Keep CSRF enforcement scoped to cookie auth.

The import route itself can continue to call:

```ts
const user = c.get('user');
const { content, type, password } = await c.req.json();
const result = await service.importAccounts(user.email || user.id, type, content, password);
return c.json({ success: true, ...result });
```

## Security Considerations

| Risk | Required Planning Response |
|------|----------------------------|
| CSRF bypass for browser cookies | Do not globally remove CSRF. Only Bearer auth skips CSRF; cookie auth still requires double-submit CSRF. |
| JWT replay after logout or device kick | Bearer auth must validate `sessionId` with `SessionService.validateSession()`. |
| Token leakage in logs | Do not log `Authorization` headers, raw import payloads, or secrets. Existing Hono log format logs request lines only; tests should guard against adding header logging. |
| Import brute force / resource abuse | Preserve the existing import `rateLimit({ windowMs: 60 * 1000, max: 5 })`. |
| Secret material exposure | Response must remain aggregate-only and must not return imported secrets. |
| Payload ambiguity | Keep existing formats and error codes: `missing_content_type`, `import_password_required`, `parse_failed`, and service-level validation failures. |
| Cross-runtime drift | Build and verify Worker, Docker, and Netlify bundles after source changes. |

## Likely Files

- `src/shared/middleware/auth.ts` — add Bearer-token request auth while preserving cookie CSRF.
- `src/features/vault/vaultRoutes.ts` — likely unchanged except possible comments/types; route already uses `authMiddleware`.
- `src/features/vault/vaultService.ts` — likely unchanged because import behavior should be reused.
- `src/shared/middleware/auth.test.ts` — add focused auth middleware tests for cookie, CSRF, Bearer success, malformed Bearer, expired token, invalid session, and cookie precedence.
- `src/features/vault/vaultRoutes.test.ts` — add route-level import test proving `Authorization: Bearer` reaches `VaultService.importAccounts()` and preserves response shape without CSRF.
- `src/app/index.test.ts` or generated assertion script — verify `Authorization` remains allowed in CORS and generated bundles contain Bearer auth path.
- `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, `backend/dist/netlify/api.mjs` — regenerated output only.

## Validation Architecture

Use Vitest as the primary automated gate:

- `npm --prefix backend test -- src/shared/middleware/auth.test.ts`
- `npm --prefix backend test -- src/features/vault/vaultRoutes.test.ts`
- `npm --prefix backend test -- src/app/index.test.ts`
- `npm --prefix backend test`

Use build verification for all supported runtimes:

- `npm --prefix backend run build:worker`
- `npm --prefix backend run build:docker`
- `npm --prefix backend run build:netlify`

Use grep assertions after builds:

- `rg -n "Authorization|Bearer|csrf_mismatch|validateSession" src/shared/middleware/auth.ts backend/dist/worker/worker.js backend/dist/docker/server.js backend/dist/netlify/api.mjs`
- `rg -n "vault\\.post\\('/import'|importAccounts\\(" src/features/vault/vaultRoutes.ts src/features/vault/vaultService.ts`

## Open Decisions for Execution

- Whether malformed non-Bearer `Authorization` should return `no_session` or a new `invalid_authorization_header` error. Either is acceptable if tests lock the chosen behavior.
- Whether cookie and Bearer both present should prefer cookie auth or reject ambiguous credentials. Recommended default: prefer cookie auth and enforce CSRF so browser behavior remains strict.
