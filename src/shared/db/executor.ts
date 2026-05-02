export type DbEngine = 'd1' | 'sqlite' | 'mysql' | 'postgres';

export interface PreparedStatement {
    get(...params: any[]): any;
    run(...params: any[]): any;
}

export interface DbExecutor {
    readonly engine: DbEngine;
    exec(sql: string): Promise<void>;
    prepare(sql: string): PreparedStatement;
    batch?(sqls: string[]): Promise<void>;
}
