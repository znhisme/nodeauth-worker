import { Hono } from 'hono';
import { EnvBindings } from '@/app/config';
import { authMiddleware } from '@/shared/middleware/auth';
import { rateLimit } from '@/shared/middleware/rateLimitMiddleware';
import { VaultService } from '@/features/vault/vaultService';
import { TrashService } from '@/features/vault/trashService';
import { VaultRepository } from '@/shared/db/repositories/vaultRepository';
import { parseOTPAuthURI } from '@/shared/utils/otp';
// No createDb required here as DB is instantiated at the root (worker.ts/server.ts) and passed via c.env

const vault = new Hono<{ Bindings: EnvBindings, Variables: { user: any } }>();

// 在路由中使用单例/工厂
const getService = (c: any) => {
    const repo = new VaultRepository(c.env.DB);
    return new VaultService(c.env, repo);
};

const getTrashService = (c: any) => {
    const repo = new VaultRepository(c.env.DB);
    return new TrashService(c.env, repo);
};

vault.use('/*', authMiddleware);

// 获取所有账户 (分页+搜索)
vault.get('/', async (c) => {
    // 解析查询参数
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '12', 10);
    const search = c.req.query('search') || '';
    const category = c.req.query('category') || '';

    const user = c.get('user');
    const service = getService(c);
    const result = await service.getAccountsPaginated(user.email || user.id, page, limit, search, category);

    return c.json({
        success: true,
        vault: result.items,
        categoryStats: result.categoryStats,
        trashCount: result.trashCount,
        pagination: {
            page,
            limit,
            totalItems: result.totalCount,
            totalPages: result.totalPages
        }
    });
});

// 重新排序（全量，兼容老逻辑 & 在空间耗尽时的重新分配）
vault.post('/reorder', async (c) => {
    const { ids } = await c.req.json();
    if (!Array.isArray(ids)) {
        return c.json({ success: false, error: 'ids must be an array' }, 400);
    }
    const service = getService(c);
    await service.reorderAccounts(ids);
    return c.json({ success: true });
});

// 🆕 分数索引：仅更新单个账号排序值 (每次拖拽仅 1 次 DB 写入)
vault.patch('/:id/sort-order', async (c) => {
    const id = c.req.param('id');
    const { sortOrder } = await c.req.json();
    if (typeof sortOrder !== 'number') {
        return c.json({ success: false, error: 'sortOrder must be a number' }, 400);
    }
    const service = getService(c);
    await service.moveSingleItem(id, sortOrder);
    return c.json({ success: true });
});

// ===== 回收站 (Trash) API Endpoints =====

vault.get('/trash', async (c) => {
    const trashService = getTrashService(c);
    const vault = await trashService.getTrashList();
    return c.json({ success: true, vault });
});

vault.post('/:id/trash_move', async (c) => {
    const id = c.req.param('id');
    const trashService = getTrashService(c);
    const result = await trashService.moveToTrash(id);
    return c.json(result);
});

vault.post('/:id/trash_restore', async (c) => {
    const id = c.req.param('id');
    const trashService = getTrashService(c);
    const result = await trashService.restoreItem(id);
    return c.json(result);
});

vault.post('/trash_batch_move', async (c) => {
    const { ids } = await c.req.json();
    const trashService = getTrashService(c);
    const result = await trashService.batchMoveToTrash(ids || []);
    return c.json(result);
});

vault.delete('/:id/trash_hard', async (c) => {
    const id = c.req.param('id');
    const trashService = getTrashService(c);
    const result = await trashService.hardDelete(id);
    return c.json(result);
});

vault.delete('/trash_empty', async (c) => {
    const trashService = getTrashService(c);
    const result = await trashService.emptyTrash();
    return c.json(result);
});

// ===== 结束回收站 =====

// 添加新账户
vault.post('/', async (c) => {
    const user = c.get('user');
    const data = await c.req.json();
    const service = getService(c);
    const item = await service.createAccount(user.email || user.id, data);
    return c.json({ success: true, item });
});

