/**
 * Blizzard (Blizzard) 专有 OTP 算法
 * 底层使用标准 TOTP (HMAC-SHA1)，但强制使用 8 位数字
 */
import { generateTOTP } from '@/shared/utils/otp/protocols/totp';

export async function generateBlizzardOTP(
    secret: string | Uint8Array,
    timeStep = 30,
    timestamp = Date.now()
): Promise<string> {
    // Blizzard 固定为 8 位 SHA-1
    return generateTOTP(secret, timeStep, 8, 'SHA-1', timestamp);
}
