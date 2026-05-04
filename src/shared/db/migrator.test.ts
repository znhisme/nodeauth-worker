import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { migrateDatabase } from '@/shared/db/migrator';
import { SqliteExecutor } from '@/shared/db/sqliteExecutor';

describe('migrateDatabase', () => {
    const databases: Database.Database[] = [];

    afterEach(() => {
        for (const db of databases.splice(0)) {
            db.close();
        }
    });

    it('finishes active share uniqueness repair when v14 column already exists but data is not backfilled', async () => {
        const db = new Database(':memory:');
        databases.push(db);
        db.exec(`
            CREATE TABLE _schema_metadata (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            INSERT INTO _schema_metadata (key, value) VALUES ('version', '13');
            CREATE TABLE vault (
                id TEXT PRIMARY KEY,
                service TEXT NOT NULL,
                account TEXT NOT NULL,
                secret TEXT NOT NULL,
                created_at INTEGER,
                deleted_at INTEGER
            );
            CREATE TABLE share_links (
                id TEXT PRIMARY KEY,
                vault_item_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                access_code_hash TEXT NOT NULL,
                active_share_key TEXT,
                expires_at INTEGER NOT NULL,
                revoked_at INTEGER,
                created_at INTEGER NOT NULL,
                last_accessed_at INTEGER,
                access_count INTEGER DEFAULT 0
            );
            INSERT INTO share_links (
                id,
                vault_item_id,
                owner_id,
                token_hash,
                access_code_hash,
                active_share_key,
                expires_at,
                revoked_at,
                created_at,
                last_accessed_at,
                access_count
            ) VALUES (
                'share-1',
                'vault-1',
                'owner-1',
                'token-hash',
                'access-code-hash',
                NULL,
                4102444800000,
                NULL,
                1000,
                NULL,
                0
            );
        `);

        await migrateDatabase(new SqliteExecutor(db));

        const share = db.prepare('SELECT active_share_key FROM share_links WHERE id = ?').get('share-1') as any;
        const version = db.prepare("SELECT value FROM _schema_metadata WHERE key = 'version'").get() as any;
        const index = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_share_links_active_share_key'").get();

        expect(share.active_share_key).toBe('owner-1:vault-1');
        expect(version.value).toBe('14');
        expect(index).toBeTruthy();
    });
});
