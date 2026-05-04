import { logger } from '@/shared/utils/logger';
import { DbExecutor } from '@/shared/db/executor';
import { transformSqlForDialect } from '@/shared/db/dialects';

/**
 * 基础建表语句（与 schema.sql 保持同步）
 * 使用 CREATE TABLE IF NOT EXISTS，幂等安全，可在任意环境下自动初始化。
 * 这使得通过 Cloudflare 面板直接部署（跳过 GitHub Actions schema.sql 步骤）
 * 时，系统也能在首次收到请求时自动建立所需的数据表。
 */
const BASE_SCHEMA: string[] = [
    // 账号表：存储 2FA 凭据
    `CREATE TABLE IF NOT EXISTS vault (
        id TEXT PRIMARY KEY,
        service TEXT NOT NULL,
        account TEXT NOT NULL,
        category TEXT,
        secret TEXT NOT NULL,
        digits INTEGER DEFAULT 6,
        period INTEGER DEFAULT 30,
        type TEXT DEFAULT 'totp',
        algorithm TEXT DEFAULT 'SHA1',
        counter INTEGER DEFAULT 0,
        created_at INTEGER,
        created_by TEXT,
        updated_at INTEGER,
        updated_by TEXT,
        sort_order INTEGER DEFAULT 0,
        deleted_at INTEGER
    )`,
    // 云端备份源配置表
    `CREATE TABLE IF NOT EXISTS backup_providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        is_enabled BOOLEAN DEFAULT 1,
        config TEXT NOT NULL,
        auto_backup BOOLEAN DEFAULT 0,
        auto_backup_password TEXT,
        auto_backup_retain INTEGER DEFAULT 30,
        last_backup_at INTEGER,
        last_backup_status TEXT,
        created_at INTEGER,
        updated_at INTEGER
    )`,
    // Telegram 备份历史记录表
    `CREATE TABLE IF NOT EXISTS backup_telegram_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        file_id TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        size INTEGER NOT NULL,
        created_at INTEGER NOT NULL
    )`,
    // Email 备份历史记录表
    `CREATE TABLE IF NOT EXISTS backup_email_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        recipient TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at INTEGER NOT NULL
    )`,
    // Passkey 凭证表
    `CREATE TABLE IF NOT EXISTS auth_passkeys (
        credential_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        public_key BLOB NOT NULL,
        counter INTEGER DEFAULT 0,
        name TEXT,
        transports TEXT,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER
    )`,
    // 速率限制表
    `CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        attempts INTEGER DEFAULT 0,
        last_attempt INTEGER,
        expires_at INTEGER
    )`,
    // Share link tables
    `CREATE TABLE IF NOT EXISTS share_links (
        id TEXT PRIMARY KEY,
        vault_item_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        access_code_hash TEXT NOT NULL,
        active_share_key TEXT,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER,
        created_at INTEGER NOT NULL,
        last_accessed_at INTEGER,
        access_count INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS share_audit_events (
        id TEXT PRIMARY KEY,
        share_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        actor_type TEXT NOT NULL,
        event_at INTEGER NOT NULL,
        owner_id TEXT NOT NULL,
        ip_hash TEXT,
        user_agent_hash TEXT,
        metadata TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS share_rate_limits (
        key TEXT PRIMARY KEY,
        share_id TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        window_started_at INTEGER NOT NULL,
        last_attempt_at INTEGER NOT NULL,
        locked_until INTEGER
    )`,
    // 设备会话表
    `CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_id TEXT,
        provider TEXT,
        device_type TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        last_active_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
    )`,
];

