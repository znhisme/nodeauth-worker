---
phase: 05
slug: api-token-api-api-token
status: complete
created: 2026-05-04
---

# Phase 05 Pattern Map — API Token Account Import

## Closest Existing Patterns

| New/Changed File | Role | Closest Analog | Pattern to Preserve |
|------------------|------|----------------|---------------------|
| `src/shared/middleware/auth.ts` | Authentication middleware | Existing `authMiddleware` cookie + CSRF + JWT + session validation flow | Keep `AppError` codes, `verifySecureJWT()`, `SessionService.validateSession()`, and `c.set('user')` / `c.set('sessionId')`. |
| `src/features/vault/vaultRoutes.ts` | Hono route module | Existing `vault.post('/import', rateLimit(...))` | Keep route mounted under `/api/vault`, keep import limiter, and call `VaultService.importAccounts()` once with `user.email || user.id`. |
| `src/features/vault/vaultService.ts` | Import service | Existing `importAccounts()` | Reuse unchanged unless a test reveals missing contract; do not duplicate import parsing in route code. |
| `src/features/share/shareRoutes.test.ts` | Route-level service stubbing | Existing share route tests | Stub service factory or repository dependencies at route boundary and assert exact service inputs/JSON output. |
| `src/shared/middleware/shareRateLimitMiddleware.test.ts` | Middleware unit test shape | Existing share middleware tests | Build small fake Hono context objects and assert `next()` calls/errors without booting full app. |
| `backend/scripts/build-*.js` | Runtime bundle generation | Existing backend build scripts | Regenerate `backend/dist/**` only through npm build scripts; do not hand-patch dist bundles. |

## Required Code Excerpts

### Existing Vault Import Route

`src/features/vault/vaultRoutes.ts`:

```ts
vault.post('/import', rateLimit({
    windowMs: 60 * 1000,
    max: 5,
}), async (c) => {
    const user = c.get('user');
    const service = getService(c);
    const { content, type, password } = await c.req.json();

    const result = await service.importAccounts(user.email || user.id, type, content, password);
    return c.json({ success: true, ...result });
});
```

This is the implementation target for API automation. The plan should keep the body and response shape compatible.

### Existing Auth Middleware

`src/shared/middleware/auth.ts`:

```ts
const token = getCookie(c, 'auth_token');
if (!token) {
    throw new AppError('no_session', 401);
}

const csrfCookie = getCookie(c, 'csrf_token');
const csrfHeader = c.req.header('X-CSRF-Token');
if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    throw new AppError('csrf_mismatch', 403);
}

const payload = await verifySecureJWT(token, c.env.JWT_SECRET);
...
const isValid = await sessionService.validateSession(sessionId);
```

Bearer auth must reuse the JWT/session half of this flow and must not remove the CSRF half for cookie auth.

### Existing Runtime Build Pattern

`backend/package.json`:

```json
"build:worker": "node scripts/build-worker.js",
"build:docker": "node scripts/build-docker.js",
"build:netlify": "node scripts/build-netlify.js"
```

Plan verification should use these scripts to regenerate `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, and `backend/dist/netlify/api.mjs`.

## Data Flow

1. Automation client sends `POST /api/vault/import` with `Authorization: Bearer <auth_token_jwt>`.
2. `authMiddleware` resolves Bearer token when no cookie-authenticated browser session is being used.
3. Middleware verifies JWT with `JWT_SECRET`, extracts `userInfo` and `sessionId`, validates session in DB, and sets Hono variables.
4. Vault import route reads `{ type, content, password }`.
5. `VaultService.importAccounts()` parses supported formats and persists encrypted vault rows through existing repository/db helpers.
6. Route returns aggregate counts only.

## Constraints for Planner

- Do not add a second import parser.
- Do not remove CSRF from cookie auth.
- Do not accept Bearer tokens without session validation.
- Do not return imported account secrets in the API response.
- Do not edit `backend/dist/**` manually; regenerate it after source tests pass.
