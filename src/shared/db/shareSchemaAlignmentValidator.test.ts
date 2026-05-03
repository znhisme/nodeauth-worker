import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');
const validatorSource = readFileSync(resolve(repoRoot, 'scripts/validate_share_schema_alignment.js'), 'utf8');

const requiredSourceMarker = [
    'share_links',
    'share_audit_events',
    'share_rate_limits',
    'token_hash',
    'access_code_hash',
    'vault_item_id',
    'owner_id',
    'expires_at',
    'revoked_at',
    'create_share_link_tables',
    'version: 13',
].join('\n');

const requiredGeneratedMarker = [
    'share_links',
    'share_audit_events',
    'share_rate_limits',
    'share_item_inaccessible',
    'share_inaccessible',
].join('\n');

const fixedMysqlBlock = `
    CREATE TABLE IF NOT EXISTS share_links (
        id VARCHAR(36) PRIMARY KEY,
        vault_item_id VARCHAR(36) NOT NULL,
        owner_id VARCHAR(255) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        access_code_hash VARCHAR(255) NOT NULL,
        expires_at BIGINT NOT NULL,
        revoked_at BIGINT,
        created_at BIGINT NOT NULL,
        last_accessed_at BIGINT,
        access_count BIGINT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS share_audit_events (
        id VARCHAR(36) PRIMARY KEY,
        share_id VARCHAR(36) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        actor_type VARCHAR(50) NOT NULL,
        event_at BIGINT NOT NULL,
        owner_id VARCHAR(255) NOT NULL,
        ip_hash VARCHAR(255),
        user_agent_hash VARCHAR(255),
        metadata LONGTEXT
    );
    CREATE TABLE IF NOT EXISTS share_rate_limits (
        key VARCHAR(255) PRIMARY KEY,
        share_id VARCHAR(36) NOT NULL,
        attempts BIGINT DEFAULT 0,
        window_started_at BIGINT NOT NULL,
        last_attempt_at BIGINT NOT NULL,
        locked_until BIGINT
    );
`;

const createTempProject = (mysqlBlock: string): string => {
    const root = mkdtempSync(join(tmpdir(), 'nodeauth-share-schema-'));
    const scriptPath = join(root, 'scripts/validate_share_schema_alignment.js');
    const files = new Map<string, string>([
        ['scripts/validate_share_schema_alignment.js', validatorSource],
        ['src/shared/db/schema/sqlite.ts', requiredSourceMarker],
        ['src/shared/db/schema/mysql.ts', requiredSourceMarker],
        ['src/shared/db/schema/pg.ts', requiredSourceMarker],
        ['src/shared/db/schema/index.ts', requiredSourceMarker],
        ['backend/schema.sql', requiredSourceMarker],
        ['backend/dist/worker/worker.js', requiredGeneratedMarker],
        ['backend/dist/docker/server.js', requiredGeneratedMarker],
        ['backend/dist/netlify/api.mjs', requiredGeneratedMarker],
        ['src/shared/db/migrator.ts', `
            ${requiredSourceMarker}
            const MIGRATIONS = [{
                version: 13,
                name: 'create_share_link_tables',
                sqlite: \`SELECT 1;\`,
                mysql: \`${mysqlBlock}\`,
                postgres: \`SELECT 1;\`,
            }];
        `],
    ]);

    for (const [relativePath, contents] of files) {
        const absolutePath = join(root, relativePath);
        mkdirSync(resolve(absolutePath, '..'), { recursive: true });
        writeFileSync(absolutePath, contents);
    }

    return scriptPath;
};

describe('share schema alignment validator', () => {
    const tempRoots: string[] = [];

    afterEach(() => {
        for (const root of tempRoots.splice(0)) {
            rmSync(root, { recursive: true, force: true });
        }
    });

    const runValidator = (mysqlBlock: string) => {
        const scriptPath = createTempProject(mysqlBlock);
        tempRoots.push(resolve(scriptPath, '../..'));
        return spawnSync(process.execPath, [scriptPath], {
            encoding: 'utf8',
        });
    };

    it('fails when the MySQL share migration keeps id as TEXT PRIMARY KEY', () => {
        const result = runValidator(`${fixedMysqlBlock}\nlegacy_id TEXT PRIMARY KEY;`);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('unbounded TEXT');
    });

    it.each([
        'vault_item_id TEXT NOT NULL',
        'owner_id TEXT NOT NULL',
        'token_hash TEXT NOT NULL',
        'access_code_hash TEXT NOT NULL',
        'share_id TEXT NOT NULL',
        'key TEXT PRIMARY KEY',
    ])('fails when the MySQL share migration contains %s', (legacyColumn) => {
        const result = runValidator(`${fixedMysqlBlock}\n${legacyColumn};`);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('unbounded TEXT');
    });

    it('fails when the MySQL share migration is missing required bounded varchar definitions', () => {
        const result = runValidator(fixedMysqlBlock.replace('token_hash VARCHAR(255) NOT NULL,', ''));

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('Missing MySQL share migration string');
    });
});
