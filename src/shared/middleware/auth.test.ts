import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const cookies = new Map<string, string | undefined>();
    const getCookie = vi.fn((_c: any, name: string) => cookies.get(name));
    const verifySecureJWT = vi.fn();
    const validateSession = vi.fn();
    const SessionService = vi.fn(function () {
        return {
            validateSession,
        };
    });

    return {
        cookies,
        getCookie,
        verifySecureJWT,
        validateSession,
        SessionService,
    };
});

vi.mock('hono/cookie', () => ({
    getCookie: mocks.getCookie,
}));

vi.mock('@/shared/utils/crypto', () => ({
    verifySecureJWT: mocks.verifySecureJWT,
}));

vi.mock('@/features/auth/sessionService', () => ({
    SessionService: mocks.SessionService,
}));

import { authMiddleware } from '@/shared/middleware/auth';

const makeHeaderGetter = (values: Record<string, string | undefined> = {}) => {
    const normalizedValues = new Map(
        Object.entries(values).map(([name, value]) => [name.toLowerCase(), value]),
    );
    return vi.fn((name: string) => normalizedValues.get(name.toLowerCase()));
};

const makeContext = (headers: Record<string, string | undefined> = {}) => {
    const state = new Map<string, unknown>();
    return {
        env: {
            JWT_SECRET: 'jwt-secret',
            DB: {},
        },
        req: {
            header: makeHeaderGetter(headers),
        },
        set: vi.fn((name: string, value: unknown) => {
            state.set(name, value);
        }),
        get: vi.fn((name: string) => state.get(name)),
    };
};

const validPayload = {
    userInfo: {
        id: 'user-id-1',
        email: 'user@example.com',
    },
    sessionId: 'session-1',
};

const expectAppError = async (promise: Promise<unknown>, message: string, statusCode: number) => {
    await expect(promise).rejects.toMatchObject({
        name: 'AppError',
        message,
        statusCode,
    });
};

describe('authMiddleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.cookies.clear();
        mocks.verifySecureJWT.mockResolvedValue(validPayload);
        mocks.validateSession.mockResolvedValue(true);
    });

    it('accepts cookie auth when CSRF cookie and header match', async () => {
        mocks.cookies.set('auth_token', 'cookie.jwt');
        mocks.cookies.set('csrf_token', 'csrf-token-1');
        const ctx = makeContext({ 'X-CSRF-Token': 'csrf-token-1' });
        const next = vi.fn();

        await authMiddleware(ctx as any, next);

        expect(mocks.verifySecureJWT).toHaveBeenCalledWith('cookie.jwt', 'jwt-secret');
        expect(mocks.validateSession).toHaveBeenCalledWith('session-1');
        expect(ctx.set).toHaveBeenCalledWith('user', validPayload.userInfo);
        expect(ctx.set).toHaveBeenCalledWith('sessionId', 'session-1');
        expect(next).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['missing header', undefined],
        ['mismatched header', 'wrong-token'],
    ])('rejects cookie auth with %s CSRF', async (_label, csrfHeader) => {
        mocks.cookies.set('auth_token', 'cookie.jwt');
        mocks.cookies.set('csrf_token', 'csrf-token-1');
        const ctx = makeContext({ 'X-CSRF-Token': csrfHeader });

        await expectAppError(authMiddleware(ctx as any, vi.fn()), 'csrf_mismatch', 403);

        expect(mocks.verifySecureJWT).not.toHaveBeenCalled();
    });

    it('accepts Bearer auth without requiring CSRF cookies', async () => {
        const ctx = makeContext({ Authorization: 'Bearer valid.jwt' });
        const next = vi.fn();

        await authMiddleware(ctx as any, next);

        expect(mocks.getCookie).toHaveBeenCalledWith(ctx, 'auth_token');
        expect(mocks.verifySecureJWT).toHaveBeenCalledWith('valid.jwt', 'jwt-secret');
        expect(mocks.validateSession).toHaveBeenCalledWith('session-1');
        expect(ctx.set).toHaveBeenCalledWith('user', validPayload.userInfo);
        expect(ctx.set).toHaveBeenCalledWith('sessionId', 'session-1');
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('rejects Bearer auth with an invalid JWT payload', async () => {
        mocks.verifySecureJWT.mockResolvedValue(null);
        const ctx = makeContext({ Authorization: 'Bearer expired.jwt' });

        await expectAppError(authMiddleware(ctx as any, vi.fn()), 'token_expired', 401);
    });

    it('rejects Bearer auth when the JWT payload has no sessionId', async () => {
        mocks.verifySecureJWT.mockResolvedValue({
            userInfo: {
                id: 'user-id-1',
                email: 'user@example.com',
            },
        });
        const ctx = makeContext({ Authorization: 'Bearer valid.jwt' });

        await expectAppError(authMiddleware(ctx as any, vi.fn()), 'session_invalid_schema', 401);
    });

    it('rejects Bearer auth when the session is inactive', async () => {
        mocks.validateSession.mockResolvedValue(false);
        const ctx = makeContext({ Authorization: 'Bearer valid.jwt' });

        await expectAppError(authMiddleware(ctx as any, vi.fn()), 'session_kicked_out', 401);
    });

    it('prefers cookie auth when cookie and Bearer credentials are both present', async () => {
        mocks.cookies.set('auth_token', 'cookie.jwt');
        mocks.cookies.set('csrf_token', 'csrf-token-1');
        const ctx = makeContext({
            Authorization: 'Bearer valid.jwt',
            'X-CSRF-Token': undefined,
        });

        await expectAppError(authMiddleware(ctx as any, vi.fn()), 'csrf_mismatch', 403);

        expect(mocks.verifySecureJWT).not.toHaveBeenCalled();
    });
});
