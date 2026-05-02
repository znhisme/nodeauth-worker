import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { redactSharePublicToken } from '@/app/index';

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
