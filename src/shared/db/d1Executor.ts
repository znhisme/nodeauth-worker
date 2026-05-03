import { DbExecutor, DbEngine } from '@/shared/db/executor';

export class D1Executor implements DbExecutor {
    readonly engine: DbEngine = 'd1';

    constructor(private d1: any) { }

    async exec(sql: string): Promise<void> {
        // D1's exec() is SQL-file oriented and can split multi-line DDL into invalid
        // fragments. Run one already-split statement through prepare() instead.
        await this.d1.prepare(sql).run();
    }

    prepare(sql: string) {
        return {
            get: async (...params: any[]) => {
                const stmt = this.d1.prepare(sql).bind(...params);
                return await stmt.first();
            },
            run: async (...params: any[]) => {
                const stmt = this.d1.prepare(sql).bind(...params);
                return await stmt.run();
            }
        };
    }

    async batch(sqls: string[]): Promise<void> {
        const statements = sqls.map(sql => this.d1.prepare(sql));
        await this.d1.batch(statements);
    }
}
