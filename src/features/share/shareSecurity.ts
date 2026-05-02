import { AppError, type EnvBindings } from '@/app/config';
import {
    SHARE_ACCESS_CODE_BYTES,
    SHARE_DEFAULT_TTL_SECONDS,
    SHARE_MAX_TTL_SECONDS,
    SHARE_RATE_LIMIT_LOCK_MS,
    SHARE_RATE_LIMIT_MAX_ATTEMPTS,
    SHARE_RATE_LIMIT_WINDOW_MS,
    SHARE_TOKEN_BYTES,
} from '@/features/share/shareTypes';

const textEncoder = new TextEncoder();

function encodeBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    const binary = atob(`${normalized}${padding}`);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

function constantTimeEqual(left: string, right: string): boolean {
    const leftBytes = textEncoder.encode(left);
    const rightBytes = textEncoder.encode(right);
    const maxLength = Math.max(leftBytes.length, rightBytes.length);
    let mismatch = leftBytes.length ^ rightBytes.length;

    for (let index = 0; index < maxLength; index += 1) {
        const leftByte = leftBytes[index] ?? 0;
        const rightByte = rightBytes[index] ?? 0;
        mismatch |= leftByte ^ rightByte;
    }

    return mismatch === 0;
}

function getRandomBytes(byteLength: number): Uint8Array {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return bytes;
}

/**
 * Generate a share token for a single shared vault item.
 */
export function generateShareToken(): string {
    return encodeBase64Url(getRandomBytes(SHARE_TOKEN_BYTES));
}

/**
 * Generate the access code that protects recipient access.
 */
export function generateAccessCode(): string {
    return encodeBase64Url(getRandomBytes(SHARE_ACCESS_CODE_BYTES));
}

/**
 * Derive a one-way share secret hash using HMAC-SHA-256.
 */
export async function hashShareSecret(pepper: string, purpose: string, value: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(pepper),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        textEncoder.encode(`${purpose}:${value}`),
    );
    return encodeBase64Url(new Uint8Array(signature));
}

/**
 * Verify a raw share secret against its stored HMAC-derived hash.
 */
export async function verifyShareSecret(pepper: string, purpose: string, value: string, hash: string): Promise<boolean> {
    const expectedHash = await hashShareSecret(pepper, purpose, value);
    return constantTimeEqual(expectedHash, hash);
}

/**
 * Canonicalize a public origin into the share URL path.
 */
export function buildShareUrl(publicOrigin: string, token: string): string {
    const origin = normalizePublicOrigin(publicOrigin);
    return new URL(`/share/${token}`, origin).toString();
}

/**
 * Normalize a public origin while rejecting unsafe request origins.
 */
export function normalizePublicOrigin(publicOrigin: string): string {
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(publicOrigin);
    } catch {
        throw new AppError('invalid_public_origin', 500);
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const isLocalHttp = parsedUrl.protocol === 'http:' && (
        parsedUrl.hostname === 'localhost' ||
        parsedUrl.hostname === '127.0.0.1' ||
        parsedUrl.hostname === '[::1]' ||
        parsedUrl.hostname === '::1'
    );

    if (!isHttps && !isLocalHttp) {
        throw new AppError('invalid_public_origin', 500);
    }

    return parsedUrl.origin;
}

/**
 * Public responses must never be cached or referrer-leaked.
 */
export function getSharePublicHeaders(): Record<string, string> {
    return {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        'Referrer-Policy': 'no-referrer',
    };
}

/**
 * Resolve the share-link pepper from env with a safe fallback.
 */
export function getShareSecretPepper(env: Pick<EnvBindings, 'SHARE_SECRET_PEPPER' | 'JWT_SECRET'>): string {
    if (env.SHARE_SECRET_PEPPER) {
        return env.SHARE_SECRET_PEPPER;
    }

    if (env.JWT_SECRET) {
        return env.JWT_SECRET;
    }

    throw new AppError('missing_share_secret_pepper', 500);
}

export function clampShareTtlSeconds(ttlSeconds: number | undefined): number {
    if (!Number.isFinite(ttlSeconds)) {
        return SHARE_DEFAULT_TTL_SECONDS;
    }

    const normalized = Math.max(1, Math.floor(ttlSeconds));
    return Math.min(normalized, SHARE_MAX_TTL_SECONDS);
}

export function getShareRateLimitWindowMs(): number {
    return SHARE_RATE_LIMIT_WINDOW_MS;
}

export function getShareRateLimitMaxAttempts(): number {
    return SHARE_RATE_LIMIT_MAX_ATTEMPTS;
}

export function getShareRateLimitLockMs(): number {
    return SHARE_RATE_LIMIT_LOCK_MS;
}

export function decodeShareToken(rawToken: string): Uint8Array {
    return decodeBase64Url(rawToken);
}
