import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/app/config';
import { shareRateLimit } from '@/shared/middleware/shareRateLimitMiddleware';

const makeContext = (overrides: any = {}) => ({
    env: {
        DB: {},
    },
    req: {
        header: vi.fn((name: string) => (name === 'CF-Connecting-IP' ? '1.2.3.4' : null)),
        path: '/share/token',
        param: vi.fn((name: string) => (name === 'token' ? 'token-1' : undefined)),
    },
    ...overrides,
});

describe('shareRateLimit', () => {
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
        const repo = await import('@/shared/db/repositories/shareRepository');
        vi.spyOn(repo.ShareRepository.prototype, 'enforceRateLimit').mockResolvedValue({
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
        const repo = await import('@/shared/db/repositories/shareRepository');
        vi.spyOn(repo.ShareRepository.prototype, 'enforceRateLimit').mockResolvedValue({
            allowed: true,
            attempts: 1,
            lockedUntil: null,
        });
        const next = vi.fn();
        await middleware(ctx as any, next);
        expect(next).toHaveBeenCalledTimes(1);
    });
});
