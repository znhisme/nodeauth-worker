/**
 * OTP 基础工具层 (原子操作)
 * 包含 Base32 解码、HMAC 计算等底层依赖
 */

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function validateBase32Secret(secret: any): boolean {
    if (!secret || typeof secret !== 'string') return false;
    const cleaned = secret.replace(/\s/g, '').toUpperCase();
    return /^[A-Z2-7]+=*$/.test(cleaned) && cleaned.length >= 8;
}

export function base32Decode(encoded: string): Uint8Array {
    const cleanInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
    const buffer = new Uint8Array(Math.floor(cleanInput.length * 5 / 8));
    let bits = 0, value = 0, index = 0;

    for (let i = 0; i < cleanInput.length; i++) {
        const charValue = BASE32_CHARS.indexOf(cleanInput[i]);
        if (charValue === -1) continue;
        value = (value << 5) | charValue;
        bits += 5;
        if (bits >= 8) {
            buffer[index++] = (value >>> (bits - 8)) & 255;
            bits -= 8;
        }
    }
    return buffer;
}

export function bytesToBase32(bytes: Uint8Array): string {
    let bits = 0, value = 0, output = '';
    for (let i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i];
        bits += 8;
        while (bits >= 5) {
            output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += BASE32_CHARS[(value << (5 - bits)) & 31];
    }
    return output;
}

/**
 * 通用 HMAC 计算
 */
export async function hmac(key: Uint8Array | string, data: number, algorithm = 'SHA-1'): Promise<Uint8Array> {
    const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key;
    const dataBuffer = new ArrayBuffer(8);
    new DataView(dataBuffer).setBigUint64(0, BigInt(data), false);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer as any,
        { name: 'HMAC', hash: algorithm.includes('-') ? algorithm : algorithm.replace('SHA', 'SHA-') },
        false,
        ['sign']
    );
    // @ts-ignore
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer as any as ArrayBuffer);
    return new Uint8Array(signature);
}

/**
 * 通用字节 HMAC-SHA1 计算
 */
export async function hmacSHA1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key as any,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data as any);
    return new Uint8Array(signature);
}
