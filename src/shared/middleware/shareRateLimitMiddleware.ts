import { Context, Next } from 'hono';
import { type EnvBindings } from '@/app/config';
import { ShareRepository } from '@/shared/db/repositories/shareRepository';
import {
    SHARE_RATE_LIMIT_LOCK_MS,
    SHARE_RATE_LIMIT_MAX_ATTEMPTS,
    SHARE_RATE_LIMIT_WINDOW_MS,
} from '@/features/share/shareTypes';
import { getSharePublicHeaders, getShareSecretPepper, hashShareSecret } from '@/features/share/shareSecurity';
import { logger } from '@/shared/utils/logger';

function createId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
}

function toMetadata(value: Record<string, unknown>): string {
    return JSON.stringify(value);
}

function returnShareInaccessible(c: Context<{ Bindings: EnvBindings }>) {
    for (const [name, value] of Object.entries(getSharePublicHeaders())) {
        c.header(name, value);
    }

    return c.json({ success: false, message: 'share_inaccessible', data: null }, 404);
}

function firstNonEmptyHeader(c: Context, name: string): string | null {
    const value = c.req.header(name)?.trim();
    return value || null;
}

export function resolveShareRateLimitClientIp(c: Context): string {
    const cloudflareIp = firstNonEmptyHeader(c, 'CF-Connecting-IP');
    if (cloudflareIp) {
        return cloudflareIp;
    }

    const forwardedFor = c.req.header('x-forwarded-for')
        ?.split(',')
        .map((value) => value.trim())
        .find(Boolean);
    if (forwardedFor) {
        return forwardedFor;
    }

    return firstNonEmptyHeader(c, 'x-real-ip')
        || firstNonEmptyHeader(c, 'x-nf-client-connection-ip')
        || firstNonEmptyHeader(c, 'client-ip')
        || 'unknown';
}

export const shareRateLimit = (options?: { keyBuilder?: (c: Context) => string }) => {
    return async (c: Context<{ Bindings: EnvBindings }>, next: Next) => {
        const db = c.env.DB;
        if (!db) {
            logger.warn('[ShareRateLimit] access blocked');
            return returnShareInaccessible(c);
        }

        try {
            const rawToken = c.req.param('token') || '';
            const pepper = getShareSecretPepper(c.env);
            const tokenHash = rawToken ? await hashShareSecret(pepper, 'share-token', rawToken) : 'missing-token';
            const key = options?.keyBuilder
                ? options.keyBuilder(c)
                : [
                    'share',
                    resolveShareRateLimitClientIp(c),
                    'share-public-access',
                    tokenHash,
                ].filter(Boolean).join(':');
            const repository = new ShareRepository(db);
            const decision = await repository.enforceRateLimit({
                key,
                shareId: tokenHash,
                windowMs: SHARE_RATE_LIMIT_WINDOW_MS,
                maxAttempts: SHARE_RATE_LIMIT_MAX_ATTEMPTS,
                lockMs: SHARE_RATE_LIMIT_LOCK_MS,
            });

            if (!decision.allowed) {
                const share = await repository.findByTokenHash(tokenHash);
                if (share) {
                    await repository.insertAuditEvent({
                        id: createId('share-audit'),
                        shareId: share.id,
                        eventType: 'access_denied_threshold',
                        actorType: 'recipient',
                        eventAt: Date.now(),
                        ownerId: share.ownerId,
                        ipHash: null,
                        userAgentHash: null,
                        metadata: toMetadata({
                            attempts: decision.attempts,
                            lockedUntil: decision.lockedUntil ?? null,
                            windowMs: SHARE_RATE_LIMIT_WINDOW_MS,
                        }),
                    });
                }
                logger.warn('[ShareRateLimit] access blocked');
                return returnShareInaccessible(c);
            }
        } catch {
            logger.warn('[ShareRateLimit] access blocked');
            return returnShareInaccessible(c);
        }

        await next();
    };
};
