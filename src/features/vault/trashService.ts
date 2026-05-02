import { EnvBindings, AppError } from '@/app/config';
import { VaultRepository } from '@/shared/db/repositories/vaultRepository';
import { decryptField } from '@/shared/db/db';

export class TrashService {
    private repository: VaultRepository;
    private env: EnvBindings;
    private encryptionKey: string;

    constructor(env: EnvBindings, repository: VaultRepository) {
        this.env = env;
        this.repository = repository;
        this.encryptionKey = env?.ENCRYPTION_KEY || ''; // In tests it might be empty
    }

    /**
     * TRASH: 1.1 精准软瘫痪 - 将账号移入回收站
     */
    async moveToTrash(id: string) {
        const existing = await this.repository.findById(id);
        if (!existing) throw new AppError('Item not found', 404);

        // 如果已经是删除状态，直接幂等返回 (2.1)
        if (existing.deletedAt !== null) {
            return { success: true };
        }

        await this.repository.update(id, { deletedAt: Date.now() });
        return { success: true };
    }

    /**
     * TRASH: 1.4 回收站独立拉取
     */
    async getTrashList() {
        const items = await this.repository.findDeleted();
        // 同样对其进行解密以便客户端可以查看基本参数，或者也可不解密以保性能，
        // 但为了兼容现有的渲染引擎数据结构，最好将 secret 填入，供客户端自主拦截。
        return Promise.all(items.map(async (item) => ({
            ...item,
            secret: this.encryptionKey ? await decryptField(item.secret, this.encryptionKey) || '' : ''
        })));
    }

    /**
     * TRASH: 1.6 & 1.7 强制沉淀置顶恢复 (Restore Strategy B)
     */
    async restoreItem(id: string) {
        const existing = await this.repository.findById(id);
        if (!existing) throw new AppError('Item not found', 404);

        // 2.2 非法招魂：如果原本就在主库，不增加 sort_order
        if (existing.deletedAt === null) {
            return { success: true };
        }

        const maxSortOrder = await this.repository.getMaxSortOrder();

        // 2.7 溢出保护
        const SAFE_MAX = Number.MAX_SAFE_INTEGER - 2000;
        let nextSortOrder = maxSortOrder + 1000;
        if (nextSortOrder > SAFE_MAX) {
            nextSortOrder = SAFE_MAX; // 封顶防御
        }

        await this.repository.update(id, {
            deletedAt: null,
            sortOrder: nextSortOrder
        });

        return { success: true };
    }

    /**
     * TRASH: 1.9 批量软删除
     */
    async batchMoveToTrash(ids: string[]) {
        if (!ids || ids.length === 0) return { count: 0 };
        const count = await this.repository.batchSoftDelete(ids, Date.now());
        return { success: true, count };
    }

    /**
     * TRASH: 1.10 越权防御与物理硬删除
     */
    async hardDelete(id: string) {
        const res = await this.repository.delete(id);
        if (!res) throw new AppError('Item not found', 404); // 2.3 越权防御
        return { success: true };
    }

    /**
     * TRASH: 1.11 一键清空回收站
     */
    async emptyTrash() {
        const deletedCount = await this.repository.emptyTrashPhysical();
        return { success: true, deletedCount };
    }

    /**
     * TRASH: 2.6 时钟窜改防卫
     */
    async validateAndDelete(id: string, clientTimestamp: number) {
        const now = Date.now();
        // 如果给未来的时间或者负数 (2.6)，强制规整为当前服务器时间
        let deletedAt = clientTimestamp;
        if (clientTimestamp < 0 || clientTimestamp > now + 300000) {
            deletedAt = now;
        }
        await this.repository.update(id, { deletedAt });
        return { success: true };
    }
}
