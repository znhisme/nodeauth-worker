import { EnvBindings } from '@/app/config';

export type HealthIssueLevel = 'critical' | 'error' | 'warning';

export interface HealthIssue {
    field: string;
    level: HealthIssueLevel;
    message: string;
    suggestion: string;
    deploy_by_worker: string;
    deploy_by_gitaction: string;
    deploy_by_docker: string;
    missingFields?: string[];
}

export interface HealthCheckResult {
    passed: boolean;
    issues: HealthIssue[];
    passedChecks: string[];
    status?: 'pass' | 'fail';
}

// --- 新增：域名标准化（剥离协议、端口、路径）---
const normalizeDomain = (domain: string): string => {
    let d = domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .split(':')[0]
        .split('/')[0]
        .replace(/\/+$/, '');

    // 开发环境与局域网移动端测试特殊处理：指定 IP 等同于 localhost
    if (d === '127.0.0.1' || d === '192.168.100.100') return 'localhost';
    return d;
};

// --- 新增：Ed25519 License 校验（原生 Web Crypto，无 WASM 依赖）---
export const validateLicense = async (license: string, currentHost: string): Promise<{ success: boolean; message?: string }> => {
    if (!license) return { success: false, message: 'license_missing' };
    try {
        const clean = license.replace(/[^a-zA-Z0-9+/=]/g, '');
        const decoded = atob(clean);
        const parts = decoded.split('|');
        if (parts.length !== 3) return { success: false, message: 'license_invalid_format' };

        const [domain, expiry, signatureBase64] = parts;

        if (normalizeDomain(domain) !== normalizeDomain(currentHost)) {
            return { success: false, message: 'license_domain_mismatch' };
        }
        if (Date.now() > parseInt(expiry)) {
            return { success: false, message: 'license_expired' };
        }

        const PUBLIC_KEY_HEX = '7c3dfb50523e20b2d7df136631f1a46d5b21cf4fde0824bd6dcdfbdd00ea0a8c';
        const publicKey = await crypto.subtle.importKey(
            'raw',
            new Uint8Array(PUBLIC_KEY_HEX.match(/.{1,2}/g)!.map(b => parseInt(b, 16))),
            { name: 'Ed25519', namedCurve: 'Ed25519' },
            false,
            ['verify']
        );
        const sigBytes = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
        const dataBytes = new TextEncoder().encode(`${domain}|${expiry}`);
        const isValid = await crypto.subtle.verify('Ed25519', publicKey, sigBytes, dataBytes);

        return isValid ? { success: true } : { success: false, message: 'license_invalid_signature' };
    } catch (e) {
        return { success: false, message: 'license_invalid_format' };
    }
};

