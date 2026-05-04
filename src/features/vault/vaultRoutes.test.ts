import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvBindings } from '@/app/config';

const mocks = vi.hoisted(() => {
    const authMiddleware = vi.fn(async (c: any, next: any) => {
        expect(c.req.header('Authorization')).toBe('Bearer valid.jwt');
        expect(c.req.header('X-CSRF-Token')).toBeUndefined();
        c.set('user', { id: 'user-id-1', email: 'user@example.com' });
        c.set('sessionId', 'session-1');
        await next();
    });
    const rateLimitMiddleware = vi.fn(async (_c: any, next: any) => {
        await next();
    });
    const rateLimit = vi.fn(() => rateLimitMiddleware);
    const importAccounts = vi.fn();
    const VaultService = vi.fn(function () {
        return {
            importAccounts,
        };
    });
    const VaultRepository = vi.fn(function () {
        return {};
    });

    return {
        authMiddleware,
        rateLimitMiddleware,
        rateLimit,
        importAccounts,
        VaultService,
        VaultRepository,
    };
});

vi.mock('@/shared/middleware/auth', () => ({
    authMiddleware: mocks.authMiddleware,
}));

vi.mock('@/shared/middleware/rateLimitMiddleware', () => ({
    rateLimit: mocks.rateLimit,
}));

vi.mock('@/features/vault/vaultService', () => ({
    VaultService: mocks.VaultService,
}));

vi.mock('@/shared/db/repositories/vaultRepository', () => ({
    VaultRepository: mocks.VaultRepository,
}));

import vaultRoutes from '@/features/vault/vaultRoutes';

const makeApp = () => {
    const app = new Hono<{ Bindings: EnvBindings, Variables: { user: any, sessionId: string } }>();
    app.route('/api/vault', vaultRoutes);
    return app;
};

const importContent = 'otpauth://totp/OpenAI:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=OpenAI';

const expectImportResponseIsSafe = (body: unknown) => {
    const serialized = JSON.stringify(body);
    for (const forbidden of ['JBSWY3DPEHPK3PXP', 'secret', 'vault', 'userInfo', 'sessionId', 'account-1', 'vault-1']) {
        expect(serialized).not.toContain(forbidden);
    }
};

describe('vault import route', () => {
    beforeEach(() => {
        mocks.authMiddleware.mockClear();
        mocks.rateLimitMiddleware.mockClear();
        mocks.importAccounts.mockClear();
        mocks.VaultService.mockClear();
        mocks.VaultRepository.mockClear();
        mocks.importAccounts.mockResolvedValue({
            count: 1,
            duplicates: 0,
            pending: false,
        });
    });

    it('imports text accounts with Bearer auth through the existing import service', async () => {
        const app = makeApp();
        const response = await app.request('https://nodeauth.test/api/vault/import', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.jwt',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'text',
                content: importContent,
            }),
        }, {
            JWT_SECRET: 'jwt-secret',
            ENCRYPTION_KEY: 'encryption-key',
            DB: undefined,
        } as any);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(mocks.authMiddleware).toHaveBeenCalledTimes(1);
        expect(mocks.rateLimit).toHaveBeenCalledWith({
            windowMs: 60 * 1000,
            max: 5,
        });
        expect(mocks.rateLimitMiddleware).toHaveBeenCalledTimes(1);
        expect(mocks.importAccounts).toHaveBeenCalledWith(
            'user@example.com',
            'text',
            importContent,
            undefined,
        );
        expect(body).toEqual({
            success: true,
            count: 1,
            duplicates: 0,
            pending: false,
        });
        expectImportResponseIsSafe(body);
    });
});
