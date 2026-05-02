/**
 * Steam Guard 专有 OTP 算法
 * 底层使用 HMAC-SHA1，但截断逻辑与 RFC 6238 不同：
 *   - 输出 5 位字符（非数字）
 *   - 使用特定字符集作为 Base-26 编码
 */
import { base32Decode, hmac } from '@/shared/utils/otp/base';

const STEAM_CHARS = '23456789BCDFGHJKMNPQRTVWXY';

export async function generateSteamTOTP(
    secret: string | Uint8Array,
    timeStep = 30
): Promise<string> {
    const time = Math.floor(Date.now() / 1000 / timeStep);
    const secretBytes = typeof secret === 'string' ? base32Decode(secret) : secret;
    const hmacResult = await hmac(secretBytes, time, 'SHA-1');

    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    let binary =
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);

    let code = '';
    for (let i = 0; i < 5; i++) {
        code += STEAM_CHARS.charAt(binary % STEAM_CHARS.length);
        binary = Math.floor(binary / STEAM_CHARS.length);
    }
    return code;
}
