# Testing Patterns

**Analysis Date:** 2026-05-02

## Test Framework

**Runner:**
- Vitest `^4.1.0` is declared in `backend/package.json`.
- Coverage provider `@vitest/coverage-v8` `^4.1.0` is declared in `backend/package.json`.
- Config: Not detected. No `vitest.config.*`, `vite.config.*`, or `tsconfig.json` is committed in the current checkout.

**Assertion Library:**
- Vitest built-in assertions are implied by the declared `vitest` dependency in `backend/package.json`.
- No committed test files are detected, so no project-specific assertion style is present.

**Run Commands:**
```bash
npm --prefix backend test              # Run backend Vitest test script declared in backend/package.json
npx --prefix backend vitest            # Watch mode if backend dependencies are installed
npx --prefix backend vitest run --coverage # Coverage if backend dependencies are installed
```

## Test File Organization

**Location:**
- No `*.test.*` or `*.spec.*` files are detected in the checkout.
- Use co-located tests beside restored source files when adding tests because the embedded source tree is feature-oriented: `src/features/vault/vaultService.test.ts` beside `src/features/vault/vaultService.ts`, `src/shared/utils/otp/index.test.ts` beside `src/shared/utils/otp/index.ts`.
- If a separate test tree is introduced, mirror embedded source paths under `backend/test/` or `backend/tests/`; no such directory exists currently.

**Naming:**
- Use `*.test.ts` for TypeScript unit tests to match Vitest defaults.
- Use the source module name as the test file stem: `vaultRepository.test.ts`, `authMiddleware.test.ts`, `totp.test.ts`.

**Structure:**
```
backend/
├── package.json                 # Declares "test": "vitest run"
├── schema.sql                   # SQL schema, no schema tests committed
└── dist/                        # Generated bundles with source maps, not a test location

src/                             # Present only inside backend/dist/*/*.map in this distribution
├── features/<feature>/          # Place feature service/route tests here if source is restored
└── shared/<area>/               # Place utility/repository/middleware tests here if source is restored
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from 'vitest';
import { generateTOTP } from '@/shared/utils/otp/protocols/totp';

describe('generateTOTP', () => {
    it('generates a stable RFC-style code for a fixed timestamp', async () => {
        const code = await generateTOTP('JBSWY3DPEHPK3PXP', 30, 6, 'SHA-1', 0);

        expect(code).toHaveLength(6);
    });
});
```

**Patterns:**
- Use `describe` per module or public behavior, e.g. `describe('VaultService')` for `src/features/vault/vaultService.ts`.
- Use `it` for behavior-level cases; no existing test naming convention is committed.
- Prefer deterministic inputs for utility tests, especially time-sensitive OTP functions in `src/shared/utils/otp/protocols/totp.ts`, `src/shared/utils/otp/protocols/hotp.ts`, and `src/shared/utils/otp/index.ts`.
- For route tests, instantiate the Hono app/route and pass mocked `env` bindings rather than calling generated `backend/dist/*` bundles directly.

## Mocking

**Framework:** Vitest mocks (`vi.fn`, `vi.mock`, `vi.spyOn`) should be used when tests are added.

**Patterns:**
```typescript
import { describe, expect, it, vi } from 'vitest';
import { VaultService } from '@/features/vault/vaultService';

describe('VaultService', () => {
    it('throws when a duplicate active account exists', async () => {
        const repository = {
            findByServiceAccountAny: vi.fn().mockResolvedValue({ id: 'existing', deletedAt: null }),
        };
        const service = new VaultService({ JWT_SECRET: 'test', ENCRYPTION_KEY: 'test' } as any, repository as any);

        await expect(service.createAccount('user@example.com', {
            service: 'GitHub',
            account: 'user@example.com',
            secret: 'JBSWY3DPEHPK3PXP',
        })).rejects.toMatchObject({ name: 'AppError', statusCode: 409 });
    });
});
```