// 更新账户
vault.put('/:id', async (c) => {
    const id = c.req.param('id');
    const data = await c.req.json();
    const user = c.get('user');
    const service = getService(c);
    const item = await service.updateAccount(user.email || user.id, id, data);
    return c.json({ success: true, item });
});

// 删除账户
vault.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const service = getService(c);
    await service.deleteAccount(id);
    return c.json({ success: true, message: 'Deleted successfully' });
});

// HOTP 原子递增接口
vault.patch('/:id/increment', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const service = getService(c);
    try {
        const result = await service.incrementCounter(id, body.updatedAt);
        return c.json({ success: true, ...result });
    } catch (e: any) {
        return c.json({ success: false, error: e.message }, e.statusCode || 500);
    }
});

// 批量删除账户
vault.post('/batch-delete', async (c) => {
    const { ids } = await c.req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
        return c.json({ success: false, error: 'ids must be a non-empty array' }, 400);
    }
    const service = getService(c);
    const result = await service.batchDeleteAccounts(ids);
    return c.json({ success: true, count: result.count });
});

// 导出账户
vault.post('/export', rateLimit({
    windowMs: 60 * 1000,
    max: 5,
}), async (c) => {
    const user = c.get('user');
    const service = getService(c);
    const { type, password } = await c.req.json();

    const result = await service.exportAccounts(user.email || user.id, type, password);
    if (result.isText) {
        return c.text(result.data as string);
    }
    return c.json(result.data);
});

// 导入账户
vault.post('/import', rateLimit({
    windowMs: 60 * 1000,
    max: 5,
}), async (c) => {
    const user = c.get('user');
    const service = getService(c);
    const { content, type, password } = await c.req.json();

    const result = await service.importAccounts(user.email || user.id, type, content, password);
    return c.json({ success: true, ...result });
});

// Blizzard 秘钥还原接口
vault.post('/import/blizzard-net', rateLimit({
    windowMs: 60 * 1000,
    max: 5,
}), async (c) => {
    const { serial, restoreCode, ssoToken } = await c.req.json();
    if (!serial || !restoreCode) {
        return c.json({ success: false, error: 'serial_and_restore_code_required' }, 400);
    }
    const service = getService(c);
    try {
        const secret = await service.restoreBlizzardNetAccount(serial, restoreCode, ssoToken);
        return c.json({ success: true, secret });
    } catch (e: any) {
        return c.json({ success: false, error: e.message }, e.statusCode || 500);
    }
});

// 从 otpauth:// URI 添加账户 (扫码流程使用)
vault.post('/add-from-uri', async (c) => {
    const user = c.get('user');
    const { uri, category } = await c.req.json();

    if (!uri || typeof uri !== 'string') {
        return c.json({ success: false, error: 'URI is required' }, 400);
    }

    const parsed = parseOTPAuthURI(uri);

    if (!parsed) {
        return c.json({ success: false, error: '无效的 OTP URI 格式' }, 400);
    }

    const service = getService(c);
    const item = await service.createAccount(user.email || user.id, {
        service: parsed.issuer,
        account: parsed.account,
        secret: parsed.secret,
        algorithm: parsed.algorithm,
        digits: parsed.digits,
        period: parsed.period,
        type: parsed.type,
        counter: parsed.counter,
        category: category || '手机扫码',
    });

    return c.json({ success: true, item });
});


// Removed Trash block because it's moved above

// 批量同步离线操作
vault.post('/sync', async (c) => {
    const user = c.get('user');
    const { actions } = await c.req.json();

    if (!Array.isArray(actions)) {
        return c.json({ success: false, error: 'actions must be an array' }, 400);
    }

    const service = getService(c);
    const results = await service.batchSync(user.email || user.id, actions);

    return c.json({ success: true, results });
});


// 弃用的迁移接口
vault.post('/migrate-crypto', async (c) => {
    return c.json({ success: true, message: '不再支持旧版盐值迁移逻辑，所有数据默认已使用新版逻辑', migrated: 0, remaining: 0 });
});

export default vault;