/**
 * OTP 统一调度入口
 * 负责 URI 解析、URI 构造和验证码生成的统一对外接口
 */
import { sanitizeInput } from '@/shared/utils/common';
import { validateBase32Secret, base32Decode, hmac, hmacSHA1, bytesToBase32 } from '@/shared/utils/otp/base';
import { generateTOTP } from '@/shared/utils/otp/protocols/totp';
import { generateSteamTOTP } from '@/shared/utils/otp/protocols/steam';
import { generateHOTP } from '@/shared/utils/otp/protocols/hotp';
import { generateBlizzardOTP } from '@/shared/utils/otp/protocols/blizzard';

export { validateBase32Secret, base32Decode, hmac, hmacSHA1, bytesToBase32 };
export { generateTOTP };
export { generateSteamTOTP };
export { generateHOTP };
export { generateBlizzardOTP };

/**
 * 统一生成入口：根据 algorithm 字段自动调度到对应实现
 */
export async function generate(
    secret: string | Uint8Array,
    timeOrCounter = 30, // 对于 TOTP 是间隔，对于 HOTP 是计数器
    digits = 6,
    algorithm = 'SHA1',
    type = 'totp',
    timestamp = Date.now()
): Promise<string> {
    if (type === 'steam') {
        return generateSteamTOTP(secret, timeOrCounter);
    }
    if (type === 'blizzard') {
        return generateBlizzardOTP(secret, timeOrCounter, timestamp);
    }
    if (type === 'hotp') {
        return generateHOTP(secret, timeOrCounter, digits, algorithm);
    }
    return generateTOTP(secret, timeOrCounter, digits, algorithm, timestamp);
}

/**
 * 规范化 OTP 账户参数 (核心归一化逻辑)
 * 根据类型自动纠正位数、算法、周期等参数，并填充默认值
 */
export function normalizeOtpAccount(item: any = {}) {
    const type = resolveOtpType(item.type, item);
    const normalized = { ...item, type };

    // 1. 处理各类型的强制约束与默认偏好
    if (type === 'steam') {
        normalized.digits = 5;
        normalized.period = 30;
        normalized.algorithm = 'SHA1';
    } else if (type === 'blizzard') {
        normalized.digits = 8;
        normalized.period = 30;
        normalized.algorithm = 'SHA1';
    } else {
        // 算法归一化
        let algo = (item.algorithm || 'SHA1').toUpperCase().replace(/-/g, '');
        if (!['SHA1', 'SHA256', 'SHA512'].includes(algo)) algo = 'SHA1';
        normalized.algorithm = algo;

        // 位数归一化
        let digits = parseInt(item.digits || '6');
        if (isNaN(digits) || digits <= 0) digits = 6;
        normalized.digits = digits;

        // 周期归一化
        let period = parseInt(item.period || '30');
        if (isNaN(period) || period <= 0) period = 30;
        normalized.period = period;
    }

    // 2. 基础字段清洗 (对齐 @.agents/rules/backup.md 中的入库清洗逻辑)
    normalized.service = sanitizeInput(normalized.service || normalized.issuer || 'Unknown', 50);
    normalized.issuer = normalized.service;

    let account = normalized.account || normalized.label || 'Unknown';
    if (typeof account === 'string' && account.includes(':')) {
        // 💡 架构师注：剥离可能存在的 issuer:account 格式，确保 account 字段纯净
        account = account.split(':').pop()?.trim() || account;
    }
    normalized.account = sanitizeInput(account, 100);

    const rawSecret = normalized.secret || '';
    normalized.secret = rawSecret.startsWith('nodeauth:')
        ? rawSecret  // nodeauth: 密文是 Base64，大小写敏感，不能 toUpperCase
        : rawSecret.replace(/[\s=]/g, '').toUpperCase();
    normalized.counter = parseInt(normalized.counter || '0');
    if (isNaN(normalized.counter) || normalized.counter < 0) normalized.counter = 0;

    return normalized;
}

/**
 * 规范化 OTP 类型识别 (中心化策略)
 * 方便未来扩展 Yandex, Blizzard 等特殊算法
 */
