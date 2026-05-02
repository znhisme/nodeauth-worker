#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const sourceMapPaths = [
    'backend/dist/worker/worker.js.map',
    'backend/dist/docker/server.js.map',
    'backend/dist/netlify/api.mjs.map',
];

const args = new Set(process.argv.slice(2));
const listOnly = args.has('--list');
const verifyOnly = args.has('--verify');

const validArgs = new Set(['--list', '--verify']);
for (const arg of args) {
    if (!validArgs.has(arg)) {
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
}

if (listOnly && verifyOnly) {
    console.error('Use either --list or --verify, not both.');
    process.exit(1);
}

const readMap = (sourceMapPath) => {
    const absolutePath = path.join(repoRoot, sourceMapPath);
    try {
        return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    } catch (error) {
        console.error(`Failed to read source map ${sourceMapPath}: ${error.message}`);
        process.exit(1);
    }
};

const normalizeOutputPath = (sourcePath) => {
    if (!sourcePath.startsWith('../../src/')) {
        return null;
    }

    if (sourcePath.includes('node_modules')) {
        return null;
    }

    return sourcePath.replace(/^\.\.\//, '').replace(/^\.\.\//, '');
};

const collectRestoredSources = () => {
    const restored = new Map();
    const provenance = [];

    for (const sourceMapPath of sourceMapPaths) {
        const sourceMap = readMap(sourceMapPath);
        const sources = Array.isArray(sourceMap.sources) ? sourceMap.sources : [];
        const sourcesContent = Array.isArray(sourceMap.sourcesContent) ? sourceMap.sourcesContent : [];
        let restoredCount = 0;

        sources.forEach((sourcePath, index) => {
            const outputPath = normalizeOutputPath(sourcePath);
            const content = sourcesContent[index];

            if (!outputPath || typeof content !== 'string') {
                return;
            }

            const existing = restored.get(outputPath);
            if (existing && existing.content !== content) {
                console.error(`Conflicting source content for ${outputPath}`);
                console.error(`First seen in ${existing.sourceMapPath}; conflict in ${sourceMapPath}`);
                process.exit(1);
            }

            if (!existing) {
                restored.set(outputPath, {
                    content,
                    sourceMapPath,
                    originalPath: sourcePath,
                });
            }

            restoredCount += 1;
        });

        provenance.push({
            path: sourceMapPath,
            restoredCount,
        });
    }

    return { restored, provenance };
};

const writeFile = (relativePath, content) => {
    const absolutePath = path.join(repoRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
};

const verifyFile = (relativePath, expectedContent) => {
    const absolutePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
        console.error(`Missing restored file: ${relativePath}`);
        return false;
    }

    const actualContent = fs.readFileSync(absolutePath, 'utf8');
    if (actualContent !== expectedContent) {
        console.error(`Restored file differs from source map content: ${relativePath}`);
        return false;
    }

    return true;
};

const buildProvenance = (restored, provenance) => {
    const restoredPaths = Array.from(restored.keys()).sort();
    const sourceMapLines = provenance.map((entry) => `- ${entry.path} (${entry.restoredCount} src entries)`);
    const restoredFileLines = restoredPaths.map((outputPath) => `- ${outputPath}`);

    return [
        '# Source Provenance',
        '',
        'Source maps used',
        ...sourceMapLines,
        '',
        'Editable backend source: restored to src/**',
        '',
        'Generated bundles are not primary implementation files',
        '',
        'Frontend source: not present; frontend/dist/** only',
        '',
        'UX-04 Phase 1 scope: API-only with documented future UI surfaces',
        '',
        '## Restored Backend Source Files',
        '',
        ...restoredFileLines,
        '',
    ].join('\n');
};

const { restored, provenance } = collectRestoredSources();
const restoredPaths = Array.from(restored.keys()).sort();

if (listOnly) {
    for (const outputPath of restoredPaths) {
        console.log(outputPath);
    }
    process.exit(0);
}

if (verifyOnly) {
    let passed = true;
    for (const outputPath of restoredPaths) {
        passed = verifyFile(outputPath, restored.get(outputPath).content) && passed;
    }

    passed = verifyFile('.planning/source-provenance.md', buildProvenance(restored, provenance)) && passed;
    process.exit(passed ? 0 : 1);
}

for (const outputPath of restoredPaths) {
    writeFile(outputPath, restored.get(outputPath).content);
}

writeFile('.planning/source-provenance.md', buildProvenance(restored, provenance));

console.log(`Restored ${restoredPaths.length} backend source files to src/**`);
