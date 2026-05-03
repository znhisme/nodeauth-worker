import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('drizzle-orm', async () => {
    const actual = await vi.importActual<any>('drizzle-orm');
    return {
        ...actual,
        lte: vi.fn(() => 'lte-cond'),
        lt: vi.fn(() => 'lt-cond'),
        isNull: vi.fn(() => 'is-null-cond'),
        count: vi.fn(() => 'count-sql'),
    };
});

import * as drizzle from 'drizzle-orm';
import { shareAuditEvents, shareLinks, shareRateLimits } from '@/shared/db/schema/index';
import { ShareRepository } from '@/shared/db/repositories/shareRepository';

function createDbMock() {
    const selectWhere = vi.fn();
    const selectLimit = vi.fn();
    const selectFrom = vi.fn(() => ({ where: selectWhere, limit: selectLimit }));
    const select = vi.fn(() => ({ from: selectFrom }));

    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn(() => ({ values: insertValues }));

    const deleteWhere = vi.fn().mockResolvedValue({ success: true });
    const deleteFn = vi.fn(() => ({ where: deleteWhere }));

    return {
        db: {
            select,
            insert,
            delete: deleteFn,
        },
        select,
        selectFrom,
        selectWhere,
        selectLimit,
        insert,
        insertValues,
        deleteFn,
        deleteWhere,
    };
}

describe('ShareRepository cleanup primitives', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('findExpiredSharesForCleanup selects only expired and non-revoked shares', async () => {
        const mock = createDbMock();
        const rows = [
            { id: 'share-1', ownerId: 'owner-1', expiresAt: 1000, revokedAt: null },
        ];
        mock.selectWhere.mockResolvedValue(rows);

        const repo = new ShareRepository(mock.db as any);

        const result = await repo.findExpiredSharesForCleanup(1000);

        expect(result).toBe(rows);
        expect(mock.select).toHaveBeenCalledTimes(1);
        expect(mock.selectFrom).toHaveBeenCalledWith(shareLinks);
        expect(drizzle.lte).toHaveBeenCalledWith(shareLinks.expiresAt, 1000);
        expect(drizzle.isNull).toHaveBeenCalledWith(shareLinks.revokedAt);
        expect(mock.selectWhere).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(mock.select.mock.calls[0][0] ?? null)).not.toContain('share-1');
    });

    it('insertExpiredAuditEventIfMissing writes one expired audit row and skips duplicates', async () => {
        const mock = createDbMock();
        const share = {
            id: 'share-1',
            ownerId: 'owner-1',
            vaultItemId: 'vault-1',
            tokenHash: 'token-hash',
            accessCodeHash: 'access-hash',
            expiresAt: 900,
            revokedAt: null,
            createdAt: 100,
            lastAccessedAt: null,
            accessCount: 0,
        } as any;

        mock.selectWhere
            .mockResolvedValueOnce([{ count: 0 }])
            .mockResolvedValueOnce([{ count: 1 }]);

        const repo = new ShareRepository(mock.db as any);

        const first = await repo.insertExpiredAuditEventIfMissing(share, 1000);
        const second = await repo.insertExpiredAuditEventIfMissing(share, 1000);

        expect(first).toBe(true);
        expect(second).toBe(false);
        expect(drizzle.count).toHaveBeenCalledTimes(2);
        expect(mock.insert).toHaveBeenCalledTimes(1);
        expect(mock.insertValues).toHaveBeenCalledWith({
            id: expect.any(String),
            shareId: 'share-1',
            eventType: 'expired',
            actorType: 'system',
            eventAt: 1000,
            ownerId: 'owner-1',
            ipHash: null,
            userAgentHash: null,
            metadata: JSON.stringify({
                expiredAt: 1000,
                expiresAt: 900,
                status: 'expired',
            }),
        });
        expect(mock.selectFrom).toHaveBeenNthCalledWith(1, shareAuditEvents);
        expect(mock.selectWhere).toHaveBeenCalledTimes(2);
        expect(JSON.stringify(mock.insertValues.mock.calls[0][0])).not.toContain('token-hash');
        expect(JSON.stringify(mock.insertValues.mock.calls[0][0])).not.toContain('access-hash');
    });

    it('deleteStaleRateLimits deletes only rows older than the cutoff and returns a count', async () => {
        const mock = createDbMock();
        mock.selectWhere.mockResolvedValue([
            { key: 'rate-1', shareId: 'share-1', lastAttemptAt: 499 },
            { key: 'rate-2', shareId: 'share-2', lastAttemptAt: 250 },
        ]);

        const repo = new ShareRepository(mock.db as any);

        const deletedCount = await repo.deleteStaleRateLimits(500);

        expect(deletedCount).toBe(2);
        expect(mock.select).toHaveBeenCalledTimes(1);
        expect(mock.selectFrom).toHaveBeenCalledWith(shareRateLimits);
        expect(drizzle.lt).toHaveBeenCalledWith(shareRateLimits.lastAttemptAt, 500);
        expect(mock.deleteFn).toHaveBeenCalledTimes(1);
        expect(mock.deleteWhere).toHaveBeenCalledTimes(1);
        expect(JSON.stringify({ deletedCount })).not.toContain('share-1');
        expect(JSON.stringify({ deletedCount })).not.toContain('rate-1');
    });
});