export const runHealthCheck = async (env: EnvBindings, requestUrl?: string): Promise<HealthCheckResult> => {
    const issues: HealthIssue[] = [];
    const passedChecks: string[] = [];

    // 0 Check NODEAUTH_LICENSE（Ed25519 非对称授权校验）
    const license = env.NODEAUTH_LICENSE || '';
    let host = env.OAUTH_TELEGRAM_BOT_DOMAIN || 'localhost';
    if (requestUrl) {
        try {
            host = new URL(requestUrl).hostname;
        } catch (e) {
            // Ignore URL parsing errors and use fallback host
        }
    }
    const licenseResult = await validateLicense(license, host);
    if (!licenseResult.success) {
        issues.push({
            field: 'NODEAUTH_LICENSE',
            level: 'critical',
            message: licenseResult.message as string,
            suggestion: 'license_suggestion',
            deploy_by_worker: 'suggestion_deploy_by_worker',
            deploy_by_gitaction: 'suggestion_deploy_by_gitaction',
            deploy_by_docker: 'suggestion_deploy_by_docker'
        });
    } else {
        passedChecks.push('license_passed');
    }

    // 1. Check ENCRYPTION_KEY
    const encKey = env.ENCRYPTION_KEY || '';
    // Note: User requests >= 32 length
    if (!encKey || encKey.length < 32) {
        issues.push({
            field: 'ENCRYPTION_KEY',
            level: 'critical',
            message: 'encryption_key_too_short',
            suggestion: 'encryption_key_suggestion',
            deploy_by_worker: 'suggestion_deploy_by_worker',
            deploy_by_gitaction: 'suggestion_deploy_by_gitaction',
            deploy_by_docker: 'suggestion_deploy_by_docker'
        });
    } else {
        passedChecks.push('encryption_key_passed');
    }

    // 2. Check JWT_SECRET
    const jwtSecret = env.JWT_SECRET || '';
    if (!jwtSecret || jwtSecret.length < 32) {
        issues.push({
            field: 'JWT_SECRET',
            level: 'critical',
            message: 'jwt_secret_too_short',
            suggestion: 'jwt_secret_suggestion',
            deploy_by_worker: 'suggestion_deploy_by_worker',
            deploy_by_gitaction: 'suggestion_deploy_by_gitaction',
            deploy_by_docker: 'suggestion_deploy_by_docker'
        });
    } else {
        passedChecks.push('jwt_secret_passed');
    }

    // 3. Check OAUTH_ALLOW_ALL
    if (String(env.OAUTH_ALLOW_ALL).toLowerCase() === 'true' || env.OAUTH_ALLOW_ALL === '1') {
        issues.push({
            field: 'OAUTH_ALLOW_ALL',
            level: 'critical',
            message: 'oauth_allow_all_enabled',
            suggestion: 'oauth_allow_all_suggestion',
            deploy_by_worker: 'suggestion_deploy_by_worker',
            deploy_by_gitaction: 'suggestion_deploy_by_gitaction',
            deploy_by_docker: 'suggestion_deploy_by_docker'
        });
    } else {
        passedChecks.push('oauth_allow_all_passed');
    }

    // 4. Check OAUTH_ALLOWED_USERS
    const allowedUsers = env.OAUTH_ALLOWED_USERS || '';
    if (!allowedUsers || allowedUsers.trim().length === 0) {
        issues.push({
            field: 'OAUTH_ALLOWED_USERS',
            level: 'error',
            message: 'allowed_users_empty',
            suggestion: 'allowed_users_suggestion',
            deploy_by_worker: 'suggestion_deploy_by_worker',
            deploy_by_gitaction: 'suggestion_deploy_by_gitaction',
            deploy_by_docker: 'suggestion_deploy_by_docker'
        });
    } else {
        passedChecks.push('allowed_users_passed');
    }

    // 5. Check OAuth Providers Integrity
    let hasAtLeastOneProvider = false;
    const providerStatus: Record<string, 'passed' | 'missing' | 'none'> = {
        github: 'none', telegram: 'none', google: 'none', nodeloc: 'none', gitee: 'none', cloudflare: 'none'
    };

    // Github
    if (env.OAUTH_GITHUB_CLIENT_ID || env.OAUTH_GITHUB_CLIENT_SECRET || env.OAUTH_GITHUB_REDIRECT_URI) {
        const missing = [];
        if (!env.OAUTH_GITHUB_CLIENT_ID) missing.push('OAUTH_GITHUB_CLIENT_ID');
        if (!env.OAUTH_GITHUB_CLIENT_SECRET) missing.push('OAUTH_GITHUB_CLIENT_SECRET');
        if (!env.OAUTH_GITHUB_REDIRECT_URI) missing.push('OAUTH_GITHUB_REDIRECT_URI');

        if (missing.length > 0) {
            providerStatus.github = 'missing';
            issues.push({
                field: 'OAUTH_GITHUB',
                level: 'error',
                message: 'github_config_incomplete',
                suggestion: 'github_config_suggestion',
                deploy_by_worker: 'suggestion_deploy_by_worker',
                deploy_by_gitaction: 'suggestion_deploy_by_gitaction',
                deploy_by_docker: 'suggestion_deploy_by_docker',
                missingFields: missing
            });
        } else {
            hasAtLeastOneProvider = true;
            providerStatus.github = 'passed';
        }
    }

    // Telegram
    if (env.OAUTH_TELEGRAM_BOT_NAME || env.OAUTH_TELEGRAM_BOT_TOKEN || env.OAUTH_TELEGRAM_WEBHOOK_SECRET) {
        const missing = [];
        if (!env.OAUTH_TELEGRAM_BOT_NAME) missing.push('OAUTH_TELEGRAM_BOT_NAME');
        if (!env.OAUTH_TELEGRAM_BOT_TOKEN) missing.push('OAUTH_TELEGRAM_BOT_TOKEN');
        if (!env.OAUTH_TELEGRAM_WEBHOOK_SECRET) missing.push('OAUTH_TELEGRAM_WEBHOOK_SECRET');

        if (missing.length > 0) {
            providerStatus.telegram = 'missing';
            issues.push({
                field: 'OAUTH_TELEGRAM',
                level: 'error',
                message: 'telegram_config_incomplete',
                suggestion: 'telegram_config_suggestion',
                deploy_by_worker: 'suggestion_deploy_by_worker',
                deploy_by_gitaction: 'suggestion_deploy_by_gitaction',
                deploy_by_docker: 'suggestion_deploy_by_docker',
                missingFields: missing
            });
        } else {
            hasAtLeastOneProvider = true;
            providerStatus.telegram = 'passed';
        }
    }

    // Google
    if (env.OAUTH_GOOGLE_CLIENT_ID || env.OAUTH_GOOGLE_CLIENT_SECRET || env.OAUTH_GOOGLE_REDIRECT_URI) {
        const missing = [];
        if (!env.OAUTH_GOOGLE_CLIENT_ID) missing.push('OAUTH_GOOGLE_CLIENT_ID');
        if (!env.OAUTH_GOOGLE_CLIENT_SECRET) missing.push('OAUTH_GOOGLE_CLIENT_SECRET');
        if (!env.OAUTH_GOOGLE_REDIRECT_URI) missing.push('OAUTH_GOOGLE_REDIRECT_URI');

        if (missing.length > 0) {
            providerStatus.google = 'missing';
            issues.push({
                field: 'OAUTH_GOOGLE',
                level: 'error',
                message: 'google_config_incomplete',
                suggestion: 'google_config_suggestion',
                deploy_by_worker: 'suggestion_deploy_by_worker',
                deploy_by_gitaction: 'suggestion_deploy_by_gitaction',
                deploy_by_docker: 'suggestion_deploy_by_docker',
                missingFields: missing
            });
        } else {
            hasAtLeastOneProvider = true;
            providerStatus.google = 'passed';
        }
    }

    // NodeLoc
    if (env.OAUTH_NODELOC_CLIENT_ID || env.OAUTH_NODELOC_CLIENT_SECRET || env.OAUTH_NODELOC_REDIRECT_URI) {
        const missing = [];
        if (!env.OAUTH_NODELOC_CLIENT_ID) missing.push('OAUTH_NODELOC_CLIENT_ID');
        if (!env.OAUTH_NODELOC_CLIENT_SECRET) missing.push('OAUTH_NODELOC_CLIENT_SECRET');
        if (!env.OAUTH_NODELOC_REDIRECT_URI) missing.push('OAUTH_NODELOC_REDIRECT_URI');

        if (missing.length > 0) {
            providerStatus.nodeloc = 'missing';
            issues.push({
                field: 'OAUTH_NODELOC',
                level: 'error',
                message: 'nodeloc_config_incomplete',
                suggestion: 'nodeloc_config_suggestion',
                deploy_by_worker: 'suggestion_deploy_by_worker',
                deploy_by_gitaction: 'suggestion_deploy_by_gitaction',
                deploy_by_docker: 'suggestion_deploy_by_docker',
                missingFields: missing
            });
        } else {
            hasAtLeastOneProvider = true;
            providerStatus.nodeloc = 'passed';
        }
    }

    // Gitee
    if (env.OAUTH_GITEE_CLIENT_ID || env.OAUTH_GITEE_CLIENT_SECRET || env.OAUTH_GITEE_REDIRECT_URI) {
        const missing = [];
        if (!env.OAUTH_GITEE_CLIENT_ID) missing.push('OAUTH_GITEE_CLIENT_ID');
        if (!env.OAUTH_GITEE_CLIENT_SECRET) missing.push('OAUTH_GITEE_CLIENT_SECRET');
        if (!env.OAUTH_GITEE_REDIRECT_URI) missing.push('OAUTH_GITEE_REDIRECT_URI');

        if (missing.length > 0) {
            providerStatus.gitee = 'missing';
            issues.push({
                field: 'OAUTH_GITEE',
                level: 'error',
                message: 'gitee_config_incomplete',
                suggestion: 'gitee_config_suggestion',
                deploy_by_worker: 'suggestion_deploy_by_worker',
                deploy_by_gitaction: 'suggestion_deploy_by_gitaction',
                deploy_by_docker: 'suggestion_deploy_by_docker',
                missingFields: missing
            });
        } else {
            hasAtLeastOneProvider = true;
            providerStatus.gitee = 'passed';
        }
    }

    // Cloudflare Access
    if (env.OAUTH_CLOUDFLARE_CLIENT_ID || env.OAUTH_CLOUDFLARE_CLIENT_SECRET || env.OAUTH_CLOUDFLARE_ORG_DOMAIN || env.OAUTH_CLOUDFLARE_REDIRECT_URI) {
        const missing = [];
        if (!env.OAUTH_CLOUDFLARE_CLIENT_ID) missing.push('OAUTH_CLOUDFLARE_CLIENT_ID');
        if (!env.OAUTH_CLOUDFLARE_CLIENT_SECRET) missing.push('OAUTH_CLOUDFLARE_CLIENT_SECRET');
        if (!env.OAUTH_CLOUDFLARE_ORG_DOMAIN) missing.push('OAUTH_CLOUDFLARE_ORG_DOMAIN');
        if (!env.OAUTH_CLOUDFLARE_REDIRECT_URI) missing.push('OAUTH_CLOUDFLARE_REDIRECT_URI');

        if (missing.length > 0) {
            providerStatus.cloudflare = 'missing';
            issues.push({
                field: 'OAUTH_CLOUDFLARE',
                level: 'error',
                message: 'cloudflare_config_incomplete',
                suggestion: 'cloudflare_config_suggestion',
                deploy_by_worker: 'suggestion_deploy_by_worker',
                deploy_by_gitaction: 'suggestion_deploy_by_gitaction',
                deploy_by_docker: 'suggestion_deploy_by_docker',
                missingFields: missing
            });
        } else {
            hasAtLeastOneProvider = true;
            providerStatus.cloudflare = 'passed';
        }
    }

    // 6. Check if any provider exists
    if (!hasAtLeastOneProvider) {
        issues.push({
            field: 'NO_OAUTH_PROVIDER',
            level: 'error',
            message: 'no_provider_configured',
            suggestion: 'no_provider_suggestion',
            deploy_by_worker: 'suggestion_deploy_by_worker',
            deploy_by_gitaction: 'suggestion_deploy_by_gitaction',
            deploy_by_docker: 'suggestion_deploy_by_docker'
        });
    } else {
        passedChecks.push('oauth_provider_configured');
    }

    return {
        passed: issues.length === 0,
        status: issues.length === 0 ? 'pass' : 'fail',
        issues,
        passedChecks
    };
};
