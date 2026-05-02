import { Context, Next } from 'hono';
import { AppError, type EnvBindings } from '@/app/config';
import { ShareRepository } from '@/shared/db/repositories/shareRepository';
import {
    SHARE_RATE_LIMIT_LOCK_MS,
    SHARE_RATE_LIMIT_MAX_ATTEMPTS,
    SHARE_RATE_LIMIT_WINDOW_MS,
} from '@/features/share/shareTypes';
import { getShareSecretPepper, hashShareSecret } from '@/features/share/shareSecurity';
import { logger } from '@/shared/utils/logger';

export const shareRateLimit = (options?: { keyBuilder?: (c: Context) => string }) => {
    return async (c: Context<{ Bindings: EnvBindings }>, next: Next) => {
        const db = c.env.DB;
        if (!db) {
            logger.warn('[ShareRateLimit] access blocked');
            throw new AppError('share_inaccessible', 404);
        }

        try {
            const rawToken = c.req.param('token') || '';
            const pepper = getShareSecretPepper(c.env);
            const tokenHash = rawToken ? await hashShareSecret(pepper, 'share-token', rawToken) : 'missing-token';
            const key = options?.keyBuilder
                ? options.keyBuilder(c)
                : [
                    'share',
                    c.req.header('CF-Connecting-IP') || 'unknown',
                    c.req.path,
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
                logger.warn('[ShareRateLimit] access blocked');
                throw new AppError('share_inaccessible', 404);
            }
        } catch {
            logger.warn('[ShareRateLimit] access blocked');
            throw new AppError('share_inaccessible', 404);
        }

        await next();
    };
};
