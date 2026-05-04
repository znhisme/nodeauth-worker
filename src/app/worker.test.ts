import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const appFetch = vi.fn(async () => new Response('ok'));
    const migrateDatabase = vi.fn(async () => undefined);
    const drizzle = vi.fn(() => ({ kind: 'drizzle-db' }));
    const createShareService = vi.fn(() => ({
        cleanupShareState: vi.fn(async () => undefined),
    }));
    const handleScheduledBackup = vi.fn(async () => undefined);

    return {
        appFetch,
        migrateDatabase,
        drizzle,
        createShareService,
        handleScheduledBackup,
    };
});

vi.mock('@/app/index', () => ({
    default: {
        fetch: mocks.appFetch,
    },
}));

vi.mock('drizzle-orm/d1', () => ({
    drizzle: mocks.drizzle,
}));

vi.mock('@/shared/db/migrator', () => ({
    migrateDatabase: mocks.migrateDatabase,
}));

vi.mock('@/features/backup/backupRoutes', () => ({
    handleScheduledBackup: mocks.handleScheduledBackup,
}));

vi.mock('@/features/share/shareService', () => ({
    createShareService: mocks.createShareService,
}));

import worker from '@/app/worker';

describe('Worker bootstrap migrations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('awaits D1 migrations before serving the first request after deploy', async () => {
        const order: string[] = [];
        mocks.migrateDatabase.mockImplementationOnce(async () => {
            order.push('migration:start');
            await Promise.resolve();
            order.push('migration:done');
        });
        mocks.appFetch.mockImplementationOnce(async () => {
            order.push('app:fetch');
            return new Response('ok');
        });

        const env = {
            DB: {
                prepare: vi.fn(() => ({ run: vi.fn(), first: vi.fn() })),
            },
            ASSETS: {},
        };

        const response = await worker.fetch(new Request('https://nodeauth.test/api/share', {
            method: 'POST',
        }), env as any, { waitUntil: vi.fn() } as any);

        expect(response.status).toBe(200);
        expect(order).toEqual(['migration:start', 'migration:done', 'app:fetch']);
        expect(mocks.appFetch).toHaveBeenCalledWith(expect.any(Request), {
            ...env,
            DB: { kind: 'drizzle-db' },
            ASSETS: env.ASSETS,
        }, expect.any(Object));
    });

    it('reuses a completed migration promise for the same D1 binding', async () => {
        const env = {
            DB: {
                prepare: vi.fn(() => ({ run: vi.fn(), first: vi.fn() })),
            },
            ASSETS: {},
        };
        const ctx = { waitUntil: vi.fn() };

        await worker.fetch(new Request('https://nodeauth.test/api/share'), env as any, ctx as any);
        await worker.fetch(new Request('https://nodeauth.test/api/share'), env as any, ctx as any);

        expect(mocks.migrateDatabase).toHaveBeenCalledTimes(1);
        expect(ctx.waitUntil).not.toHaveBeenCalled();
    });
});
