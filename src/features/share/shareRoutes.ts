import { Hono } from 'hono';
import { EnvBindings } from '@/app/config';
import { authMiddleware } from '@/shared/middleware/auth';
import { createShareService } from '@/features/share/shareService';
import { getSharePublicHeaders, normalizePublicOrigin } from '@/features/share/shareSecurity';
import { shareRateLimit } from '@/shared/middleware/shareRateLimitMiddleware';
import { logger } from '@/shared/utils/logger';

const share = new Hono<{ Bindings: EnvBindings, Variables: { user: any } }>();

const getService = (c: any) => createShareService(c.env);

const getPublicOrigin = (c: any): string => {
    const configuredOrigin = c.env?.NODEAUTH_PUBLIC_ORIGIN;
    if (typeof configuredOrigin === 'string' && configuredOrigin.trim() !== '') {
        try {
            return normalizePublicOrigin(configuredOrigin);
        } catch (error) {
            logger.warn(`[Share] Ignoring invalid NODEAUTH_PUBLIC_ORIGIN: ${(error as Error).message}`);
        }
    }

    return new URL(c.req.url).origin;
};

const getOwnerIdentity = (c: any): { ownerId: string; ownerAliases: string[] } => {
    const user = c.get('user') || {};
    const ownerId = user.email || user.id;
    const ownerAliases = Array.from(new Set([ownerId, user.email, user.id, user.username]
        .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
        .map((value: string) => value.trim())));

    return { ownerId, ownerAliases };
};

share.post('/', authMiddleware, async (c) => {
    const { ownerId, ownerAliases } = getOwnerIdentity(c);
    const body = await c.req.json().catch(() => ({}));

    if (typeof body.vaultItemId !== 'string' || body.vaultItemId.trim() === '') {
        return c.json({ success: false, error: 'vaultItemId is required' }, 400);
    }

    const publicOrigin = getPublicOrigin(c);
    const service = getService(c);
    const ttlSeconds = Number.isFinite(body.ttlSeconds) ? body.ttlSeconds : undefined;
    const expiresAt = Number.isFinite(body.expiresAt) ? body.expiresAt : undefined;
    const share = await service.createShareForOwner({
        ownerId,
        ownerAliases,
        vaultItemId: body.vaultItemId,
        ttlSeconds,
        expiresAt,
        publicOrigin,
    });

    return c.json({ success: true, share });
});

share.get('/', authMiddleware, async (c) => {
    const { ownerId, ownerAliases } = getOwnerIdentity(c);
    const service = getService(c);
    const shares = await service.listSharesForOwner(ownerId, Date.now(), ownerAliases);

    return c.json({ success: true, shares });
});

share.post('/batch', authMiddleware, async (c) => {
    const { ownerId, ownerAliases } = getOwnerIdentity(c);
    const body = await c.req.json().catch(() => ({}));

    if (!Array.isArray(body.vaultItemIds) || body.vaultItemIds.length === 0 || body.vaultItemIds.some((id: unknown) => typeof id !== 'string' || id.trim() === '')) {
        return c.json({ success: false, error: 'vaultItemIds must be a non-empty array of strings' }, 400);
    }

    if (body.vaultItemIds.length > 50) {
        return c.json({ success: false, error: 'vaultItemIds cannot exceed 50' }, 400);
    }

    const publicOrigin = getPublicOrigin(c);
    const service = getService(c);
    const ttlSeconds = Number.isFinite(body.ttlSeconds) ? body.ttlSeconds : undefined;
    const expiresAt = Number.isFinite(body.expiresAt) ? body.expiresAt : undefined;
    const result = await service.createSharesForOwnerBatch({
        ownerId,
        ownerAliases,
        vaultItemIds: body.vaultItemIds,
        ttlSeconds,
        expiresAt,
        publicOrigin,
    });

    return c.json({ success: true, result });
});

share.get('/:id', authMiddleware, async (c) => {
    const { ownerId, ownerAliases } = getOwnerIdentity(c);
    const service = getService(c);
    const share = await service.getShareForOwner(ownerId, c.req.param('id'), Date.now(), ownerAliases);

    return c.json({ success: true, share });
});

share.delete('/:id', authMiddleware, async (c) => {
    const { ownerId, ownerAliases } = getOwnerIdentity(c);
    const service = getService(c);
    const share = await service.revokeShareForOwner(ownerId, c.req.param('id'), Date.now(), ownerAliases);

    return c.json({
        success: true,
        share,
        message: 'Share link revoked. Future access is blocked, but NodeAuth cannot retract credentials already viewed or copied.',
    });
});

share.post('/public/:token/access', shareRateLimit(), async (c) => {
    const token = c.req.param('token');
    const body = await c.req.json().catch(() => ({}));
    const accessCode = typeof body.accessCode === 'string' ? body.accessCode : undefined;
    const service = getService(c);
    const decision = await service.resolveShareAccess({
        token,
        accessCode,
        requestOrigin: new URL(c.req.url).origin,
    });

    for (const [name, value] of Object.entries(decision.publicHeaders || getSharePublicHeaders())) {
        c.header(name, value);
    }

    if (!decision.accessible) {
        return c.json({ success: false, message: 'share_inaccessible', data: null }, 404);
    }

    return c.json({ success: true, data: decision.itemView });
});

export default share;
