const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const repoRoot = resolve(__dirname, '..');

const requiredFiles = [
    'src/shared/db/schema/sqlite.ts',
    'src/shared/db/schema/mysql.ts',
    'src/shared/db/schema/pg.ts',
    'src/shared/db/schema/index.ts',
    'src/shared/db/migrator.ts',
    'backend/schema.sql',
    'backend/dist/worker/worker.js',
    'backend/dist/docker/server.js',
    'backend/dist/netlify/api.mjs',
];

const requiredSourceStrings = [
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
];

const requiredGeneratedStrings = [
    'share_links',
    'share_audit_events',
    'share_rate_limits',
    'share_item_inaccessible',
    'share_inaccessible',
];

const requiredMysqlShareMigrationStrings = [
    'id VARCHAR(36) PRIMARY KEY',
    'vault_item_id VARCHAR(36) NOT NULL',
    'owner_id VARCHAR(255) NOT NULL',
    'token_hash VARCHAR(255) NOT NULL',
    'access_code_hash VARCHAR(255) NOT NULL',
    'key VARCHAR(255) PRIMARY KEY',
];

const forbiddenMysqlShareMigrationPatterns = [
    /\bid\s+TEXT\s+PRIMARY\s+KEY\b/i,
    /\bvault_item_id\s+TEXT\b/i,
    /\bowner_id\s+TEXT\b/i,
    /\btoken_hash\s+TEXT\b/i,
    /\baccess_code_hash\s+TEXT\b/i,
    /\bshare_id\s+TEXT\b/i,
    /\bkey\s+TEXT\s+PRIMARY\s+KEY\b/i,
    /`key`\s+TEXT\s+PRIMARY\s+KEY\b/i,
];

const fail = (message) => {
    console.error(message);
    process.exit(1);
};

const readText = (relativePath) => {
    const absolutePath = resolve(repoRoot, relativePath);
    if (!existsSync(absolutePath)) {
        fail(`Missing required file: ${relativePath}`);
    }
    return readFileSync(absolutePath, 'utf8');
};

const findTemplateLiteralEnd = (source, startIndex) => {
    for (let index = startIndex + 1; index < source.length; index += 1) {
        if (source[index] === '`' && source[index - 1] !== '\\') {
            return index;
        }
    }
    return -1;
};

const getMysqlShareMigrationBlock = (migratorSource) => {
    const migrationStart = migratorSource.indexOf('version: 13');
    if (migrationStart === -1) {
        fail('Missing migration version 13 in migrator source');
    }

    const migrationName = migratorSource.indexOf("name: 'create_share_link_tables'", migrationStart);
    if (migrationName === -1) {
        fail('Missing create_share_link_tables migration name after version 13');
    }

    const mysqlStart = migratorSource.indexOf('mysql:', migrationName);
    if (mysqlStart === -1) {
        fail('Missing MySQL share migration block');
    }

    const blockStart = migratorSource.indexOf('`', mysqlStart);
    if (blockStart === -1) {
        fail('Missing opening template literal for MySQL share migration block');
    }

    const blockEnd = findTemplateLiteralEnd(migratorSource, blockStart);
    if (blockEnd === -1) {
        fail('Missing closing template literal for MySQL share migration block');
    }

    return migratorSource.slice(blockStart + 1, blockEnd).replace(/\\?`key\\?`/g, 'key');
};

for (const relativePath of requiredFiles) {
    readText(relativePath);
}

const sourceContents = [
    readText('src/shared/db/schema/sqlite.ts'),
    readText('src/shared/db/schema/mysql.ts'),
    readText('src/shared/db/schema/pg.ts'),
    readText('src/shared/db/schema/index.ts'),
    readText('src/shared/db/migrator.ts'),
    readText('backend/schema.sql'),
].join('\n\n');

for (const requiredString of requiredSourceStrings) {
    if (!sourceContents.includes(requiredString)) {
        fail(`Missing required source string: ${requiredString}`);
    }
}

const mysqlShareMigrationBlock = getMysqlShareMigrationBlock(readText('src/shared/db/migrator.ts'));

for (const forbiddenPattern of forbiddenMysqlShareMigrationPatterns) {
    if (forbiddenPattern.test(mysqlShareMigrationBlock)) {
        fail(`MySQL share migration contains indexed share identifiers as unbounded TEXT: ${forbiddenPattern}`);
    }
}

for (const requiredString of requiredMysqlShareMigrationStrings) {
    if (!mysqlShareMigrationBlock.includes(requiredString)) {
        fail(`Missing MySQL share migration string: ${requiredString}`);
    }
}

const generatedContents = [
    readText('backend/dist/worker/worker.js'),
    readText('backend/dist/docker/server.js'),
    readText('backend/dist/netlify/api.mjs'),
].join('\n\n');

for (const requiredString of requiredGeneratedStrings) {
    if (!generatedContents.includes(requiredString)) {
        fail(`Missing required generated string: ${requiredString}`);
    }
}

process.exit(0);
