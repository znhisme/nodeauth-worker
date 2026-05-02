import { EnvBindings, AppError } from '@/app/config';
import { VaultRepository } from '@/shared/db/repositories/vaultRepository';
import { encryptField, decryptField, batchInsertVaultItems } from '@/shared/db/db';
import { encryptData, decryptData, generateDeviceKey } from '@/shared/utils/crypto';
import { maskSecret, unmaskSecret, deriveMaskingKey } from '@/shared/utils/masking';
import { parseOTPAuthURI, validateBase32Secret, buildOTPAuthURI, normalizeOtpAccount, bytesToBase32 } from '@/shared/utils/otp';
import { Buffer } from 'node:buffer';

export class VaultService {
    private repository: VaultRepository;
    private env: EnvBindings;
    private encryptionKey: string;

    constructor(env: EnvBindings, repository: VaultRepository) {
        this.env = env;
        this.repository = repository;

        if (!env.ENCRYPTION_KEY) {
            throw new AppError('missing_encryption_key', 500);
        }

        this.encryptionKey = env.ENCRYPTION_KEY;
    }

    private async wrapZeroKnowledgeSecret(userId: string, sseEncryptedSecret: string | null) {
        if (!sseEncryptedSecret) return sseEncryptedSecret;
        try {
            const plain = await decryptField(sseEncryptedSecret, this.encryptionKey) as string;
            const salt = await generateDeviceKey(userId, this.env.JWT_SECRET || '');
            const maskingKey = await deriveMaskingKey(salt);
            return await maskSecret(plain, maskingKey);
        } catch (e) {
            return sseEncryptedSecret;
        }
    }

    /**
     * 获取所有账户 (解密)
     */
    async getAllAccounts() {
        const items = await this.repository.findAll();
        return await Promise.all(items.map(async (item) => ({
            ...item,
            secret: item.secret ? await decryptField(item.secret, this.encryptionKey) : item.secret
        })));
    }

    /**
     * 获取分页和搜索条件后的所有账户 (解密)
     */
    async getAccountsPaginated(userId: string, page: number, limit: number, search: string, category: string = '') {
        const items = await this.repository.findPaginated(page, limit, search, category);
        const totalCount = await this.repository.count(search, category);
        const categoryStats = await this.repository.getCategoryStats();
        const trashCount = await this.repository.countDeleted();

        const decryptedItems = await Promise.all(items.map(async (item) => {
            const { createdBy: _c, updatedBy: _u, ...rest } = item as any;
            return {
                ...rest,
                secret: await this.wrapZeroKnowledgeSecret(userId, item.secret)
            };
        }));

        return {
            items: decryptedItems,
            totalCount,
            trashCount,
            totalPages: Math.ceil(totalCount / limit) || 1,
            categoryStats: categoryStats.map(s => ({
                category: s.category || '',
                count: s.count
            }))
        };
    }

    /**
     * 重新排序账户
     */
    async reorderAccounts(ids: string[]) {
        if (!ids || ids.length === 0) return;

        const maxSort = await this.repository.getMaxSortOrder();

        // 🔢 间距改为 1000：为分数索引预留充足的整数空间
        // 原间距为 1（连续整数），导致分数插入无空间可用
        // 新间距 1000：两个相邻卡片之间可支持 999 次分数插入，无需重新分配
        const baseOrder = Math.max(maxSort, ids.length * 1000) + ids.length * 1000;
        const updates = ids.map((id, index) => ({
            id,
            sortOrder: baseOrder - index * 1000  // 每个位置间距 1000
        }));

        await this.repository.updateSortOrders(updates);
    }

    /**
     * 分数索引：仅移动单个账号到指定排序值
     * 每次拖拽仅触发 1 次 DB UPDATE，替代全量重排
     */
    async moveSingleItem(id: string, sortOrder: number): Promise<void> {
        await this.repository.updateSingleSortOrder(id, sortOrder);
    }

    /**
     * 创建账户
     */
    // normalize a service+account pair for comparison
    private normalizeSignature(service: string, account: string) {
        return `${(service || '').toString().trim().toLowerCase()}:${(account || '').toString().trim().toLowerCase()}`;
    }

