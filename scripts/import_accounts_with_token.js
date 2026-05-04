#!/usr/bin/env node

/*
 * Import NodeAuth accounts with a logged-in user's auth_token JWT.
 *
 * Usage:
 *   NODEAUTH_BASE_URL="https://nodeauth.example.com" \
 *   NODEAUTH_AUTH_TOKEN="eyJ..." \
 *   node scripts/import_accounts_with_token.js --type text --file ./accounts.txt
 *
 * Supported import types are the same as POST /api/vault/import:
 *   text, json, 2fas, raw, encrypted
 *
 * For encrypted imports, also pass --password or NODEAUTH_IMPORT_PASSWORD.
 */

const fs = require('fs');
const path = require('path');

function printUsage() {
    console.log(`Usage:
  NODEAUTH_BASE_URL="https://nodeauth.example.com" \\
  NODEAUTH_AUTH_TOKEN="eyJ..." \\
  node scripts/import_accounts_with_token.js --type text --file ./accounts.txt

Options:
  --base-url <url>     NodeAuth base URL. Overrides NODEAUTH_BASE_URL.
  --token <jwt>        Logged-in auth_token JWT. Overrides NODEAUTH_AUTH_TOKEN.
  --type <type>        Import type: text, json, 2fas, raw, encrypted.
  --file <path>        File containing import payload.
  --password <value>   Password for encrypted imports.
  --help              Show this help.

Environment:
  NODEAUTH_BASE_URL
  NODEAUTH_AUTH_TOKEN
  NODEAUTH_IMPORT_PASSWORD
`);
}

function parseArgs(argv) {
    const args = {};

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];

        if (arg === '--help' || arg === '-h') {
            args.help = true;
            continue;
        }

        if (!arg.startsWith('--')) {
            throw new Error(`Unexpected argument: ${arg}`);
        }

        const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) {
            throw new Error(`Missing value for ${arg}`);
        }

        args[key] = value;
        i += 1;
    }

    return args;
}

function normalizeBaseUrl(baseUrl) {
    if (!baseUrl) {
        throw new Error('Missing base URL. Set NODEAUTH_BASE_URL or pass --base-url.');
    }

    return baseUrl.replace(/\/+$/, '');
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printUsage();
        return;
    }

    const baseUrl = normalizeBaseUrl(args.baseUrl || process.env.NODEAUTH_BASE_URL);
    const token = args.token || process.env.NODEAUTH_AUTH_TOKEN;
    const type = args.type;
    const filePath = args.file;
    const password = args.password || process.env.NODEAUTH_IMPORT_PASSWORD;

    if (!token) {
        throw new Error('Missing auth token. Set NODEAUTH_AUTH_TOKEN or pass --token.');
    }
    if (!type) {
        throw new Error('Missing import type. Pass --type text|json|2fas|raw|encrypted.');
    }
    if (!filePath) {
        throw new Error('Missing import file. Pass --file <path>.');
    }

    const absolutePath = path.resolve(filePath);
    const content = fs.readFileSync(absolutePath, 'utf8');

    const body = { type, content };
    if (password) {
        body.password = password;
    }

    const response = await fetch(`${baseUrl}/api/vault/import`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let parsed;
    try {
        parsed = JSON.parse(responseText);
    } catch {
        parsed = responseText;
    }

    if (!response.ok) {
        console.error(JSON.stringify({
            ok: false,
            status: response.status,
            response: parsed,
        }, null, 2));
        process.exit(1);
    }

    console.log(JSON.stringify(parsed, null, 2));
}

main().catch((error) => {
    console.error(`Import failed: ${error.message}`);
    process.exit(1);
});

