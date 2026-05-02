const { readFileSync, renameSync, writeFileSync } = require('fs');
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
    '--entry.api',
    '../src/app/netlify.ts',
    '--out-dir',
    'dist/netlify',
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

renameSync('dist/netlify/api.js', 'dist/netlify/api.mjs');
renameSync('dist/netlify/api.js.map', 'dist/netlify/api.mjs.map');
normalizeSourceMap('dist/netlify/api.mjs.map');

const apiOutput = readFileSync('dist/netlify/api.mjs', 'utf8')
    .replace('//# sourceMappingURL=api.js.map', '//# sourceMappingURL=api.mjs.map');
writeFileSync('dist/netlify/api.mjs', apiOutput);
