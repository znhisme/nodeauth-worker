import { Buffer } from 'node:buffer';

/**
 * Masking utilities for user data privacy
 */

/**
 * Desensitize user ID or email
 * Scheme: Keep first 3 chars if length >= 3, else keep 1 char. Append '***'.
 * For emails, process username part separately.
 */
export const maskUserId = (id: string | null | undefined): string => {
    if (!id) return '***';

    // 处理邮箱格式
    if (id.includes('@')) {
        const [username, domain] = id.split('@');
        if (username.length >= 3) {
            return `${username.slice(0, 3)}***@${domain}`;
        }
        return `${username.slice(0, 1) || ''}***@${domain}`;
    }

    // 处理纯数字、UUID或普通字符串
    if (id.length >= 3) {
        return `${id.slice(0, 3)}***`;
    }
    return `${id.slice(0, 1) || ''}***`;
};

/**
 * Desensitize IP addresses (IPv4 / IPv6)
 */
export const maskIp = (ip: string | null | undefined): string => {
    if (!ip) return '***';

    // IPv4: 1.2.3.4 -> 1.2.3.***
    if (ip.includes('.')) {
        const parts = ip.split('.');
        if (parts.length >= 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
        }
    }

    // IPv6: a:b:c:d:e:f -> a:b:c:d:****
    if (ip.includes(':')) {
        const parts = ip.split(':');
        if (parts.length >= 4) {
            return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:****`;
        }
    }

    return ip;
};

const ALGORITHM = 'AES-GCM';

/**
 * Derive a 256-bit masking key from a session salt using SHA-256
 */
export async function deriveMaskingKey(salt: string | Buffer): Promise<Buffer> {
    const encoder = new TextEncoder();
    const saltBuffer = typeof salt === 'string' ? encoder.encode(salt) : salt;
    const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(saltBuffer));
    return Buffer.from(hashBuffer);
}

/**
 * Mask the secret using AES-GCM and prefix it with 'nodeauth:'
 */
export async function maskSecret(secretText: string, maskingKey: Buffer): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const keyUsage = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(maskingKey),
        ALGORITHM,
        false,
        ['encrypt']
    );

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(secretText);

    const ciphertextBuffer = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv: iv },
        keyUsage,
        dataBuffer
    );

    const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertextBuffer), iv.length);

    return 'nodeauth:' + Buffer.from(combined).toString('base64');
}

/**
 * Unmask the 'nodeauth:' prefixed secret
 */
export async function unmaskSecret(maskedData: string, maskingKey: Buffer): Promise<string> {
    if (!maskedData.startsWith('nodeauth:')) {
        throw new Error('invalid_masking_prefix');
    }

    const payload = maskedData.slice('nodeauth:'.length);
    const combined = Buffer.from(payload, 'base64');

    if (combined.length < 12) {
        throw new Error('invalid_payload_length');
    }

    const iv = combined.subarray(0, 12);
    const ciphertext = combined.subarray(12);

    const keyUsage = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(maskingKey),
        ALGORITHM,
        false,
        ['decrypt']
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv: iv },
        keyUsage,
        ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
}
