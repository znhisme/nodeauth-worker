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

const makeHeaderGetter = (values: Record<string, string | null | undefined>) => {
    const normalizedValues = new Map(
        Object.entries(values).map(([name, value]) => [name.toLowerCase(), value]),
    );
    return vi.fn((name: string) => normalizedValues.get(name.toLowerCase()) ?? null);
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
            header: makeHeaderGetter({ 'CF-Connecting-IP': '1.2.3.4' }),
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
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(['data', 'message', 'success']);
    expect(body).toEqual({
        success: false,
        message: 'share_inaccessible',
        data: null,
    });

    for (const [name, value] of Object.entries(getSharePublicHeaders())) {
        expect(response.headers.get(name)).toBe(value);
    }
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Pragma')).toBe('no-cache');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
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

    it('returns generic share_inaccessible response for fail-closed DB-error path', async () => {
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

    it('returns generic share_inaccessible response when locked/rate-limited decision is denied', async () => {
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
                header: makeHeaderGetter({ 'CF-Connecting-IP': '1.2.3.4' }),
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

    it('uses the first x-forwarded-for hop when Cloudflare client IP is absent', async () => {
        const rawToken = 'raw-public-token-123';
        const middleware = shareRateLimit();
        const ctx = makeContext({
            req: {
                header: makeHeaderGetter({ 'x-forwarded-for': '203.0.113.10, 10.0.0.2' }),
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
        expect(input.key).toMatch(/^share:203\.0\.113\.10:share-public-access:[A-Za-z0-9_-]+$/);
        expect(input.key).not.toContain('unknown');
        expect(input.key).not.toContain('10.0.0.2');
        expect(input.key).not.toContain(rawToken);
    });

    it('uses x-real-ip when Cloudflare and forwarded client IPs are absent', async () => {
        const rawToken = 'raw-public-token-123';
        const middleware = shareRateLimit();
        const ctx = makeContext({
            req: {
                header: makeHeaderGetter({ 'x-real-ip': '198.51.100.25' }),
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
        expect(input.key).toMatch(/^share:198\.51\.100\.25:share-public-access:[A-Za-z0-9_-]+$/);
        expect(input.key).not.toContain('unknown');
        expect(input.key).not.toContain(rawToken);
    });

    it('uses Netlify client connection IP when other client identifiers are absent', async () => {
        const rawToken = 'raw-public-token-123';
        const middleware = shareRateLimit();
        const ctx = makeContext({
            req: {
                header: makeHeaderGetter({ 'x-nf-client-connection-ip': '192.0.2.44' }),
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
        expect(input.key).toMatch(/^share:192\.0\.2\.44:share-public-access:[A-Za-z0-9_-]+$/);
        expect(input.key).not.toContain('unknown');
        expect(input.key).not.toContain(rawToken);
    });

    it('falls back to a stable unknown bucket without storing public share secrets', async () => {
        const rawToken = 'raw-public-token-123';
        const rawAccessCode = 'raw-access-code-123';
        const middleware = shareRateLimit();
        const ctx = makeContext({
            req: {
                header: makeHeaderGetter({
                    'CF-Connecting-IP': '   ',
                    'x-forwarded-for': ' , ',
                    'x-real-ip': '',
                    'x-nf-client-connection-ip': ' ',
                    'client-ip': '',
                }),
                path: `/api/share/public/${rawToken}/access`,
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
        expect(input.key).toMatch(/^share:unknown:share-public-access:[A-Za-z0-9_-]+$/);
        expect(input.key).not.toContain(rawToken);
        expect(input.shareId).not.toContain(rawToken);
        expectSerializedNotToContain(input, [
            rawToken,
            rawAccessCode,
            '/api/share/public',
            'password',
            'seed',
            'otpauth',
            'share-1',
        ]);
    });

    it('separates forwarded-header buckets for the same token while preserving the same hashed share id', async () => {
        const rawToken = 'raw-public-token-123';
        const middleware = shareRateLimit();
        const enforceRateLimit = vi.spyOn(ShareRepository.prototype, 'enforceRateLimit').mockResolvedValue({
            allowed: true,
            attempts: 1,
            lockedUntil: null,
        });

        await middleware(makeContext({
            req: {
                header: makeHeaderGetter({ 'x-forwarded-for': '203.0.113.10, 10.0.0.2' }),
                path: '/api/share/public',
                param: vi.fn((name: string) => (name === 'token' ? rawToken : undefined)),
            },
        }) as any, vi.fn());
        await middleware(makeContext({
            req: {
                header: makeHeaderGetter({ 'x-forwarded-for': '198.51.100.25, 10.0.0.2' }),
                path: '/api/share/public',
                param: vi.fn((name: string) => (name === 'token' ? rawToken : undefined)),
            },
        }) as any, vi.fn());

        const firstInput = enforceRateLimit.mock.calls[0][0];
        const secondInput = enforceRateLimit.mock.calls[1][0];
        expect(firstInput.key).not.toBe(secondInput.key);
        expect(firstInput.key).toContain('share:203.0.113.10:share-public-access:');
        expect(secondInput.key).toContain('share:198.51.100.25:share-public-access:');
        expect(firstInput.shareId).toBe(secondInput.shareId);
        expect(firstInput.shareId).toMatch(/^[A-Za-z0-9_-]+$/);
        expectSerializedNotToContain([firstInput, secondInput], [rawToken]);
    });
});
