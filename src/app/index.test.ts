import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { redactSharePublicToken, resolveApiCorsOrigin } from '@/app/index';

describe('redactSharePublicToken', () => {
    it('redacts public share access tokens from logged request paths', () => {
        const redacted = redactSharePublicToken('POST /api/share/public/raw-public-token-123/access 404');

        expect(redacted).toContain('/api/share/public/[share-token]/access');
        expect(redacted).toContain('[share-token]');
        expect(redacted).not.toContain('raw-public-token-123');
    });

    it('preserves ordinary API paths', () => {
        expect(redactSharePublicToken('GET /api/vault?page=1 200')).toBe('GET /api/vault?page=1 200');
    });
});

describe('share route mounting', () => {
    it('imports and mounts share routes before the API fallback', () => {
        const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

        expect(source).toContain("import shareRoutes from '@/features/share/shareRoutes';");
        expect(source).toContain("app.route('/api/share', shareRoutes);");
        expect(source.indexOf("app.route('/api/share', shareRoutes);"))
            .toBeLessThan(source.indexOf("app.all('/api/*'"));
    });
});

describe('resolveApiCorsOrigin', () => {
    it('denies arbitrary origins when a trusted public origin is configured', () => {
        expect(resolveApiCorsOrigin('https://evil.example', {
            NODEAUTH_PUBLIC_ORIGIN: 'https://nodeauth.example',
        } as any)).toBeNull();
    });

    it('allows the configured public origin deterministically', () => {
        expect(resolveApiCorsOrigin('https://nodeauth.example', {
            NODEAUTH_PUBLIC_ORIGIN: 'https://nodeauth.example',
        } as any)).toBe('https://nodeauth.example');
    });

    it('normalizes trailing slashes in the configured public origin', () => {
        expect(resolveApiCorsOrigin('https://nodeauth.example', {
            NODEAUTH_PUBLIC_ORIGIN: 'https://nodeauth.example/',
        } as any)).toBe('https://nodeauth.example');
    });

    it('does not reflect arbitrary origins when no trusted origin is configured', () => {
        expect(resolveApiCorsOrigin('https://evil.example', {} as any)).toBeNull();
    });

    it('does not reflect empty origins', () => {
        expect(resolveApiCorsOrigin('', {
            NODEAUTH_PUBLIC_ORIGIN: 'https://nodeauth.example',
        } as any)).toBeNull();
    });
});

describe('API CORS source contract', () => {
    it('does not reflect arbitrary origins and delegates to resolveApiCorsOrigin', () => {
        const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

        expect(source).not.toContain('origin: (origin) => origin');
        expect(source).not.toMatch(/origin:\s*['"]\*['"]/);
        expect(source).toContain('origin: (origin, c) => resolveApiCorsOrigin(origin, c.env)');
        expect(source).toContain('credentials: true');
    });
});

describe('share cleanup runtime source contract', () => {
    it('keeps Worker scheduled backup and adds share cleanup to waitUntil', () => {
        const source = readFileSync(new URL('./worker.ts', import.meta.url), 'utf8');

        expect(source).toContain("import { createShareService } from '@/features/share/shareService';");
        expect(source).toContain('async scheduled');
        expect(source).toContain('ctx.waitUntil(Promise.all([');
        expect(source).toContain('handleScheduledBackup(specializedEnv)');
        expect(source).toContain('createShareService(specializedEnv as any).cleanupShareState()');
    });

    it('keeps Docker daily backup cron and logs share cleanup counts only', () => {
        const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');

        expect(source).toContain("import { createShareService } from '@/features/share/shareService';");
        expect(source).toContain("cron.schedule('0 2 * * *'");
        expect(source).toContain('handleScheduledBackup(envTemplate as any)');
        expect(source).toContain('[Cron] Triggering share cleanup...');
        expect(source).toContain('createShareService(envTemplate as any).cleanupShareState()');
        expect(source).toContain('expiredSharesMarked: result.expiredSharesMarked');
        expect(source).toContain('staleRateLimitRowsDeleted: result.staleRateLimitRowsDeleted');
        expect(source).toContain('[Cron] Share cleanup failed:');
        expect(source).not.toContain('rawToken');
        expect(source).not.toContain('rawAccessCode');
        expect(source).not.toContain('accessCodeHash');
    });

    it('adds Netlify opportunistic cleanup after cached DB initialization without blocking app fetch', () => {
        const source = readFileSync(new URL('./netlify.ts', import.meta.url), 'utf8');

        expect(source).toContain("import { createShareService } from '@/features/share/shareService'");
        expect(source).toContain('const SHARE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;');
        expect(source).toContain('let lastShareCleanupAt = 0;');
        expect(source).toContain('if (cachedDb?.db && now - lastShareCleanupAt >= SHARE_CLEANUP_INTERVAL_MS)');
        expect(source).toContain('lastShareCleanupAt = now;');
        expect(source).toContain('DB: cachedDb.db');
        expect(source).toContain('cleanupShareState(now)');
        expect(source).toContain("[Share Cleanup] Completed");
        expect(source).toContain("[Share Cleanup] Failed:");
        expect(source.indexOf('cleanupShareState(now)')).toBeLessThan(source.indexOf('const res = await app.fetch'));
        expect(source).toContain('const res = await app.fetch');
    });
});
