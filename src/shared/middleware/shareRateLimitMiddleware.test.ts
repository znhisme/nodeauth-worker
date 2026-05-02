import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareRateLimit } from '@/shared/middleware/shareRateLimitMiddleware';
import { ShareRepository } from '@/shared/db/repositories/shareRepository';
import { getSharePublicHeaders, hashShareSecret } from '@/features/share/shareSecurity';

const expectSerializedNotToContain = (value: unknown, forbiddenValues: string[]) => {
    const serialized = JSON.stringify(value);
    for (const forbiddenValue of forbiddenValues) {
        expect(serialized).not.toContain(forbiddenValue);
    }
};

const makeContext = (overrides: any = {}) => {
    const defaultEnv = {
        DB: {},
        SHARE_SECRET_PEPPER: 'pepper',
        JWT_SECRET: 'jwt',
    };
    const headers = new Headers();
    return {
        env: {
            ...defaultEnv,
            ...(overrides.env || {}),
        },
        req: {
            header: vi.fn((name: string) => (name === 'CF-Connecting-IP' ? '1.2.3.4' : null)),
            path: '/share/token',
            param: vi.fn((name: string) => (name === 'token' ? 'token-1' : undefined)),
        },
        header: vi.fn((name: string, value: string) => {
            headers.set(name, value);
        }),
        json: vi.fn((body: unknown, status: number) => new Response(JSON.stringify(body), {
            status,
            headers,
        })),
        ...overrides,
        env: {
            ...defaultEnv,
            ...(overrides.env || {}),
        },
    };
};

const expectShareInaccessibleResponse = async (response: Response) => {
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
        success: false,
        message: 'share_inaccessible',
        data: null,
    });

    for (const [name, value] of Object.entries(getSharePublicHeaders())) {
        expect(response.headers.get(name)).toBe(value);
    }
};

