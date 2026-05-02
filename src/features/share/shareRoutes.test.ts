import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvBindings } from '@/app/config';

const mocks = vi.hoisted(() => {
    const authMiddleware = vi.fn(async (c: any, next: any) => {
        c.set('user', { id: 'user-id-1', email: 'owner@example.com' });
        await next();
    });
    const createShareForOwner = vi.fn();
    const listSharesForOwner = vi.fn();
    const getShareForOwner = vi.fn();
    const revokeShareForOwner = vi.fn();
    const createShareService = vi.fn(() => ({
        createShareForOwner,
        listSharesForOwner,
        getShareForOwner,
        revokeShareForOwner,
    }));

    return {
        authMiddleware,
        createShareForOwner,
        listSharesForOwner,
        getShareForOwner,
        revokeShareForOwner,
        createShareService,
    };
});

vi.mock('@/shared/middleware/auth', () => ({
    authMiddleware: mocks.authMiddleware,
}));

vi.mock('@/features/share/shareService', () => ({
    createShareService: mocks.createShareService,
}));

import shareRoutes from '@/features/share/shareRoutes';

const makeApp = () => {
    const app = new Hono<{ Bindings: EnvBindings, Variables: { user: any } }>();
    app.route('/api/share', shareRoutes);
    return app;
};

const makeMetadataShare = (overrides: Record<string, unknown> = {}) => ({
    id: 'share-1',
    item: {
        id: 'vault-1',
        service: 'GitHub',
        account: 'owner@example.com',
    },
    status: 'active',
    createdAt: '1000',
    expiresAt: '4600',
    revokedAt: null,
    lastAccessedAt: null,
    accessCount: 0,
    ...overrides,
});

const expectOwnerResponseIsSafe = (value: unknown, allowCreateSecrets = false) => {
    const serialized = JSON.stringify(value);
    expect(serialized).not.toContain('tokenHash');
    expect(serialized).not.toContain('accessCodeHash');
    expect(serialized).not.toContain('ownerId');
    expect(serialized).not.toContain('sessionId');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('seed');
    expect(serialized).not.toContain('otpauth');
    expect(serialized).not.toContain('backup');
    expect(serialized).not.toContain('password');

    if (!allowCreateSecrets) {
        expect(serialized).not.toContain('rawToken');
        expect(serialized).not.toContain('rawAccessCode');
    }
};

describe('Share link routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('POST /api/share creates a one-time owner share from the authenticated user', async () => {
        mocks.createShareForOwner.mockResolvedValue({
            ...makeMetadataShare(),
            rawToken: 'raw-token-123',
            rawAccessCode: 'code-123',
        });

        const app = makeApp();
        const response = await app.request('https://nodeauth.test/api/share', {
            method: 'POST',
            body: JSON.stringify({
                ownerId: 'attacker@example.com',
                vaultItemId: 'vault-1',
                ttlSeconds: 3600,
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        }, {
            NODEAUTH_PUBLIC_ORIGIN: 'https://shares.example',
        } as any);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            share: {
                ...makeMetadataShare(),
                rawToken: 'raw-token-123',
                rawAccessCode: 'code-123',
            },
        });
        expect(mocks.createShareForOwner).toHaveBeenCalledWith({
            ownerId: 'owner@example.com',
            vaultItemId: 'vault-1',
            ttlSeconds: 3600,
            expiresAt: undefined,
            publicOrigin: 'https://shares.example',
        });
        expectOwnerResponseIsSafe(body, true);
    });

    it('POST /api/share rejects missing vaultItemId', async () => {
        const app = makeApp();
        const response = await app.request('https://nodeauth.test/api/share', {
            method: 'POST',
            body: JSON.stringify({ ttlSeconds: 3600 }),
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({ success: false, error: 'vaultItemId is required' });
        expect(mocks.createShareForOwner).not.toHaveBeenCalled();
    });

    it('GET /api/share lists safe owner metadata for the authenticated user', async () => {
        mocks.listSharesForOwner.mockResolvedValue([makeMetadataShare()]);

        const app = makeApp();
        const response = await app.request('https://nodeauth.test/api/share');
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true, shares: [makeMetadataShare()] });
        expect(mocks.listSharesForOwner).toHaveBeenCalledWith('owner@example.com');
        expectOwnerResponseIsSafe(body);
    });

    it('GET /api/share/:id returns one safe owner share without credentials', async () => {
        mocks.getShareForOwner.mockResolvedValue(makeMetadataShare());

        const app = makeApp();
        const response = await app.request('https://nodeauth.test/api/share/share-1');
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true, share: makeMetadataShare() });
        expect(mocks.getShareForOwner).toHaveBeenCalledWith('owner@example.com', 'share-1');
        expectOwnerResponseIsSafe(body);
    });

    it('DELETE /api/share/:id revokes one safe owner share', async () => {
        mocks.revokeShareForOwner.mockResolvedValue(makeMetadataShare({ status: 'revoked', revokedAt: '2000' }));

        const app = makeApp();
        const response = await app.request('https://nodeauth.test/api/share/share-1', {
            method: 'DELETE',
        });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            share: makeMetadataShare({ status: 'revoked', revokedAt: '2000' }),
            message: 'Share link revoked',
        });
        expect(mocks.revokeShareForOwner).toHaveBeenCalledWith('owner@example.com', 'share-1');
        expectOwnerResponseIsSafe(body);
    });

    it('uses user.id when the authenticated user has no email', async () => {
        mocks.authMiddleware.mockImplementationOnce(async (c: any, next: any) => {
            c.set('user', { id: 'user-id-1' });
            await next();
        });
        mocks.listSharesForOwner.mockResolvedValue([]);

        const app = makeApp();
        const response = await app.request('https://nodeauth.test/api/share');

        expect(response.status).toBe(200);
        expect(mocks.listSharesForOwner).toHaveBeenCalledWith('user-id-1');
    });
});
