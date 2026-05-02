const { readFileSync, writeFileSync } = require('fs');
const { spawnSync } = require('child_process');

const normalizeSourceMap = (sourceMapPath) => {
    const sourceMap = JSON.parse(readFileSync(sourceMapPath, 'utf8'));
    sourceMap.sources = sourceMap.sources.map((source) => (
        source.startsWith('../../../src/') ? source.replace('../../../src/', '../../src/') : source
    ));
    for (const source of [
        '../../src/shared/db/executor.ts',
        '../../src/features/backup/providers/backupProvider.ts',
        '../../src/features/backup/providers/index.ts',
    ]) {
        if (!sourceMap.sources.includes(source)) {
            sourceMap.sources.push(source);
            sourceMap.sourcesContent.push(readFileSync(source.replace('../../src/', '../src/'), 'utf8'));
        }
    }
    writeFileSync(sourceMapPath, `${JSON.stringify(sourceMap)}\n`);
};

const result = spawnSync('npx', [
    'tsup',
    '--entry.server',
    '../src/app/server.ts',
    '--out-dir',
    'dist/docker',
    '--format',
    'esm',
    '--sourcemap',
    '--target',
    'es2022',
    '--clean',
    '--no-splitting',
    '--platform',
    'node',
    '--external',
    'cloudflare:sockets',
], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
});

if (result.status !== 0) {
    process.exit(result.status ?? 1);
}

normalizeSourceMap('dist/docker/server.js.map');
