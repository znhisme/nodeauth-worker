import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/app/config';
import { shareRateLimit } from '@/shared/middleware/shareRateLimitMiddleware';
import { ShareRepository } from '@/shared/db/repositories/shareRepository';

const makeContext = (overrides: any = {}) => ({
    env: {
        DB: {},
        SHARE_SECRET_PEPPER: 'pepper',
        JWT_SECRET: 'jwt',
    },
    req: {
        header: vi.fn((name: string) => (name === 'CF-Connecting-IP' ? '1.2.3.4' : null)),
        path: '/share/token',
        param: vi.fn((name: string) => (name === 'token' ? 'token-1' : undefined)),
    },
    ...overrides,
});

describe('shareRateLimit', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('throws share_inaccessible when DB is missing', async () => {
        const middleware = shareRateLimit();
        const ctx = makeContext({ env: {} });
        await expect(middleware(ctx as any, vi.fn())).rejects.toMatchObject({ name: 'AppError', message: 'share_inaccessible', statusCode: 404 });
    });

    it('throws share_inaccessible when repository errors', async () => {
        const middleware = shareRateLimit();
        const ctx = makeContext();
        const next = vi.fn();
        const db = {
            select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => Promise.reject(new Error('boom'))) })) })) })),
        };
        ctx.env.DB = db;
        await expect(middleware(ctx as any, next)).rejects.toMatchObject({ message: 'share_inaccessible' });
    });

    it('throws share_inaccessible when decision is denied', async () => {
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
        await expect(middleware(ctx as any, vi.fn())).rejects.toMatchObject({ message: 'share_inaccessible' });
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
        expect(input.key).toMatch(/^share:1\.2\.3\.4:\/api\/share\/public:[A-Za-z0-9_-]+$/);
        expect(input.shareId).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(input.shareId).not.toBe('');
    });
});
