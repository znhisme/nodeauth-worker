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
