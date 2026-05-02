import { describe, expect, it } from 'vitest';
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