    async createAccount(userId: string, data: any) {
        // 1. 利用集中化工具进行归一化 (包含类型判定、参数纠正、清洗、secret 处理)
        const normalized = normalizeOtpAccount(data);
        const { service, account, algorithm, digits, period, type, counter, category } = normalized;
        let secret = normalized.secret;

        // 如果前台传来了 nodeauth: 脱敏包，则在入库前先解封装到内部明文态，再用服务器端主密钥落库（保证落库逻辑无损）
        if (secret && secret.startsWith('nodeauth:')) {
            const salt = await generateDeviceKey(userId, this.env.JWT_SECRET || '');
            const maskingKey = await deriveMaskingKey(salt);
            try {
                secret = await unmaskSecret(secret, maskingKey);
            } catch (e) {
                throw new AppError('invalid_secret_format', 400);
            }
        }

        // 2. 校验策略
        if (!service || !account || !secret) {
            throw new AppError('invalid_secret_format', 400);
        }

        // 非 Steam 类型强制要求标准 Base32 编码
        if (type !== 'steam' && !validateBase32Secret(secret)) {
            throw new AppError('invalid_secret_format', 400);
        }

        // duplicate check (case‑insensitive & trimmed) - 包含回收站中软删除的记录
        const existing = await this.repository.findByServiceAccountAny(service, account);

        if (existing) {
            // 如果已经被软删除（在回收站中），则执行恢复并覆盖最新数据
            if (existing.deletedAt !== null) {
                const encryptedSecret = await encryptField(secret, this.encryptionKey);
                const maxSort = await this.repository.getMaxSortOrder();

                await this.repository.update(existing.id as string, {
                    category: category || '',
                    secret: encryptedSecret,
                    algorithm,
                    type,
                    digits,
                    period,
                    counter,
                    sortOrder: maxSort + 1,
                    updatedAt: Date.now(),
                    deletedAt: null // Explicitly revive!
                } as any);

                // 取回最新的复活实体并直接返回
                return await this.repository.findById(existing.id as string);
            }
            // 否则是正常的活跃账号，报冲突
            throw new AppError('account_exists', 409);
        }

        const encryptedSecret = await encryptField(secret, this.encryptionKey);
        const maxSort = await this.repository.getMaxSortOrder();

        const created = await this.repository.create({
            id: crypto.randomUUID(),
            service,
            account,
            category: category || '',
            secret: encryptedSecret,
            algorithm,
            type,
            digits,
            period,
            counter,
            sortOrder: maxSort + 1,
            createdAt: Date.now(),
            createdBy: userId
        } as any);

        const { createdBy: _c, updatedBy: _u, ...restCreated } = created as any;
        return {
            ...restCreated,
            secret: await this.wrapZeroKnowledgeSecret(userId, encryptedSecret)
        };
    }

    /**
     * HOTP 原子递增并获取新验证码
     */
    async incrementCounter(id: string, expectedUpdatedAt?: number) {
        const item = await this.repository.findById(id);
        if (!item) throw new AppError('account_not_found', 404);

        if (item.type !== 'hotp') {
            throw new AppError('账号类型不支持手动递增', 400);
        }

        const currentCounter = item.counter || 0;
        const secret = await decryptField(item.secret, this.encryptionKey);
        if (!secret) throw new AppError('decrypt_failed', 500);

        // 1. 生成当前的验证码 (使用当前计数器)
        const { generate } = await import('@/shared/utils/otp');
        const code = await generate(secret, currentCounter, item.digits || 6, item.algorithm || 'SHA1', 'hotp');

        // 2. 递增数据库中的计数器
        const newCounter = currentCounter + 1;
        const updated = await this.repository.update(id, {
            counter: newCounter,
            updatedAt: Date.now()
        }, expectedUpdatedAt);

        if (!updated) {
            throw new AppError('conflict_detected', 409);
        }

        return {
            id,
            code,
            counter: newCounter
        };
    }

