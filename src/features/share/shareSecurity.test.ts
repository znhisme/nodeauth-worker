import { describe, expect, it } from 'vitest';
import {
    buildShareUrl,
    generateAccessCode,
    generateShareToken,
    getSharePublicHeaders,
    hashShareSecret,
    verifyShareSecret,
} from '@/features/share/shareSecurity';

describe('shareSecurity', () => {
    it('generates a base64url share token', () => {
        const token = generateShareToken();

        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(token).not.toContain('+');
        expect(token).not.toContain('/');
        expect(token).not.toContain('=');
        expect(token.length).toBeGreaterThanOrEqual(43);
    });

    it('generates a base64url access code', () => {
        const accessCode = generateAccessCode();

        expect(accessCode).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(accessCode).not.toContain('+');
        expect(accessCode).not.toContain('/');
        expect(accessCode).not.toContain('=');
        expect(accessCode.length).toBeGreaterThanOrEqual(22);
    });

    it('hashes secrets by purpose', async () => {
        const tokenHash = await hashShareSecret('pepper', 'share-token', 'raw-secret');
        const accessCodeHash = await hashShareSecret('pepper', 'access-code', 'raw-secret');

        expect(tokenHash).not.toBe('raw-secret');
        expect(tokenHash).not.toBe(accessCodeHash);
    });

    it('verifies secrets against stored hashes', async () => {
        const hash = await hashShareSecret('pepper', 'access-code', 'raw-secret');

        await expect(verifyShareSecret('pepper', 'access-code', 'raw-secret', hash)).resolves.toBe(true);
        await expect(verifyShareSecret('pepper', 'access-code', 'wrong-secret', hash)).resolves.toBe(false);
    });

    it('builds a canonical public share url', () => {
        expect(buildShareUrl('https://example.com/app/', 'abc')).toBe('https://example.com/share/abc');
    });

    it('returns public no-store headers', () => {
        expect(getSharePublicHeaders()).toEqual({
            'Cache-Control': 'no-store',
            Pragma: 'no-cache',
            'Referrer-Policy': 'no-referrer',
        });
    });
});