const MYSQL_SHARE_BASE_SCHEMA: string[] = [
    `CREATE TABLE IF NOT EXISTS share_links (
        id VARCHAR(64) PRIMARY KEY,
        vault_item_id VARCHAR(64) NOT NULL,
        owner_id VARCHAR(255) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        access_code_hash VARCHAR(255) NOT NULL,
        active_share_key VARCHAR(320),
        expires_at BIGINT NOT NULL,
        revoked_at BIGINT,
        created_at BIGINT NOT NULL,
        last_accessed_at BIGINT,
        access_count BIGINT DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS share_audit_events (
        id VARCHAR(64) PRIMARY KEY,
        share_id VARCHAR(64) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        actor_type VARCHAR(50) NOT NULL,
        event_at BIGINT NOT NULL,
        owner_id VARCHAR(255) NOT NULL,
        ip_hash VARCHAR(255),
        user_agent_hash VARCHAR(255),
        metadata LONGTEXT
    )`,
    `CREATE TABLE IF NOT EXISTS share_rate_limits (
        \`key\` VARCHAR(255) PRIMARY KEY,
        share_id VARCHAR(255) NOT NULL,
        attempts BIGINT DEFAULT 0,
        window_started_at BIGINT NOT NULL,
        last_attempt_at BIGINT NOT NULL,
        locked_until BIGINT
    )`,
];

const getBaseSchemaForEngine = (engine: string): string[] => {
    if (engine !== 'mysql') {
        return BASE_SCHEMA;
    }

    const baseSchema: string[] = [];
    for (const rawSql of BASE_SCHEMA) {
        if (
            rawSql.includes('CREATE TABLE IF NOT EXISTS share_links') ||
            rawSql.includes('CREATE TABLE IF NOT EXISTS share_audit_events') ||
            rawSql.includes('CREATE TABLE IF NOT EXISTS share_rate_limits')
        ) {
            continue;
        }

        baseSchema.push(rawSql);
    }

    return [...baseSchema, ...MYSQL_SHARE_BASE_SCHEMA];
};

/**
 * 迁移条目
 */
interface Migration {
    version: number;
    name: string;
    sqlite: string;
    d1?: string;
    mysql?: string;
    postgres?: string;
}

function isMigrationStatementAlreadyApplied(error: unknown): boolean {
    const msg = ((error as { message?: string })?.message || '').toLowerCase();
    return (
        msg.includes('duplicate column') ||
        msg.includes('already exists') ||
        msg.includes('duplicate key') ||
        msg.includes('duplicate name') ||
        msg.includes('index') && msg.includes('exists')
    );
}

