/**
 * 标准 HOTP 算法实现 (RFC 4226)
 * 支持 6 / 7 / 8 位验证码
 */
import { base32Decode, hmac } from '@/shared/utils/otp/base';

export async function generateHOTP(
    secret: string | Uint8Array,
    counter: number,
    digits = 6,
    algorithm = 'SHA-1'
): Promise<string> {
    const secretBytes = typeof secret === 'string' ? base32Decode(secret) : secret;
    // HOTP 的 HMAC 数据部分是 8 字节的计数器值
    const hmacResult = await hmac(secretBytes, counter, algorithm);

    // 标准截断逻辑 (Dynamic Truncation)
    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const binary =
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);

    const code = binary % Math.pow(10, digits);
    return code.toString().padStart(digits, '0');
}