describe('shareRateLimit', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns generic share_inaccessible response when DB is missing', async () => {
        const middleware = shareRateLimit();
        const ctx = makeContext({ env: { DB: undefined } });
        const response = await middleware(ctx as any, vi.fn()) as Response;
        await expectShareInaccessibleResponse(response);
    });

    it('returns generic share_inaccessible response when repository errors', async () => {
        const middleware = shareRateLimit();
        const ctx = makeContext();
        const next = vi.fn();
        const db = {
            select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => Promise.reject(new Error('boom'))) })) })) })),
        };
        ctx.env.DB = db;
        const response = await middleware(ctx as any, next) as Response;
        await expectShareInaccessibleResponse(response);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns generic share_inaccessible response when decision is denied', async () => {
        const middleware = shareRateLimit();
        const ctx = makeContext({
            env: {
                DB: {
                    select: vi.fn(),
                    insert: vi.fn(),
                    update: vi.fn(),
                },
            },
        });
        vi.spyOn(ShareRepository.prototype, 'enforceRateLimit').mockResolvedValue({
            allowed: false,
            attempts: 6,
            lockedUntil: Date.now(),
        });
        const response = await middleware(ctx as any, vi.fn()) as Response;
        await expectShareInaccessibleResponse(response);
    });

    it('records a safe audit event when a real share reaches the denied threshold', async () => {
        const rawToken = 'raw-public-token-123';
        const rawAccessCode = 'raw-access-code-123';
        const tokenHash = await hashShareSecret('pepper', 'share-token', rawToken);
        const middleware = shareRateLimit();
        const ctx = makeContext({
            env: {
                DB: {},
            },
            req: {
                header: vi.fn((name: string) => (name === 'CF-Connecting-IP' ? '1.2.3.4' : null)),
                path: `/api/share/public/${rawToken}`,
                param: vi.fn((name: string) => (name === 'token' ? rawToken : undefined)),
            },
        });
        const enforceRateLimit = vi.spyOn(ShareRepository.prototype, 'enforceRateLimit').mockResolvedValue({
            allowed: false,
            attempts: 6,
            lockedUntil: 2000,
        });
        const findByTokenHash = vi.spyOn(ShareRepository.prototype, 'findByTokenHash').mockResolvedValue({
            id: 'share-1',
            ownerId: 'owner-1',
        } as any);
        const insertAuditEvent = vi.spyOn(ShareRepository.prototype, 'insertAuditEvent').mockResolvedValue();

        const response = await middleware(ctx as any, vi.fn()) as Response;
        await expectShareInaccessibleResponse(response);

        const limiterInput = enforceRateLimit.mock.calls[0][0];
        expect(limiterInput.key).not.toContain(rawToken);
        expect(limiterInput.shareId).not.toContain(rawToken);
        expectSerializedNotToContain(limiterInput, [
            rawToken,
            rawAccessCode,
            'password',
            'seed',
            'http://',
            'https://',
            'publicUrl',
            'fullUrl',
        ]);
        expect(findByTokenHash).toHaveBeenCalledWith(tokenHash);
        expect(findByTokenHash).not.toHaveBeenCalledWith(rawToken);
        expect(insertAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            shareId: 'share-1',
            eventType: 'access_denied_threshold',
            actorType: 'recipient',
            ownerId: 'owner-1',
            ipHash: null,
            userAgentHash: null,
        }));
        const auditEvent = insertAuditEvent.mock.calls[0][0];
        expect(auditEvent.metadata).toBe(JSON.stringify({
            attempts: 6,
            lockedUntil: 2000,
            windowMs: 900000,
        }));
        expectSerializedNotToContain(auditEvent, [
            rawToken,
            rawAccessCode,
            'password',
            'seed',
            'otpauth',
            'http://',
            'https://',
            'publicUrl',
            'fullUrl',
        ]);
    });

    it('skips threshold audit when the denied token hash does not resolve to a share', async () => {
        const rawToken = 'raw-public-token-123';
        const middleware = shareRateLimit();
        const ctx = makeContext({
            env: {
                DB: {},
            },
            req: {
                header: vi.fn((name: string) => (name === 'CF-Connecting-IP' ? '1.2.3.4' : null)),
                path: `/api/share/public/${rawToken}`,
                param: vi.fn((name: string) => (name === 'token' ? rawToken : undefined)),
            },
        });
        vi.spyOn(ShareRepository.prototype, 'enforceRateLimit').mockResolvedValue({
            allowed: false,
            attempts: 6,
            lockedUntil: 2000,
        });
        vi.spyOn(ShareRepository.prototype, 'findByTokenHash').mockResolvedValue(null);
        const insertAuditEvent = vi.spyOn(ShareRepository.prototype, 'insertAuditEvent').mockResolvedValue();

        const response = await middleware(ctx as any, vi.fn()) as Response;
        await expectShareInaccessibleResponse(response);

        expect(insertAuditEvent).not.toHaveBeenCalled();
    });

    it('calls next once when allowed', async () => {
        const middleware = shareRateLimit();
        const ctx = makeContext({
            env: {
                DB: {},
            },
        });
        vi.spyOn(ShareRepository.prototype, 'enforceRateLimit').mockResolvedValue({
            allowed: true,
            attempts: 1,
            lockedUntil: null,
        });
        const next = vi.fn();
        await middleware(ctx as any, next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('derives durable limiter identifiers without persisting the raw public token', async () => {
        const rawToken = 'raw-public-token-123';
        const middleware = shareRateLimit();
        const ctx = makeContext({
            req: {
                header: vi.fn((name: string) => (name === 'CF-Connecting-IP' ? '1.2.3.4' : null)),
                path: '/api/share/public',
                param: vi.fn((name: string) => (name === 'token' ? rawToken : undefined)),
            },
        });
        const enforceRateLimit = vi.spyOn(ShareRepository.prototype, 'enforceRateLimit').mockResolvedValue({
            allowed: true,
            attempts: 1,
            lockedUntil: null,
        });

        await middleware(ctx as any, vi.fn());

        const input = enforceRateLimit.mock.calls[0][0];
        expect(input.key).not.toContain(rawToken);
        expect(input.shareId).not.toContain(rawToken);
        expect(input.key).toMatch(/^share:1\.2\.3\.4:share-public-access:[A-Za-z0-9_-]+$/);
        expect(input.shareId).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(input.shareId).not.toBe('');
    });
});