    async updateAccount(userId: string, id: string, data: any) {
        // 取出现有单项记录以检查类型和获取现有密钥
        const existing = await this.repository.findById(id);
        if (!existing) throw new AppError('account_not_found', 404);

        // 🛡️ 架构师注：混合现有数据进行归一化判定
        const normalized = normalizeOtpAccount({ ...existing, ...data });
        const { service: normService, account: normAccount, secret: newSecret, algorithm: normAlgo, digits: normDigits, period: normPeriod, type: normType, counter: normCounter, category: normCategory } = normalized;

        let encryptedSecret: string;
        if (data.secret !== undefined) {

            // 如果传来 nodeauth: 的密文，必须还原成物理明文后再查验格式
            let finalSecret = newSecret;
            if (finalSecret && finalSecret.startsWith('nodeauth:')) {
                const salt = await generateDeviceKey(userId, this.env.JWT_SECRET || '');
                const maskingKey = await deriveMaskingKey(salt);
                try {
                    finalSecret = await unmaskSecret(finalSecret, maskingKey);
                } catch (e) { }
            }

            if (!finalSecret || (normType !== 'steam' && !validateBase32Secret(finalSecret))) {
                throw new AppError('invalid_secret_format', 400);
            }
            encryptedSecret = await encryptField(finalSecret, this.encryptionKey);
        } else {
            encryptedSecret = existing.secret;
        }

        const updateFields: any = {
            service: normService,
            account: normAccount,
            secret: encryptedSecret,
            algorithm: normAlgo,
            type: normType,
            digits: normDigits,
            period: normPeriod,
            counter: normCounter,
            category: normCategory || '',
            updatedAt: Date.now()
        };

        const updated = await this.repository.update(id, updateFields, data.force ? undefined : data.updatedAt);

        if (!updated) {
            // Check if it's a 404 or a 409
            const item = await this.repository.findById(id);
            if (!item) {
                throw new AppError('account_not_found', 404);
            } else {
                // If item exists but update failed, it's a conflict
                throw new AppError('conflict_detected', 409);
            }
        }

        const { createdBy: _c, updatedBy: _u, ...restExisting } = existing as any;
        return {
            ...restExisting,
            ...updateFields,
            secret: await this.wrapZeroKnowledgeSecret(userId, encryptedSecret)
        };
    }

    /**
     * 删除账户 (支持冲突校验与强制删除)
     */
    async deleteAccount(id: string, expectedUpdatedAt?: number, force: boolean = false) {
        // 🛡️ 强制删除时跳过时间戳对比
        const success = await this.repository.delete(id, force ? undefined : expectedUpdatedAt);
        if (!success) {
            const item = await this.repository.findById(id);
            if (!item) {
                throw new AppError('account_not_found', 404);
            } else {
                throw new AppError('conflict_detected', 409);
            }
        }
    }

    async batchDeleteAccounts(ids: string[]) {
        if (!ids || ids.length === 0) throw new AppError('no_account_ids', 400);
        const count = await this.repository.batchDelete(ids);
        return { count };
    }

    /**
     * 导出前将密文完全还原为明文（SSE 解密 + 零知识解封装）
     */
    private async plainSecretForExport(userId: string, sseEncryptedSecret: string | null): Promise<string | null> {
        if (!sseEncryptedSecret) return null;
        try {
            const plain = await decryptField(sseEncryptedSecret, this.encryptionKey) as string;
            if (!plain) return null;
            if (plain.startsWith('nodeauth:')) {
                const salt = await generateDeviceKey(userId, this.env.JWT_SECRET || '');
                const maskingKey = await deriveMaskingKey(salt);
                return await unmaskSecret(plain, maskingKey);
            }
            return plain;
        } catch (e) {
            return null;
        }
    }

    /**
     * 处理导出
     */
    async exportAccounts(userId: string, type: string, password?: string) {
        const SECURITY_CONFIG = { MIN_EXPORT_PASSWORD_LENGTH: 5 };
        if (!['encrypted', 'json', '2fas', 'text'].includes(type)) {
            throw new AppError('export_type_invalid', 400);
        }

        if (type === 'encrypted') {
            if (!password || password.length < SECURITY_CONFIG.MIN_EXPORT_PASSWORD_LENGTH) {
                throw new AppError('export_password_length', 400);
            }
        }

        const rawItems = await this.getAllAccounts();
        const plainItems = await Promise.all(rawItems.map(async (item) => {
            const { createdBy: _c, updatedBy: _u, ...rest } = item as any;
            return {
                ...rest,
                secret: await this.plainSecretForExport(userId, item.secret as string)
            };
        }));

        const timestamp = new Date().toISOString();
        const baseData = { version: "2.0", app: "nodeauth", timestamp };

        if (type === 'encrypted') {
            const exportData = { ...baseData, encrypted: true, accounts: plainItems };
            // 注意：encryptData 已经在 shared/utils/crypto 引入
            const encryptedContent = await encryptData(exportData, password!);
            return {
                data: { ...baseData, encrypted: true, data: encryptedContent, note: "This file is encrypted with your export password. Keep it safe!" },
                isText: false
            };
        } else if (type === 'json') {
            return { data: { ...baseData, encrypted: false, accounts: plainItems }, isText: false };
        } else if (type === '2fas') {
            // 2FAS 导出格式：字段放在 otp 子对象中，尤其是 account/digits/period/algorithm
            const services = plainItems.map(acc => ({
                name: acc.service,
                secret: acc.secret,
                otp: {
                    tokenType: 'TOTP',
                    issuer: acc.service,
                    account: acc.account,
                    digits: acc.digits,
                    period: acc.period,
                    algorithm: (acc.algorithm || 'SHA1').replace('SHA-', 'SHA'),
                    counter: 0,
                },
                order: { position: 0 },
            }));
            return { data: { schemaVersion: 4, appOrigin: 'export', services }, isText: false };
        } else if (type === 'text') {
            const lines = plainItems.map(acc => {
                return buildOTPAuthURI({
                    service: acc.service,
                    account: acc.account,
                    secret: acc.secret ?? '',
                    algorithm: acc.algorithm ?? undefined,
                    digits: acc.digits ?? undefined,
                    period: acc.period ?? undefined
                });
            });
            return { data: lines.join('\n'), isText: true };
        }

        throw new AppError('export_type_invalid', 500);
    }

