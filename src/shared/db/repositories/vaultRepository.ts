import { and, desc, eq, inArray, isNull, like, or, sql } from 'drizzle-orm';
import { vault, type VaultItem, type NewVaultItem } from '@/shared/db/schema/index';

export class VaultRepository {
    private db: any;

    constructor(dbClient: any) {
        this.db = dbClient;
    }

    /**
     * 获取所有的 vault items (仅查未删除)
     */
    async findAll(): Promise<VaultItem[]> {
        return await this.db
            .select()
            .from(vault)
            .where(isNull(vault.deletedAt))
            .orderBy(desc(vault.sortOrder), desc(vault.createdAt));
    }

    /**
     * 获取所有的 vault items (包含软删除/回收站数据)
     * 专用于去重检查场景，防止将回收站账号重新导入
     */
    async findAllIncludeDeleted(): Promise<VaultItem[]> {
        return await this.db
            .select()
            .from(vault)
            .orderBy(desc(vault.sortOrder), desc(vault.createdAt));
    }

    /**
     * 获取当前最大排序值
     */
    async getMaxSortOrder(): Promise<number> {
        const result = await this.db
            .select({ maxSort: sql<number>`max(${vault.sortOrder})` })
            .from(vault)
            .where(isNull(vault.deletedAt));
        return result[0]?.maxSort || 0;
    }

    /**
     * 分页查询
     */
    async findPaginated(page: number, limit: number, search: string = '', category: string = ''): Promise<VaultItem[]> {
        let query = this.db.select().from(vault);

        const conditions = [];
        if (search) {
            conditions.push(or(
                like(vault.service, `%${search}%`),
                like(vault.account, `%${search}%`),
                like(vault.category, `%${search}%`)
            ));
        }
        if (category) {
            if (category === '____UNCATEGORIZED____') {
                conditions.push(or(eq(vault.category, ''), isNull(vault.category)));
            } else {
                conditions.push(eq(vault.category, category));
            }
        }

        conditions.push(isNull(vault.deletedAt));

        if (conditions.length > 0) {
            query = query.where(and(...conditions as any));
        }

        return await query
            .limit(limit)
            .offset((page - 1) * limit)
            .orderBy(desc(vault.sortOrder), desc(vault.createdAt));
    }

    /**
     * 获取分类统计
     */
    async getCategoryStats(): Promise<{ category: string, count: number }[]> {
        return await this.db
            .select({
                category: vault.category,
                count: sql<number>`count(*)`
            })
            .from(vault)
            .where(isNull(vault.deletedAt))
            .groupBy(vault.category);
    }

