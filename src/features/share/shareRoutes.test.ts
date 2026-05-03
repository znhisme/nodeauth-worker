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
    const resolveShareAccess = vi.fn();
    const createShareService = vi.fn(() => ({
        createShareForOwner,
        listSharesForOwner,
        getShareForOwner,
        revokeShareForOwner,
        resolveShareAccess,
    }));
    const shareRateLimitMiddleware = vi.fn(async (_c: any, next: any) => {
        await next();
    });
    const shareRateLimit = vi.fn(() => shareRateLimitMiddleware);

    return {
        authMiddleware,
        createShareForOwner,
        listSharesForOwner,
        getShareForOwner,
        revokeShareForOwner,
        resolveShareAccess,
        createShareService,
        shareRateLimitMiddleware,
        shareRateLimit,
    };
});

vi.mock('@/shared/middleware/auth', () => ({
    authMiddleware: mocks.authMiddleware,
}));

vi.mock('@/features/share/shareService', () => ({
    createShareService: mocks.createShareService,
}));

vi.mock('@/shared/middleware/shareRateLimitMiddleware', () => ({
    shareRateLimit: mocks.shareRateLimit,
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
    expect(serialized).not.toContain('session');
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

const expectPublicHeaders = (response: Response) => {
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Pragma')).toBe('no-cache');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
};

const ownerMetadataKeys = ['accessCount', 'createdAt', 'expiresAt', 'id', 'item', 'lastAccessedAt', 'revokedAt', 'status'];
const ownerItemKeys = ['account', 'id', 'service'];

const expectOwnerMetadataAllowlist = (share: any, includeCreateSecrets = false) => {
    const expectedKeys = includeCreateSecrets
        ? [...ownerMetadataKeys, 'rawAccessCode', 'rawToken'].sort()
        : ownerMetadataKeys;
    expect(Object.keys(share).sort()).toEqual(expectedKeys);
    expect(Object.keys(share.item).sort()).toEqual(ownerItemKeys);
};

const expectPublicFailureAllowlist = (body: any) => {
    expect(Object.keys(body).sort()).toEqual(['data', 'message', 'success']);
    expect(body).toEqual({ success: false, message: 'share_inaccessible', data: null });
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
        expect(Object.keys(body).sort()).toEqual(['share', 'success']);
        expectOwnerMetadataAllowlist(body.share, true);
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
        expect(Object.keys(body).sort()).toEqual(['shares', 'success']);
        expectOwnerMetadataAllowlist(body.shares[0]);
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
        expect(Object.keys(body).sort()).toEqual(['share', 'success']);
        expectOwnerMetadataAllowlist(body.share);
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
            message: 'Share link revoked. Future access is blocked, but NodeAuth cannot retract credentials already viewed or copied.',
        });
        expect(Object.keys(body).sort()).toEqual(['message', 'share', 'success']);
        expectOwnerMetadataAllowlist(body.share);
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

    it('POST /api/share/public/:token/access accepts accessCode from the body only', async () => {
        mocks.resolveShareAccess.mockResolvedValue({
            accessible: true,
            status: 'active',
            itemView: {
                service: 'GitHub',
                account: 'friend@example.com',
                otp: {
                    code: '123456',
                    period: 30,
                    remainingSeconds: 12,
                },
            },
            publicHeaders: {
                'Cache-Control': 'no-store',
                Pragma: 'no-cache',
                'Referrer-Policy': 'no-referrer',
            },
        });

        const app = makeApp();
        const response = await app.request('https://nodeauth.test/api/share/public/raw-token-123/access?accessCode=query-code', {
            method: 'POST',
            body: JSON.stringify({ accessCode: 'code-123' }),
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            data: {
                service: 'GitHub',
                account: 'friend@example.com',
                otp: {
                    code: '123456',
                    period: 30,
                    remainingSeconds: 12,
                },
            },
        });
        expect(Object.keys(body).sort()).toEqual(['data', 'success']);
        expect(Object.keys(body.data).sort()).toEqual(['account', 'otp', 'service']);
        expect(Object.keys(body.data.otp).sort()).toEqual(['code', 'period', 'remainingSeconds']);
        expect(JSON.stringify(body)).not.toContain('ownerId');
        expect(JSON.stringify(body)).not.toContain('vaultItemId');
        expect(JSON.stringify(body)).not.toContain('tokenHash');
        expect(JSON.stringify(body)).not.toContain('accessCodeHash');
        expect(JSON.stringify(body)).not.toContain('raw-token-123');
        expect(JSON.stringify(body)).not.toContain('rawAccessCode');
        expect(mocks.authMiddleware).not.toHaveBeenCalled();
        expect(mocks.shareRateLimitMiddleware).toHaveBeenCalledTimes(1);
        expect(mocks.resolveShareAccess).toHaveBeenCalledWith({
            token: 'raw-token-123',
            accessCode: 'code-123',
            requestOrigin: 'https://nodeauth.test',
        });
        expect(JSON.stringify(mocks.resolveShareAccess.mock.calls)).not.toContain('query-code');
        expectPublicHeaders(response);
    });

    it('POST /api/share/public/:token/access returns generic inaccessible JSON and headers', async () => {
        mocks.resolveShareAccess.mockResolvedValue({
            accessible: false,
            status: 'revoked',
            reason: 'inaccessible',
            share: null,
            itemView: null,
            publicHeaders: {
                'Cache-Control': 'no-store',
                Pragma: 'no-cache',
                'Referrer-Policy': 'no-referrer',
            },
        });

        const app = makeApp();
        const response = await app.request('https://nodeauth.test/api/share/public/raw-token-123/access', {
            method: 'POST',
            body: JSON.stringify({ accessCode: 'wrong-code' }),
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const body = await response.json();

        expect(response.status).toBe(404);
        expectPublicFailureAllowlist(body);
        const serialized = JSON.stringify(body);
        for (const forbidden of [
            'revoked',
            'expired',
            'wrong-code',
            'locked',
            'deleted',
            'already viewed',
            'already copied',
            'cannot retract',
        ]) {
            expect(serialized).not.toContain(forbidden);
        }
        expectPublicHeaders(response);
    });

    it.each([
        ['expired share', { accessible: false, status: 'expired', reason: 'inaccessible', share: null, itemView: null }],
        ['revoked share', { accessible: false, status: 'revoked', reason: 'inaccessible', share: null, itemView: null }],
        ['wrong code', { accessible: false, status: 'active', reason: 'inaccessible', share: null, itemView: null }],
        ['deleted item', { accessible: false, status: 'revoked', reason: 'inaccessible', share: null, itemView: null }],
        ['missing token', { accessible: false, status: 'revoked', reason: 'inaccessible', share: null, itemView: null }],
    ])('POST /api/share/public/:token/access returns the same generic body for %s', async (_label, decision) => {
        mocks.resolveShareAccess.mockResolvedValue({
            ...decision,
            publicHeaders: {
                'Cache-Control': 'no-store',
                Pragma: 'no-cache',
                'Referrer-Policy': 'no-referrer',
            },
        });

        const app = makeApp();
        const response = await app.request('https://nodeauth.test/api/share/public/raw-token-123/access', {
            method: 'POST',
            body: JSON.stringify({ accessCode: 'code-123' }),
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const body = await response.json();

        expect(response.status).toBe(404);
        expectPublicFailureAllowlist(body);
        expectPublicHeaders(response);
    });
});