    /**
     * 处理导入
     */
    async importAccounts(userId: string, type: string, content: string, password?: string) {
        if (!content || !type) throw new AppError('missing_content_type', 400);

        if (type === 'encrypted' && !password) {
            throw new AppError('import_password_required', 400);
        }

        let rawAccounts: any[] = [];

        try {
            if (type === 'encrypted') {
                const encryptedFile = JSON.parse(content);
                const decryptedData = await decryptData(encryptedFile.data, password!);
                rawAccounts = decryptedData.accounts || [];
            } else if (type === 'json') {
                const data = JSON.parse(content);
                if (data.accounts) {
                    rawAccounts = data.accounts;
                } else if (Array.isArray(data.secrets)) {
                    rawAccounts = data.secrets.map((item: any) => ({
                        service: item.issuer || item.service || item.name || 'Unknown',
                        account: item.account || item.label || '',
                        secret: item.secret,
                        algorithm: item.algorithm || 'SHA1',
                        digits: item.digits || 6,
                        period: item.period || 30,
                    }));
                } else if (data.app && data.app.includes('nodeauth') && Array.isArray(data.data)) {
                    rawAccounts = data.data;
                } else if (Array.isArray(data)) {
                    rawAccounts = data;
                } else if (data.services) {
                    rawAccounts = data.services.map((s: any) => ({
                        service: s.otp?.issuer || s.name || s.service,
                        account: s.otp?.account || s.account || '',
                        secret: s.secret,
                        algorithm: s.otp?.algorithm || s.algorithm || 'SHA1',
                        digits: s.otp?.digits || s.digits || 6,
                        period: s.otp?.period || s.period || 30,
                    }));
                }
            } else if (type === '2fas') {
                const data = JSON.parse(content);
                if (Array.isArray(data.services)) {
                    rawAccounts = data.services.map((s: any) => ({
                        service: s.otp?.issuer || s.name || s.otp?.issuer || 'Unknown',
                        account: s.otp?.account || s.account || s.username || '',
                        secret: s.secret || '',
                        algorithm: (s.otp?.algorithm || s.algorithm || 'SHA1').toUpperCase(),
                        digits: s.otp?.digits || s.digits || 6,
                        period: s.otp?.period || s.period || 30,
                        category: s.group || s.category || '',
                    }));
                }
            } else if (type === 'text') {
                const lines = content.split('\n').filter((line: string) => line.trim());
                for (const line of lines) {
                    if (line.trim().startsWith('otpauth://')) {
                        const parsed = parseOTPAuthURI(line.trim());
                        if (parsed) rawAccounts.push({
                            service: parsed.issuer, account: parsed.account,
                            secret: parsed.secret, algorithm: parsed.algorithm,
                            digits: parsed.digits, period: parsed.period,
                            type: parsed.type, counter: parsed.counter
                        });
                    }
                }
            } else if (type === 'raw') {
                rawAccounts = JSON.parse(content);
            }
        } catch (e) {
            if (e instanceof AppError) throw e;
            throw new AppError('parse_failed', 400);
        }

        // 1. 获取现有数据以建立签名映射 (Signature -> Row)
        const allItems = await this.repository.findAllIncludeDeleted();
        const existingMap = new Map<string, any>(
            allItems.map((row: any) => [this.normalizeSignature(row.service, row.account), row])
        );

        const uniqueAccountsToInsert: any[] = []; // 全新数据
        const accountsToRevive: any[] = [];       // 需从回收站恢复的数据
        const seenInBatch = new Set<string>();

        let validCount = 0;
        let duplicateCount = 0;

        for (const raw of rawAccounts) {
            // 💡 利用归一化引擎先行处理，识别协议类型并清洗字段
            const acc = normalizeOtpAccount(raw);
            const { service, account, secret, type } = acc;

            // 针对协议类型实行分区校验策略
            const isValidSecret = type === 'steam' ? !!secret : validateBase32Secret(secret);

            if (service && account && isValidSecret) {
                const signature = this.normalizeSignature(service, account);

                // 批次内防重
                if (seenInBatch.has(signature)) continue;
                seenInBatch.add(signature);
                validCount++;

                const existingItem = existingMap.get(signature);

                if (!existingItem) {
                    // 情况 A：纯新增
                    uniqueAccountsToInsert.push(acc);
                } else if (existingItem.deletedAt !== null) {
                    // 情况 B：在回收站中，标记为复活
                    accountsToRevive.push({ ...acc, id: existingItem.id });
                } else {
                    // 情况 C：活跃重复，跳过
                    duplicateCount++;
                }
            }
        }

        let totalProcessedCount = 0;

        // 2. 处理全新插入
        if (uniqueAccountsToInsert.length > 0) {
            const startSort = await this.repository.getMaxSortOrder();
            const count = await batchInsertVaultItems(this.env.DB, uniqueAccountsToInsert, this.encryptionKey, userId, startSort);
            totalProcessedCount += count;
        }

        // 3. 处理回收站恢复 (显式各别处理，确保逻辑透明)
        if (accountsToRevive.length > 0) {
            const startSortForRevive = await this.repository.getMaxSortOrder();

            const preparedRevives = await Promise.all(accountsToRevive.map(async (acc, idx) => {
                const secretEncrypted = await encryptField(acc.secret, this.encryptionKey);

                return {
                    id: acc.id,
                    data: {
                        category: acc.category || '',
                        secret: secretEncrypted,
                        algorithm: acc.algorithm,
                        type: acc.type,
                        digits: acc.digits,
                        period: acc.period,
                        counter: acc.counter,
                        sortOrder: startSortForRevive + (accountsToRevive.length - idx),
                        deletedAt: null, // 👈 显式复活标记
                        updatedBy: userId
                    }
                };
            }));

            await this.repository.batchUpdate(preparedRevives);
            totalProcessedCount += accountsToRevive.length;
        }

        return {
            count: totalProcessedCount,
            duplicates: duplicateCount,
            pending: false
        };
    }