const MIGRATIONS: Migration[] = [
    {
        version: 1,
        name: 'add_sort_order_to_vault',
        sqlite: `ALTER TABLE vault ADD COLUMN sort_order INTEGER DEFAULT 0;`
    },
    {
        version: 2,
        name: 'add_category_column_to_vault',
        sqlite: `ALTER TABLE vault ADD COLUMN category TEXT;`
    },
    {
        version: 3,
        name: 'create_vault_category_sort_index',
        sqlite: `CREATE INDEX IF NOT EXISTS idx_vault_category_sort ON vault (category, sort_order);`,
        mysql: `CREATE INDEX idx_vault_category_sort ON vault (category(100), sort_order);`
    },
    {
        version: 4,
        name: 'initialize_baseline_indexes',
        sqlite: `
            CREATE INDEX IF NOT EXISTS idx_vault_created_at ON vault(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_vault_service_created_at ON vault(service, created_at DESC);
            CREATE UNIQUE INDEX IF NOT EXISTS vault_service_account_uq ON vault(service, account);
            CREATE INDEX IF NOT EXISTS idx_backup_providers_type ON backup_providers(type);
            CREATE INDEX IF NOT EXISTS idx_backup_telegram_history_provider_id ON backup_telegram_history(provider_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_backup_email_history_provider_id ON backup_email_history(provider_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON auth_passkeys(user_id);
            CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);
        `,
        mysql: `
            CREATE INDEX idx_vault_created_at ON vault(created_at DESC);
            CREATE INDEX idx_vault_service_created_at ON vault(service(100), created_at DESC);
            CREATE UNIQUE INDEX vault_service_account_uq ON vault(service(100), account(100));
            CREATE INDEX idx_backup_providers_type ON backup_providers(type(50));
            CREATE INDEX idx_backup_telegram_history_provider_id ON backup_telegram_history(provider_id, created_at DESC);
            CREATE INDEX idx_backup_email_history_provider_id ON backup_email_history(provider_id, created_at DESC);
            CREATE INDEX idx_passkeys_user_id ON auth_passkeys(user_id(100));
            CREATE INDEX idx_rate_limits_expires ON rate_limits(expires_at);
        `
    },
    {
        version: 5,
        name: 'add_auth_sessions_table',
        sqlite: `CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_type TEXT NOT NULL, ip_address TEXT NOT NULL, last_active_at INTEGER NOT NULL, created_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON auth_sessions(user_id); CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON auth_sessions(last_active_at DESC);`,
        mysql: `CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_type TEXT NOT NULL, ip_address TEXT NOT NULL, last_active_at INTEGER NOT NULL, created_at INTEGER NOT NULL); CREATE INDEX idx_sessions_user_id ON auth_sessions(user_id(100)); CREATE INDEX idx_sessions_last_active ON auth_sessions(last_active_at DESC);`
    },
    {
        version: 6,
        name: 'add_transports_to_auth_passkeys',
        sqlite: `ALTER TABLE auth_passkeys ADD COLUMN transports TEXT;`
    },
    {
        version: 7,
        name: 'add_device_id_to_sessions',
        sqlite: `ALTER TABLE auth_sessions ADD COLUMN device_id TEXT; CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON auth_sessions(user_id, device_id);`,
        mysql: `ALTER TABLE auth_sessions ADD COLUMN device_id TEXT; CREATE INDEX idx_sessions_device_id ON auth_sessions(user_id(100), device_id(100));`
    },
    {
        version: 8,
        name: 'add_provider_to_sessions',
        sqlite: `ALTER TABLE auth_sessions ADD COLUMN provider TEXT;`
    },
    {
        version: 9,
        name: 'convert_timestamps_to_bigint',
        sqlite: `SELECT 1;`,
        mysql: `
            ALTER TABLE vault MODIFY created_at BIGINT NOT NULL;
            ALTER TABLE vault MODIFY updated_at BIGINT;
            ALTER TABLE vault MODIFY sort_order BIGINT DEFAULT 0;
            ALTER TABLE backup_providers MODIFY created_at BIGINT NOT NULL;
            ALTER TABLE backup_providers MODIFY updated_at BIGINT NOT NULL;
            ALTER TABLE backup_providers MODIFY last_backup_at BIGINT;
            ALTER TABLE backup_telegram_history MODIFY created_at BIGINT NOT NULL;
            ALTER TABLE backup_email_history MODIFY created_at BIGINT NOT NULL;
            ALTER TABLE auth_passkeys MODIFY created_at BIGINT NOT NULL;
            ALTER TABLE auth_passkeys MODIFY last_used_at BIGINT;
            ALTER TABLE auth_passkeys MODIFY counter BIGINT DEFAULT 0;
            ALTER TABLE auth_sessions MODIFY created_at BIGINT NOT NULL;
            ALTER TABLE auth_sessions MODIFY last_active_at BIGINT NOT NULL;
            ALTER TABLE rate_limits MODIFY last_attempt BIGINT;
            ALTER TABLE rate_limits MODIFY expires_at BIGINT;
            ALTER TABLE rate_limits MODIFY attempts BIGINT DEFAULT 0;
        `,
        postgres: `
            ALTER TABLE vault ALTER COLUMN created_at TYPE BIGINT;
            ALTER TABLE vault ALTER COLUMN updated_at TYPE BIGINT;
            ALTER TABLE vault ALTER COLUMN sort_order TYPE BIGINT;
            ALTER TABLE backup_providers ALTER COLUMN created_at TYPE BIGINT;
            ALTER TABLE backup_providers ALTER COLUMN updated_at TYPE BIGINT;
            ALTER TABLE backup_providers ALTER COLUMN last_backup_at TYPE BIGINT;
            ALTER TABLE backup_telegram_history ALTER COLUMN created_at TYPE BIGINT;
            ALTER TABLE backup_email_history ALTER COLUMN created_at TYPE BIGINT;
            ALTER TABLE auth_passkeys ALTER COLUMN created_at TYPE BIGINT;
            ALTER TABLE auth_passkeys ALTER COLUMN last_used_at TYPE BIGINT;
            ALTER TABLE auth_passkeys ALTER COLUMN counter TYPE BIGINT;
            ALTER TABLE auth_sessions ALTER COLUMN created_at TYPE BIGINT;
            ALTER TABLE auth_sessions ALTER COLUMN last_active_at TYPE BIGINT;
            ALTER TABLE rate_limits ALTER COLUMN last_attempt TYPE BIGINT;
            ALTER TABLE rate_limits ALTER COLUMN expires_at TYPE BIGINT;
            ALTER TABLE rate_limits ALTER COLUMN attempts TYPE BIGINT;
        `
    },
    {
        version: 10,
        name: 'add_deleted_at_to_vault',
        sqlite: `ALTER TABLE vault ADD COLUMN deleted_at INTEGER; CREATE INDEX IF NOT EXISTS idx_vault_deleted_at ON vault(deleted_at);`,
        mysql: `ALTER TABLE vault ADD COLUMN deleted_at BIGINT; CREATE INDEX idx_vault_deleted_at ON vault(deleted_at);`,
        postgres: `ALTER TABLE vault ADD COLUMN deleted_at BIGINT; CREATE INDEX IF NOT EXISTS idx_vault_deleted_at ON vault(deleted_at);`
    },
    {
        version: 11,
        name: 'add_type_to_vault_and_normalize_algorithms',
        sqlite: `
            ALTER TABLE vault ADD COLUMN type TEXT DEFAULT 'totp';
            UPDATE vault SET type = 'steam', algorithm = 'SHA1' WHERE algorithm = 'STEAM';
            UPDATE vault SET algorithm = 'SHA1' WHERE algorithm = 'SHA-1';
        `,
        mysql: `
            ALTER TABLE vault ADD COLUMN type VARCHAR(20) DEFAULT 'totp';
            UPDATE vault SET type = 'steam', algorithm = 'SHA1' WHERE algorithm = 'STEAM';
            UPDATE vault SET algorithm = 'SHA1' WHERE algorithm = 'SHA-1';
        `,
        postgres: `
            ALTER TABLE vault ADD COLUMN type VARCHAR(20) DEFAULT 'totp';
            UPDATE vault SET type = 'steam', algorithm = 'SHA1' WHERE algorithm = 'STEAM';
            UPDATE vault SET algorithm = 'SHA1' WHERE algorithm = 'SHA-1';
        `
    },
    {
        version: 12,
        name: 'add_counter_to_vault',
        sqlite: `ALTER TABLE vault ADD COLUMN counter INTEGER DEFAULT 0;`,
        mysql: `ALTER TABLE vault ADD COLUMN counter BIGINT DEFAULT 0;`,
        postgres: `ALTER TABLE vault ADD COLUMN counter BIGINT DEFAULT 0;`
    },
    {
        version: 13,
        name: 'create_share_link_tables',
        sqlite: `
            CREATE TABLE IF NOT EXISTS share_links (
                id TEXT PRIMARY KEY,
                vault_item_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                access_code_hash TEXT NOT NULL,
                active_share_key TEXT,
                expires_at INTEGER NOT NULL,
                revoked_at INTEGER,
                created_at INTEGER NOT NULL,
                last_accessed_at INTEGER,
                access_count INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS share_audit_events (
                id TEXT PRIMARY KEY,
                share_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                actor_type TEXT NOT NULL,
                event_at INTEGER NOT NULL,
                owner_id TEXT NOT NULL,
                ip_hash TEXT,
                user_agent_hash TEXT,
                metadata TEXT
            );
            CREATE TABLE IF NOT EXISTS share_rate_limits (
                key TEXT PRIMARY KEY,
                share_id TEXT NOT NULL,
                attempts INTEGER DEFAULT 0,
                window_started_at INTEGER NOT NULL,
                last_attempt_at INTEGER NOT NULL,
                locked_until INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_share_links_vault_item ON share_links(vault_item_id);
            CREATE INDEX IF NOT EXISTS idx_share_links_owner ON share_links(owner_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_share_links_token_hash ON share_links(token_hash);
            CREATE INDEX IF NOT EXISTS idx_share_links_expires_at ON share_links(expires_at);
            CREATE INDEX IF NOT EXISTS idx_share_audit_share_time ON share_audit_events(share_id, event_at DESC);
            CREATE INDEX IF NOT EXISTS idx_share_rate_limits_locked_until ON share_rate_limits(locked_until);
        `,
        d1: `
            CREATE TABLE IF NOT EXISTS share_links (
                id TEXT PRIMARY KEY,
                vault_item_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                access_code_hash TEXT NOT NULL,
                active_share_key TEXT,
                expires_at INTEGER NOT NULL,
                revoked_at INTEGER,
                created_at INTEGER NOT NULL,
                last_accessed_at INTEGER,
                access_count INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS share_audit_events (
                id TEXT PRIMARY KEY,
                share_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                actor_type TEXT NOT NULL,
                event_at INTEGER NOT NULL,
                owner_id TEXT NOT NULL,
                ip_hash TEXT,
                user_agent_hash TEXT,
                metadata TEXT
            );
            CREATE TABLE IF NOT EXISTS share_rate_limits (
                key TEXT PRIMARY KEY,
                share_id TEXT NOT NULL,
                attempts INTEGER DEFAULT 0,
                window_started_at INTEGER NOT NULL,
                last_attempt_at INTEGER NOT NULL,
                locked_until INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_share_links_vault_item ON share_links(vault_item_id);
            CREATE INDEX IF NOT EXISTS idx_share_links_owner ON share_links(owner_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_share_links_token_hash ON share_links(token_hash);
            CREATE INDEX IF NOT EXISTS idx_share_links_expires_at ON share_links(expires_at);
            CREATE INDEX IF NOT EXISTS idx_share_audit_share_time ON share_audit_events(share_id, event_at DESC);
            CREATE INDEX IF NOT EXISTS idx_share_rate_limits_locked_until ON share_rate_limits(locked_until);
        `,
        mysql: `
            CREATE TABLE IF NOT EXISTS share_links (
                id VARCHAR(64) PRIMARY KEY,
                vault_item_id VARCHAR(64) NOT NULL,
                owner_id VARCHAR(255) NOT NULL,
                token_hash VARCHAR(255) NOT NULL,
                access_code_hash VARCHAR(255) NOT NULL,
                active_share_key VARCHAR(320),
                expires_at BIGINT NOT NULL,
                revoked_at BIGINT,
                created_at BIGINT NOT NULL,
                last_accessed_at BIGINT,
                access_count BIGINT DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS share_audit_events (
                id VARCHAR(64) PRIMARY KEY,
                share_id VARCHAR(64) NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                actor_type VARCHAR(50) NOT NULL,
                event_at BIGINT NOT NULL,
                owner_id VARCHAR(255) NOT NULL,
                ip_hash VARCHAR(255),
                user_agent_hash VARCHAR(255),
                metadata LONGTEXT
            );
            CREATE TABLE IF NOT EXISTS share_rate_limits (
                \`key\` VARCHAR(255) PRIMARY KEY,
                share_id VARCHAR(255) NOT NULL,
                attempts BIGINT DEFAULT 0,
                window_started_at BIGINT NOT NULL,
                last_attempt_at BIGINT NOT NULL,
                locked_until BIGINT
            );
            CREATE INDEX idx_share_links_vault_item ON share_links(vault_item_id);
            CREATE INDEX idx_share_links_owner ON share_links(owner_id, created_at DESC);
            CREATE INDEX idx_share_links_token_hash ON share_links(token_hash);
            CREATE INDEX idx_share_links_expires_at ON share_links(expires_at);
            CREATE INDEX idx_share_audit_share_time ON share_audit_events(share_id, event_at DESC);
            CREATE INDEX idx_share_rate_limits_locked_until ON share_rate_limits(locked_until);
        `,
        postgres: `
            CREATE TABLE IF NOT EXISTS share_links (
                id TEXT PRIMARY KEY,
                vault_item_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                access_code_hash TEXT NOT NULL,
                active_share_key TEXT,
                expires_at BIGINT NOT NULL,
                revoked_at BIGINT,
                created_at BIGINT NOT NULL,
                last_accessed_at BIGINT,
                access_count BIGINT DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS share_audit_events (
                id TEXT PRIMARY KEY,
                share_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                actor_type TEXT NOT NULL,
                event_at BIGINT NOT NULL,
                owner_id TEXT NOT NULL,
                ip_hash TEXT,
                user_agent_hash TEXT,
                metadata TEXT
            );
            CREATE TABLE IF NOT EXISTS share_rate_limits (
                key TEXT PRIMARY KEY,
                share_id TEXT NOT NULL,
                attempts BIGINT DEFAULT 0,
                window_started_at BIGINT NOT NULL,
                last_attempt_at BIGINT NOT NULL,
                locked_until BIGINT
            );
            CREATE INDEX IF NOT EXISTS idx_share_links_vault_item ON share_links(vault_item_id);
            CREATE INDEX IF NOT EXISTS idx_share_links_owner ON share_links(owner_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_share_links_token_hash ON share_links(token_hash);
            CREATE INDEX IF NOT EXISTS idx_share_links_expires_at ON share_links(expires_at);
            CREATE INDEX IF NOT EXISTS idx_share_audit_share_time ON share_audit_events(share_id, event_at DESC);
            CREATE INDEX IF NOT EXISTS idx_share_rate_limits_locked_until ON share_rate_limits(locked_until);
        `
    },
    {
        version: 14,
        name: 'add_active_share_uniqueness_guard',
        sqlite: `
            ALTER TABLE share_links ADD COLUMN active_share_key TEXT;
            UPDATE share_links
                SET active_share_key = NULL
                WHERE active_share_key IS NOT NULL;
            UPDATE share_links
                SET revoked_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
                WHERE revoked_at IS NULL
                    AND expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000
                    AND id NOT IN (
                        SELECT id FROM (
                            SELECT id
                            FROM share_links AS latest
                            WHERE latest.revoked_at IS NULL
                                AND latest.expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000
                                AND latest.id = (
                                    SELECT newest.id
                                    FROM share_links AS newest
                                    WHERE newest.owner_id = latest.owner_id
                                        AND newest.vault_item_id = latest.vault_item_id
                                        AND newest.revoked_at IS NULL
                                        AND newest.expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000
                                    ORDER BY newest.created_at DESC, newest.id DESC
                                    LIMIT 1
                                )
                        )
                    );
            UPDATE share_links
                SET active_share_key = owner_id || ':' || vault_item_id
                WHERE revoked_at IS NULL
                    AND expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000;
            CREATE UNIQUE INDEX IF NOT EXISTS idx_share_links_active_share_key ON share_links(active_share_key);
        `,
        d1: `
            ALTER TABLE share_links ADD COLUMN active_share_key TEXT;
            UPDATE share_links
                SET active_share_key = NULL
                WHERE active_share_key IS NOT NULL;
            UPDATE share_links
                SET revoked_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
                WHERE revoked_at IS NULL
                    AND expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000
                    AND id NOT IN (
                        SELECT id FROM (
                            SELECT id
                            FROM share_links AS latest
                            WHERE latest.revoked_at IS NULL
                                AND latest.expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000
                                AND latest.id = (
                                    SELECT newest.id
                                    FROM share_links AS newest
                                    WHERE newest.owner_id = latest.owner_id
                                        AND newest.vault_item_id = latest.vault_item_id
                                        AND newest.revoked_at IS NULL
                                        AND newest.expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000
                                    ORDER BY newest.created_at DESC, newest.id DESC
                                    LIMIT 1
                                )
                        )
                    );
            UPDATE share_links
                SET active_share_key = owner_id || ':' || vault_item_id
                WHERE revoked_at IS NULL
                    AND expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000;
            CREATE UNIQUE INDEX IF NOT EXISTS idx_share_links_active_share_key ON share_links(active_share_key);
        `,
        mysql: `
            ALTER TABLE share_links ADD COLUMN active_share_key VARCHAR(320);
            UPDATE share_links
                SET active_share_key = NULL
                WHERE active_share_key IS NOT NULL;
            UPDATE share_links
                SET revoked_at = UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                WHERE revoked_at IS NULL
                    AND expires_at > UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                    AND id NOT IN (
                        SELECT id FROM (
                            SELECT id
                            FROM share_links AS latest
                            WHERE latest.revoked_at IS NULL
                                AND latest.expires_at > UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                                AND latest.id = (
                                    SELECT newest.id
                                    FROM share_links AS newest
                                    WHERE newest.owner_id = latest.owner_id
                                        AND newest.vault_item_id = latest.vault_item_id
                                        AND newest.revoked_at IS NULL
                                        AND newest.expires_at > UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                                    ORDER BY newest.created_at DESC, newest.id DESC
                                    LIMIT 1
                                )
                        ) AS retained_active_shares
                    );
            UPDATE share_links
                SET active_share_key = CONCAT(owner_id, ':', vault_item_id)
                WHERE revoked_at IS NULL
                    AND expires_at > UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000;
            CREATE UNIQUE INDEX idx_share_links_active_share_key ON share_links(active_share_key);
        `,
        postgres: `
            ALTER TABLE share_links ADD COLUMN active_share_key TEXT;
            UPDATE share_links
                SET active_share_key = NULL
                WHERE active_share_key IS NOT NULL;
            UPDATE share_links
                SET revoked_at = EXTRACT(EPOCH FROM NOW()) * 1000
                WHERE revoked_at IS NULL
                    AND expires_at > EXTRACT(EPOCH FROM NOW()) * 1000
                    AND id NOT IN (
                        SELECT id FROM (
                            SELECT id
                            FROM share_links AS latest
                            WHERE latest.revoked_at IS NULL
                                AND latest.expires_at > EXTRACT(EPOCH FROM NOW()) * 1000
                                AND latest.id = (
                                    SELECT newest.id
                                    FROM share_links AS newest
                                    WHERE newest.owner_id = latest.owner_id
                                        AND newest.vault_item_id = latest.vault_item_id
                                        AND newest.revoked_at IS NULL
                                        AND newest.expires_at > EXTRACT(EPOCH FROM NOW()) * 1000
                                    ORDER BY newest.created_at DESC, newest.id DESC
                                    LIMIT 1
                                )
                        ) AS retained_active_shares
                    );
            UPDATE share_links
                SET active_share_key = owner_id || ':' || vault_item_id
                WHERE revoked_at IS NULL
                    AND expires_at > EXTRACT(EPOCH FROM NOW()) * 1000;
            CREATE UNIQUE INDEX IF NOT EXISTS idx_share_links_active_share_key ON share_links(active_share_key);
        `
    }
];

