/**
 * NodeAuth Variable Injection Script
 * Purpose: Replaces placeholders like __DIST_COMMIT_HASH__ with actual values during deployment.
 * Used by wrangler.toml [build] hook or manually during CI/CD.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getCommitHash() {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch (e) {
        return process.env.GITHUB_SHA ? process.env.GITHUB_SHA.substring(0, 7) : 'unknown';
    }
}

/**
 * Platform Detection Logic (Embedded for standalone distribution compatibility)
 */
const PLATFORM_REGISTRY = [
    { name: 'Netlify', suffix: 'netlify', envKeys: ['NETLIFY', 'NETLIFY_SITE_ID'] },
    { name: 'Vercel', suffix: 'vercel', envKeys: ['VERCEL', 'VERCEL_PROJECT_ID'] },
    { name: 'Docker', suffix: 'docker', envKeys: ['DOCKER_BUILD'] },
    { name: 'Cloudflare Workers', suffix: 'cloudflare', envKeys: [] },
];

function detectPlatform(env = process.env) {
    const explicit = PLATFORM_REGISTRY.find(p => p.suffix === env.DEPLOY_PLATFORM);
    if (explicit) return explicit;

    const fingerprinted = PLATFORM_REGISTRY.find(p => p.envKeys.some(k => !!env[k]));
    if (fingerprinted) return fingerprinted;

    return PLATFORM_REGISTRY.at(-1);
}

// Support --platform=<suffix> CLI arg as an override
const platformArg = process.argv.find(arg => arg.startsWith('--platform='));
if (platformArg) {
    process.env.DEPLOY_PLATFORM = platformArg.split('=')[1];
}

const commitHash = getCommitHash();
const platform = detectPlatform();

console.log(`💉 Injecting variables:`);
console.log(`   - Commit: ${commitHash}`);
console.log(`   - Platform: ${platform.name}`);
console.log(`   - Icon Suffix: ${platform.suffix}`);

function replaceInDir(dir, replacements) {
    if (!fs.existsSync(dir)) {
        console.warn(`⚠️ Directory not found: ${dir}`);
        return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    entries.forEach(entry => {
        const entryName = entry.name;
        const filePath = path.join(dir, entryName);

        if (entry.isDirectory()) {
            replaceInDir(filePath, replacements);
        } else if (entry.isFile() && (
            entryName.endsWith('.js') ||
            entryName.endsWith('.mjs') ||
            entryName.endsWith('.html') ||
            entryName.endsWith('.json') ||
            entryName.endsWith('.webmanifest')
        )) {
            try {
                let content = fs.readFileSync(filePath, 'utf8');
                let modified = false;

                Object.entries(replacements).forEach(([pattern, value]) => {
                    if (content.includes(pattern)) {
                        content = content.split(pattern).join(value);
                        modified = true;
                    }
                });

                if (modified) {
                    fs.writeFileSync(filePath, content, 'utf8');
                    console.log(`   ✅ Injected: ${path.relative(process.cwd(), filePath)}`);
                }
            } catch (err) {
                console.error(`   ❌ Failed to process ${filePath}: ${err.message}`);
            }
        }
    });
}

// Define paths relative to the script location (assuming it's in scripts/)
const rootDir = path.resolve(__dirname, '..');
const searchPaths = [
    path.join(rootDir, 'frontend/dist'),
    path.join(rootDir, 'backend/dist'),
    path.join(rootDir, 'api')
];

const replacements = {
    '__DIST_COMMIT_HASH__': commitHash,
    '__DIST_PLATFORM__': platform.name,
    '__DIST_ICON_SUFFIX__': platform.suffix
};

searchPaths.forEach(distPath => {
    console.log(`🔍 Scanning: ${path.relative(process.cwd(), distPath)}`);
    replaceInDir(distPath, replacements);
});

console.log('✨ All variables injected successfully.');