    /**
     * Blizzard/battle.net 账号还原
     * 利用现代 OAuth SSO 流程从暴雪 API 获取底层密钥
     */
    async restoreBlizzardNetAccount(serial: string, restoreCode: string, ssoToken?: string): Promise<string> {
        if (!serial || !serial.trim()) throw new AppError('blizzard_serial_required', 400);
        if (!restoreCode || !restoreCode.trim()) throw new AppError('blizzard_restore_code_required', 400);
        if (!ssoToken || !ssoToken.trim()) throw new AppError('blizzard_sso_token_required', 400);

        const normalizedSerial = serial.replace(/-/g, '').toUpperCase();
        const normalizedCode = restoreCode.toUpperCase().replace(/\s/g, '');

        try {
            const commonHeaders = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };

            // 1. ST 凭据换取 Access Token
            console.log('[BlizzardRestore] Exchanging ST for AccessToken...');
            const tokenRes = await fetch('https://oauth.battle.net/oauth/sso', {
                method: 'POST',
                headers: {
                    ...commonHeaders,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    client_id: 'baedda12fe054e4abdfc3ad7bdea970a',
                    grant_type: 'client_sso',
                    scope: 'auth.authenticator',
                    token: ssoToken.trim()
                }).toString()
            });

            if (!tokenRes.ok) {
                const errData = await tokenRes.text().catch(() => '{}');
                console.error('[BlizzardRestore] OAuth failed:', tokenRes.status, errData);
                throw new AppError(`blizzard_oauth_failed: ${tokenRes.status}`, 401);
            }
            const { access_token: accessToken } = await tokenRes.json() as any;

