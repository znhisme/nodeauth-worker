/**
 * 标准 TOTP 算法实现 (RFC 6238)
 * 支持 SHA-1 / SHA-256 / SHA-512，6 / 7 / 8 位
 */
import { base32Decode, hmac } from '@/shared/utils/otp/base';

export async function generateTOTP(
    secret: string | Uint8Array,
    timeStep = 30,
    digits = 6,
    algorithm = 'SHA-1',
    timestamp = Date.now()
): Promise<string> {
    const time = Math.floor(timestamp / 1000 / timeStep);
    const secretBytes = typeof secret === 'string' ? base32Decode(secret) : secret;
    const hmacResult = await hmac(secretBytes, time, algorithm);

    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const binary =
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);

    const code = binary % Math.pow(10, digits);
    return code.toString().padStart(digits, '0');
}