    /**
     * 批量更新排序 (高性能版 - CASE WHEN 批量 SQL)
     *
     * 旧实现：N 次串行 UPDATE，每次一个 DB 往返 → 8474 条记录需要 30+ 秒
     * 新实现：每批 30 条合并为 1 条 CASE WHEN SQL → 减少频繁网络开销，同时规避上限 
     * 
     * 分批原因：虽然 SQLite 默认参数上限为 999 个，但 **Cloudflare D1 硬性限制每条执行语句最多只能有 100 个绑定参数**！
     *   每条记录在此 CASE WHEN 结构中占用 3 个参数 (WHEN id / THEN sortOrder / WHERE IN id)
     *   33 乘以 3 = 99，所以安全分批大小最大为 33，此处使用 30 留有余量。
     */
    async updateSortOrders(updates: { id: string, sortOrder: number }[]): Promise<void> {
        if (!updates || updates.length === 0) return;

        const CHUNK_SIZE = 30;

        for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
            const chunk = updates.slice(i, i + CHUNK_SIZE);

            if (chunk.length === 1) {
                // 单条记录直接走普通 UPDATE，避免 CASE WHEN 开销
                await this.db
                    .update(vault)
                    .set({ sortOrder: chunk[0].sortOrder })
                    .where(eq(vault.id, chunk[0].id));
                continue;
            }

            // 多条记录：合并为单条 CASE WHEN UPDATE
            // 生成: CASE id WHEN 'id1' THEN val1 WHEN 'id2' THEN val2 ... ELSE sort_order END
            const whenClauses = chunk.map(u => sql`WHEN ${u.id} THEN ${u.sortOrder}`);
            const caseExpr = sql`CASE ${vault.id} ${sql.join(whenClauses, sql` `)} ELSE ${vault.sortOrder} END`;

            await this.db
                .update(vault)
                .set({ sortOrder: caseExpr })
                .where(inArray(vault.id, chunk.map(u => u.id)));
        }
    }

    /**
     * 分数索引：仅更新单个账号的排序值
     * 配合前端分数索引算法，每次拖拽仅触发 1 次 DB UPDATE
     */
    async updateSingleSortOrder(id: string, sortOrder: number): Promise<void> {
        await this.db
            .update(vault)
            .set({ sortOrder })
            .where(eq(vault.id, id));
    }

    /**
     * 获取满足条件的总记录数，用于分页计算
     */
    async count(search: string, category: string = ''): Promise<number> {
        let query = this.db
            .select({ count: sql<number>`count(*)` })
            .from(vault);

        const conditions = [];
        if (search) {
            conditions.push(or(
                like(vault.service, `%${search}%`),
                like(vault.account, `%${search}%`),
                like(vault.category, `%${search}%`)
            ));
        }
        if (category) {
            if (category === '____UNCATEGORIZED____') {
                conditions.push(or(eq(vault.category, ''), isNull(vault.category)));
            } else {
                conditions.push(eq(vault.category, category));
            }
        }

        conditions.push(isNull(vault.deletedAt));

        if (conditions.length > 0) {
            query = query.where(and(...conditions as any));
        }

        const result = await query;
        return result[0]?.count || 0;
    }

    /**
     * 根据 ID 获取单个 item
     */
    async findById(id: string): Promise<VaultItem | undefined> {
        const result = await this.db
            .select()
            .from(vault)
            .where(eq(vault.id, id))
            .limit(1);

        return result[0];
    }

    /**
     * 根据 service/account 查找记录 (大小写不敏感，自动 trim)
     * 只匹配未被软删除的记录
     */
    async findByServiceAccount(service: string, account: string): Promise<VaultItem | undefined> {
        const normalizedService = service.trim().toLowerCase();
        const normalizedAccount = account.trim().toLowerCase();
        const result = await this.db
            .select()
            .from(vault)
            .where(
                and(
                    sql`lower(${vault.service}) = ${normalizedService}`,
                    sql`lower(${vault.account}) = ${normalizedAccount}`,
                    isNull(vault.deletedAt)
                )
            )
            .limit(1);
        return result[0];
    }

    /**
     * 根据 service/account 查找记录 (包含过回收站的软删除记录)
     * 专用于去重检查，防止添加回收站中尚存在的账号
     */
    async findByServiceAccountAny(service: string, account: string): Promise<VaultItem | undefined> {
        const normalizedService = service.trim().toLowerCase();
        const normalizedAccount = account.trim().toLowerCase();
        const result = await this.db
            .select()
            .from(vault)
            .where(
                and(
                    sql`lower(${vault.service}) = ${normalizedService}`,
                    sql`lower(${vault.account}) = ${normalizedAccount}`
                    // 注意：此处故意不加 isNull(vault.deletedAt)，覆盖回收站内已删除的记录
                )
            )
            .limit(1);
        return result[0];
    }

    /**
     * 创建一个新 item
     */
    async create(item: NewVaultItem): Promise<VaultItem> {
        await this.db.insert(vault).values(item);
        const result = await this.findById(item.id as string);
        return result as VaultItem;
    }

    /**
     * 批量创建
     */
    async batchCreate(items: NewVaultItem[]): Promise<void> {
        if (!items || items.length === 0) return;

        const BATCH_SIZE = 50;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const chunk = items.slice(i, i + BATCH_SIZE);
            await this.db.insert(vault).values(chunk);
        }
    }

    /**
     * 更新一个 item (支持乐观锁校验)
     */
    async update(id: string, data: Partial<NewVaultItem>, expectedUpdatedAt?: number): Promise<VaultItem | undefined> {
        const existing = await this.findById(id);
        if (!existing) return undefined;

        // 如果提供了期望的时间戳，且与数据库中不匹配，则拒绝更新 (版本冲突)
        if (expectedUpdatedAt !== undefined && existing.updatedAt !== expectedUpdatedAt) {
            return undefined;
        }

        await this.db
            .update(vault)
            .set({ ...data, updatedAt: Date.now() })
            .where(eq(vault.id, id));

        return await this.findById(id);
    }

    /**
     * 批量更新 (用于导入复活场景等)
     */
    async batchUpdate(updates: Array<{ id: string, data: Partial<NewVaultItem> }>): Promise<void> {
        if (!updates || updates.length === 0) return;

        // D1 支持批量执行以减少网络往返
        if ((this.db as any).batch) {
            const BATCH_SIZE = 50;
            for (let i = 0; i < updates.length; i += BATCH_SIZE) {
                const chunk = updates.slice(i, i + BATCH_SIZE);
                const stmts = chunk.map(u =>
                    this.db.update(vault)
                        .set({ ...u.data, updatedAt: Date.now() })
                        .where(eq(vault.id, u.id))
                );
                await (this.db as any).batch(stmts);
            }
        } else {
            // 常规循环 (兼容模式)
            for (const u of updates) {
                await this.update(u.id, u.data);
            }
        }
    }

    /**
     * 删除单个 item (支持乐观锁校验)
     */
    async delete(id: string, expectedUpdatedAt?: number): Promise<boolean> {
        const existing = await this.findById(id);
        if (!existing) return false;

        if (expectedUpdatedAt !== undefined && existing.updatedAt !== expectedUpdatedAt) {
            // 抛出特定的错误或返回 false 表示冲突
            return false;
        }

        await this.db.delete(vault).where(eq(vault.id, id));
        return true;
    }

    /**
     * 批量删除
     */
    async batchDelete(ids: string[]): Promise<number> {
        if (!ids || ids.length === 0) return 0;

        let deletedCount = 0;
        const BATCH_SIZE = 50;
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
            const chunk = ids.slice(i, i + BATCH_SIZE);
            await this.db.delete(vault).where(inArray(vault.id, chunk));
            deletedCount += chunk.length;
        }
        return deletedCount;
    }

    /**
     * TRASH: 获取所有软删除账号
     */
    async findDeleted(): Promise<VaultItem[]> {
        return await this.db
            .select()
            .from(vault)
            .where(sql`${vault.deletedAt} IS NOT NULL`)
            .orderBy(desc(vault.deletedAt));
    }

    /**
     * TRASH: 批量软删除
     */
    async batchSoftDelete(ids: string[], timestamp: number): Promise<number> {
        if (!ids || ids.length === 0) return 0;

        let count = 0;
        const BATCH = 50;
        for (let i = 0; i < ids.length; i += BATCH) {
            const chunk = ids.slice(i, i + BATCH);
            await this.db.update(vault)
                .set({ deletedAt: timestamp, sortOrder: 0 })
                .where(inArray(vault.id, chunk));
            count += chunk.length;
        }
        return count;
    }

    /**
     * TRASH: 清空回收站
     */
    async emptyTrashPhysical(): Promise<number> {
        await this.db.delete(vault).where(sql`${vault.deletedAt} IS NOT NULL`);
        return 1;
    }

    /**
     * TRASH: 统计软删除的数量
     */
    async countDeleted(): Promise<number> {
        const result = await this.db
            .select({ count: sql<number>`count(*)` })
            .from(vault)
            .where(sql`${vault.deletedAt} IS NOT NULL`);
        return result[0]?.count || 0;
    }
}