            // 2. 请求底层 Hex 密钥
            console.log('[BlizzardRestore] Requesting device secret...');
            const restoreRes = await fetch('https://authenticator-rest-api.bnet-identity.blizzard.net/v1/authenticator/device', {
                method: 'POST',
                headers: {
                    ...commonHeaders,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    serial: normalizedSerial,
                    restoreCode: normalizedCode
                })
            });

            if (!restoreRes.ok) {
                const errText = await restoreRes.text().catch(() => 'unknown');
                console.error('[BlizzardRestore] Device API failed:', restoreRes.status, errText);
                throw new AppError(`blizzard_restore_failed: ${restoreRes.status}`, 400);
            }

            const { deviceSecret } = await restoreRes.json() as any;
            if (!deviceSecret) throw new AppError('invalid_restore_response', 500);

            return bytesToBase32(new Uint8Array(Buffer.from(deviceSecret, 'hex')));

        } catch (err: any) {
            if (err instanceof AppError) throw err;
            console.error('[BlizzardRestore] Unexpected flow error:', err.message || err);
            // 将具体错误信息透出给前端，方便调试
            throw new AppError(`blizzard_service_error: ${err.message || 'unknown'}`, 502);
        }
    }

    /**
     * 批量同步离线操作 (Sync Mode)
     */
    async batchSync(userId: string, actions: any[]) {
        const results: any[] = [];

        // 遍历处理每一个动作，收集结果
        for (const action of actions) {
            const { type, id, data } = action;
            try {
                let res: any;
                switch (type) {
                    case 'create':
                        try {
                            res = await this.createAccount(userId, data);
                            results.push({ success: true, type, id: action.id, serverId: res.id });
                        } catch (e: any) {
                            if (e instanceof AppError && e.statusCode === 409) {
                                // 🛡️ 幂等同步 (Idempotent Sync):
                                // 如果发现账号已存在，查询该记录并返回其 serverId，视为同步成功
                                const existing = await this.repository.findByServiceAccountAny(data.service, data.account);
                                if (existing) {
                                    results.push({ success: true, type, id: action.id, serverId: existing.id });
                                } else {
                                    throw e;
                                }
                            } else {
                                throw e;
                            }
                        }
                        break;
                    case 'update':
                        try {
                            await this.updateAccount(userId, id, data);
                        } catch (e: any) {
                            if (e.statusCode === 409) {
                                // 🛡️ Idempotent Sync: Compare against current DB state
                                const existing = await this.repository.findById(id);
                                if (existing) {
                                    const sigServer = this.normalizeSignature(existing.service, existing.account);
                                    const sigClient = this.normalizeSignature(data.service, data.account);
                                    // 🛡️ 鲁棒对比：对齐 undefined/null 为空字符串
                                    const categoryServer = existing.category || '';
                                    const categoryClient = data.category || '';

                                    if (sigServer === sigClient && categoryServer === categoryClient) {
                                        // Still success if it's identical
                                    } else {
                                        throw e;
                                    }
                                } else {
                                    throw e;
                                }
                            } else {
                                throw e;
                            }
                        }
                        results.push({ success: true, type, id });
                        break;
                    case 'delete':
                        try {
                            await this.deleteAccount(id, data?.updatedAt, !!data?.force);
                        } catch (e: any) {
                            // 针对删除动作：如果账号本就不存在（可能被其他设备删了），保持幂等，视为成功
                            if (e instanceof AppError && e.statusCode === 404) {
                                // Ignore
                            } else {
                                throw e;
                            }
                        }
                        results.push({ success: true, type, id });
                        break;
                    case 'reorder':
                        if (data && Array.isArray(data.ids)) {
                            await this.reorderAccounts(data.ids);
                        }
                        results.push({ success: true, type, id });
                        break;
                    default:
                        results.push({ success: false, type, id, error: 'unknown_action' });
                }
            } catch (e: any) {
                // 🛡️ Preserve specific error codes: 409 conflict should NOT be masked as sync_error
                const errorCode = e.statusCode === 409 ? 'conflict_detected' : (e.code || 'sync_error');
                results.push({
                    success: false,
                    type,
                    id,
                    error: e.message,
                    code: errorCode
                });
            }
        }

        return results;
    }

}
