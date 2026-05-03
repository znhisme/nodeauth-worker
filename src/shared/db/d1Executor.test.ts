import { describe, expect, it, vi } from 'vitest';
import { D1Executor } from '@/shared/db/d1Executor';

describe('D1Executor', () => {
    it('executes single statements through prepare().run() for multi-line DDL compatibility', async () => {
        const run = vi.fn().mockResolvedValue({});
        const prepare = vi.fn(() => ({ run }));
        const exec = vi.fn();
        const executor = new D1Executor({ exec, prepare });
        const sql = `CREATE TABLE IF NOT EXISTS share_links (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL
        )`;

        await executor.exec(sql);

        expect(prepare).toHaveBeenCalledWith(sql);
        expect(run).toHaveBeenCalledTimes(1);
        expect(exec).not.toHaveBeenCalled();
    });
});