/**
 * 统一迁移入口：支持多端兼容
 */
export async function migrateDatabase(db: DbExecutor) {
    const engine = db.engine;

    // 1. 确保元数据表存在
    const createMetaTable = transformSqlForDialect(`CREATE TABLE IF NOT EXISTS _schema_metadata (\`key\` TEXT PRIMARY KEY, \`value\` TEXT)`, engine);
    await db.exec(createMetaTable);

    // 2. 初始化基础数据表（自愈机制）
    //    通过 Cloudflare 面板直接绑定 GitHub 部署时，会跳过 GitHub Actions 中的
    //    `d1 execute schema.sql` 步骤，导致数据表为空。
    //    此处遍历执行所有基础 CREATE TABLE IF NOT EXISTS 语句，确保在任意部署
    //    方式下首次请求都能自动完成建表。语句均为幂等操作，不影响已有数据。
    for (const rawSql of getBaseSchemaForEngine(engine)) {
        try {
            // 使用 prepare().run() 而非 exec()：
            // D1 的 exec() 是面向 SQL 文件批处理设计的，对多行 DDL 语句有行解析限制。
            // prepare().run() 支持完整的多行 CREATE TABLE 语句，与增量 MIGRATIONS 的执行路径一致。
            const sql = transformSqlForDialect(rawSql.trim(), engine);
            await db.prepare(sql).run();
        } catch (e: any) {
            // 忽略"表已存在"之类的错误（MySQL 等方言可能在某些情况下抛出）
            const msg = e.message?.toLowerCase() || '';
            if (!msg.includes('already exists')) throw e;
        }
    }

    // 3. 获取当前版本
    const queryMeta = transformSqlForDialect("SELECT `value` FROM _schema_metadata WHERE `key` = 'version'", engine);
    const row = await db.prepare(queryMeta).get();
    const currentVersion = row ? parseInt(row.value, 10) : 0;

    const pending = MIGRATIONS.filter(m => m.version > currentVersion).sort((a, b) => a.version - b.version);

    if (pending.length === 0) return;

    logger.info(`[Database] Current engine: ${engine}. version: ${currentVersion}. Migrating to v${pending[pending.length - 1].version}...`);

    for (const m of pending) {
        logger.info(`[Database] Applying v${m.version}: ${m.name}`);
        try {
            // 将复合 SQL 按分号拆分执行
            const engineSql = (m as any)[engine] || m.sqlite;
            const statements = engineSql.split(';').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
            for (const rawSql of statements) {
                const sql = transformSqlForDialect(rawSql, engine);
                try {
                    await db.exec(sql);
                } catch (e: any) {
                    if (isMigrationStatementAlreadyApplied(e)) {
                        logger.info(`[Database] Skip existing statement in v${m.version}: ${rawSql.slice(0, 80)}`);
                        continue;
                    }

                    throw e;
                }
            }
            // 使用插入或替换
            const updateMetaRaw = engine === 'postgres'
                ? 'INSERT INTO _schema_metadata ("key", "value") VALUES (\'version\', ?) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED.value'
                : "REPLACE INTO _schema_metadata (`key`, `value`) VALUES ('version', ?)";

            const updateMeta = transformSqlForDialect(updateMetaRaw, engine);

            await db.prepare(updateMeta).run(m.version.toString());
        } catch (e: any) {
            if (isMigrationStatementAlreadyApplied(e)) {
                logger.info(`[Database] Skip existing change in v${m.version}`);
                const updateMetaRaw = engine === 'postgres'
                    ? 'INSERT INTO _schema_metadata ("key", "value") VALUES (\'version\', ?) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED.value'
                    : "REPLACE INTO _schema_metadata (`key`, `value`) VALUES ('version', ?)";
                const updateMeta = transformSqlForDialect(updateMetaRaw, engine);
                await db.prepare(updateMeta).run(m.version.toString());
                continue;
            }
            throw e;
        }
    }
}