export function resolveOtpType(typeRaw: string, context: { algorithm?: string; service?: string; digits?: number; type?: string; counter?: number } = {}) {
    const type = (typeRaw || context.type || '').toLowerCase().trim();
    const algo = (context.algorithm || '').toUpperCase();
    const service = (context.service || '').toUpperCase();
    const digits = context.digits || 0;

    // 1. Steam 特征优先级最高
    if (type === 'steam' || type === 'steam guard' || algo === 'STEAM' || (digits === 5 && service.includes('STEAM'))) {
        return 'steam';
    }

    // 2. Blizzard.net (Battle.net) 特征识别
    if (['blizzard', 'battle.net'].some(k => type.includes(k) || service.includes(k.toUpperCase()))) {
        return 'blizzard';
    }

    // 3. 显式 TOTP 标识
    if (type === 'totp') {
        return 'totp';
    }

    // 3. HOTP 识别 (显式标识或具备计数器特征)
    if (type === 'hotp' || (context.hasOwnProperty('counter') && context.counter !== null && context.counter !== undefined)) {
        return 'hotp';
    }

    return 'totp';
}

/**
 * 解析 OTP URI
 */
export function parseOTPAuthURI(uri: string) {
    try {
        if (!uri || typeof uri !== 'string' || uri.length > 2000) return null;

        // 1. 处理 steam:// 独立协议 (SDA 镜像导入)
        if (uri.startsWith('steam://')) {
            const secret = uri.replace('steam://', '').replace(/[\s=]/g, '').toUpperCase();
            if (!validateBase32Secret(secret)) return null;
            return {
                type: 'steam',
                label: 'Steam',
                issuer: 'Steam',
                account: 'Steam',
                secret,
                digits: 5,
                period: 30,
                algorithm: 'SHA1',
                counter: 0
            };
        }

        const url = new URL(uri);
        if (url.protocol !== 'otpauth:') return null;

        // 对齐前端：支持 hostname 为 hotp/totp/steam
        // 💡 架构师注：部分浏览器环境解析非标准协议时 url.host 可能为空，需从 pathname 路径探针中补偿
        let typeHeader = url.host || url.hostname;
        if (!typeHeader && url.pathname.startsWith('//')) {
            typeHeader = url.pathname.substring(2).split('/')[0];
        }
        typeHeader = (typeHeader || '').toLowerCase();

        const params = new URLSearchParams(url.search);
        const secret = params.get('secret');
        if (!validateBase32Secret(secret)) return null;

        const label = decodeURIComponent(url.pathname.substring(1));
        const [issuer, account] = label.includes(':') ? label.split(':', 2) : ['', label];
        const issuerName = params.get('issuer') || issuer;

        const digitsVal = parseInt(params.get('digits') || '0');
        const periodVal = parseInt(params.get('period') || '30');
        const counterVal = parseInt(params.get('counter') || '0');

        // 使用统一的归一化引擎
        return normalizeOtpAccount({
            service: issuerName,
            account: account || label,
            label: label,
            secret: secret,
            type: typeHeader,
            digits: digitsVal,
            period: periodVal,
            counter: counterVal,
            algorithm: params.get('algorithm') || 'SHA1'
        });
    } catch {
        return null;
    }
}

/**
 * 构造标准的 otpauth:// URI
 */
export function buildOTPAuthURI(data: {
    service: string;
    account: string;
    secret: string;
    algorithm?: string;
    digits?: number;
    period?: number;
    type?: string;
    counter?: number;
}) {
    // 💡 架构师注：生成 URI 前必须先进行归一化，确保 'battle'/'steam' 等别名被正确处理且强制了特定算法/位数
    const normalized = normalizeOtpAccount(data);
    const { service, account, secret, type, algorithm, digits, period, counter } = normalized;

    const label = account ? encodeURIComponent(`${service}:${account}`) : encodeURIComponent(service);
    const issuer = encodeURIComponent(service);

    if (type === 'hotp') {
        let uri = `otpauth://hotp/${label}?secret=${secret}&counter=${counter}`;
        if (service) uri += `&issuer=${issuer}`;
        if (algorithm !== 'SHA1') uri += `&algorithm=${algorithm}`;
        if (digits !== 6) uri += `&digits=${digits}`;
        return uri;
    }

    if (type === 'steam') {
        // 对齐前端：使用 otpauth://steam/ 格式并补充参数 (修正：参数中使用 SHA1 以对齐专业规范)
        return `otpauth://steam/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=5`;
    }

    if (type === 'blizzard') {
        // Blizzard 导出：由于大多数 App 将其识别为 TOTP，但在 NodeAuth 中我们通过 issuer + digits=8 自动重识别
        return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=8&period=30`;
    }

    return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=${algorithm}&digits=${digits}&period=${period}`;
}
