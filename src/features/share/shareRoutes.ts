import { Hono } from 'hono';
import { EnvBindings } from '@/app/config';
import { authMiddleware } from '@/shared/middleware/auth';
import { createShareService } from '@/features/share/shareService';
import { getSharePublicHeaders } from '@/features/share/shareSecurity';
import { shareRateLimit } from '@/shared/middleware/shareRateLimitMiddleware';

const share = new Hono<{ Bindings: EnvBindings, Variables: { user: any } }>();

const getService = (c: any) => createShareService(c.env);

share.post('/', authMiddleware, async (c) => {
    const user = c.get('user');
    const ownerId = user.email || user.id;
    const body = await c.req.json().catch(() => ({}));

    if (typeof body.vaultItemId !== 'string' || body.vaultItemId.trim() === '') {
        return c.json({ success: false, error: 'vaultItemId is required' }, 400);
    }

    const publicOrigin = c.env.NODEAUTH_PUBLIC_ORIGIN || new URL(c.req.url).origin;
    const service = getService(c);
    const share = await service.createShareForOwner({
        ownerId,
        vaultItemId: body.vaultItemId,
        ttlSeconds: typeof body.ttlSeconds === 'number' ? body.ttlSeconds : undefined,
        expiresAt: typeof body.expiresAt === 'number' ? body.expiresAt : undefined,
        publicOrigin,
    });

    return c.json({ success: true, share });
});

share.get('/', authMiddleware, async (c) => {
    const user = c.get('user');
    const ownerId = user.email || user.id;
    const service = getService(c);
    const shares = await service.listSharesForOwner(ownerId);

    return c.json({ success: true, shares });
});

share.get('/:id', authMiddleware, async (c) => {
    const user = c.get('user');
    const ownerId = user.email || user.id;
    const service = getService(c);
    const share = await service.getShareForOwner(ownerId, c.req.param('id'));

    return c.json({ success: true, share });
});

share.delete('/:id', authMiddleware, async (c) => {
    const user = c.get('user');
    const ownerId = user.email || user.id;
    const service = getService(c);
    const share = await service.revokeShareForOwner(ownerId, c.req.param('id'));

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