**What to Mock:**
- Mock repository dependencies when testing services: `VaultRepository` in `src/features/vault/vaultService.ts`, `BackupRepository` in `src/features/backup/backupService.ts`, session repository behavior behind `src/features/auth/sessionService.ts`.
- Mock Hono context `c.env`, `c.req`, `c.get`, and `c.set` when testing middleware such as `src/shared/middleware/auth.ts`.
- Mock external provider network calls for OAuth and backup providers under `src/features/auth/providers/` and `src/features/backup/providers/`.
- Mock time with `vi.setSystemTime` or explicit timestamp arguments for OTP and session expiry logic.

**What NOT to Mock:**
- Do not mock pure OTP/base32/HMAC parsing behavior when testing `src/shared/utils/otp/index.ts` and `src/shared/utils/otp/protocols/*.ts`; use known vectors and fixed timestamps.
- Do not mock `AppError` from `src/app/config.ts`; assert its `statusCode` and message.
- Do not test generated bundles in `backend/dist/worker/worker.js`, `backend/dist/docker/server.js`, or `backend/dist/netlify/api.mjs` as source of truth; test restored TypeScript source modules.

## Fixtures and Factories

**Test Data:**
```typescript
const makeEnv = (overrides = {}) => ({
    JWT_SECRET: 'test-jwt-secret',
    ENCRYPTION_KEY: 'test-encryption-key',
    OAUTH_ALLOWED_USERS: 'user@example.com',
    DB: {},
    ...overrides,
});

const makeVaultItem = (overrides = {}) => ({
    id: 'vault-1',
    service: 'GitHub',
    account: 'user@example.com',
    category: '',
    secret: 'encrypted-secret',
    digits: 6,
    period: 30,
    type: 'totp',
    algorithm: 'SHA1',
    counter: 0,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    ...overrides,
});
```

**Location:**
- No fixture directory is detected.
- Keep small factories inside the relevant `*.test.ts` file until they are reused across multiple modules.
- If shared fixtures become necessary, place them under `backend/test/fixtures/` or `backend/tests/fixtures/`; no current convention exists.

## Coverage

**Requirements:** None enforced in `backend/package.json`; no Vitest config or coverage thresholds are committed.

**View Coverage:**
```bash
npx --prefix backend vitest run --coverage
```

## Test Types

**Unit Tests:**
- Primary fit for pure utilities in `src/shared/utils/otp/`, `src/shared/utils/common.ts`, `src/shared/utils/masking.ts`, and `src/shared/utils/crypto.ts`.
- Primary fit for services with mocked repositories: `src/features/vault/vaultService.ts`, `src/features/backup/backupService.ts`, `src/features/auth/webAuthnService.ts`.

**Integration Tests:**
- Useful for Hono route modules with mocked or in-memory DB bindings: `src/features/vault/vaultRoutes.ts`, `src/features/auth/authRoutes.ts`, `src/features/backup/backupRoutes.ts`.
- Useful for repository/query behavior against a test database adapter matching schema files in `src/shared/db/schema/` and SQL in `backend/schema.sql`.

**E2E Tests:**
- Not used. No Playwright, Cypress, or browser E2E configuration is detected.

## Common Patterns

**Async Testing:**
```typescript
it('returns a JSON error for invalid sort order', async () => {
    const response = await app.request('/api/vault/item-1/sort-order', {
        method: 'PATCH',
        body: JSON.stringify({ sortOrder: 'bad' }),
        headers: { 'Content-Type': 'application/json' },
    }, makeEnv() as any);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: 'sortOrder must be a number',
    });
});
```

**Error Testing:**
```typescript
it('rejects requests without an auth token', async () => {
    await expect(authMiddleware(contextWithoutCookies as any, vi.fn()))
        .rejects.toMatchObject({
            name: 'AppError',
            statusCode: 401,
            message: 'no_session',
        });
});
```

**Current Verification State:**
- `npm --prefix backend test` was executed from `/home/znh/projects/nodeauth-worker`.
- The command fails before test discovery with `sh: 1: vitest: not found` because backend dependencies are not installed in `backend/node_modules`.
- No committed tests are available for discovery in the current checkout.

---

*Testing analysis: 2026-05-02*
