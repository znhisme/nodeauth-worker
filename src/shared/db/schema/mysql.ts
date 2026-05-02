import { mysqlTable, varchar, int, boolean, longtext, bigint } from 'drizzle-orm/mysql-core';

export const vault = mysqlTable('vault', {
    id: varchar('id', { length: 36 }).primaryKey(),
    service: varchar('service', { length: 255 }).notNull(),
    account: varchar('account', { length: 255 }).notNull(),
    category: varchar('category', { length: 100 }),
    secret: longtext('secret').notNull(),
    digits: int('digits').default(6),
    period: int('period').default(30),
    type: varchar('type', { length: 20 }).default('totp'),
    algorithm: varchar('algorithm', { length: 20 }).default('SHA1'),
    counter: bigint('counter', { mode: 'number' }).default(0),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    createdBy: varchar('created_by', { length: 255 }),
    updatedAt: bigint('updated_at', { mode: 'number' }),
    updatedBy: varchar('updated_by', { length: 255 }),
    sortOrder: bigint('sort_order', { mode: 'number' }).default(0),
    deletedAt: bigint('deleted_at', { mode: 'number' }),
});

export const shareLinks = mysqlTable('share_links', {
    id: varchar('id', { length: 36 }).primaryKey(),
    vaultItemId: varchar('vault_item_id', { length: 36 }).notNull(),
    ownerId: varchar('owner_id', { length: 255 }).notNull(),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    accessCodeHash: varchar('access_code_hash', { length: 255 }).notNull(),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
    revokedAt: bigint('revoked_at', { mode: 'number' }),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    lastAccessedAt: bigint('last_accessed_at', { mode: 'number' }),
    accessCount: bigint('access_count', { mode: 'number' }).notNull().default(0),
});

export const shareAuditEvents = mysqlTable('share_audit_events', {
    id: varchar('id', { length: 36 }).primaryKey(),
    shareId: varchar('share_id', { length: 36 }).notNull(),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    actorType: varchar('actor_type', { length: 50 }).notNull(),
    eventAt: bigint('event_at', { mode: 'number' }).notNull(),
    ownerId: varchar('owner_id', { length: 255 }).notNull(),
    ipHash: varchar('ip_hash', { length: 255 }),
    userAgentHash: varchar('user_agent_hash', { length: 255 }),
    metadata: longtext('metadata'),
});

export const shareRateLimits = mysqlTable('share_rate_limits', {
    key: varchar('key', { length: 255 }).primaryKey(),
    shareId: varchar('share_id', { length: 36 }).notNull(),
    attempts: bigint('attempts', { mode: 'number' }).notNull().default(0),
    windowStartedAt: bigint('window_started_at', { mode: 'number' }).notNull(),
    lastAttemptAt: bigint('last_attempt_at', { mode: 'number' }).notNull(),
    lockedUntil: bigint('locked_until', { mode: 'number' }),
});

export const backupProviders = mysqlTable('backup_providers', {
    id: int('id').primaryKey().autoincrement(),
    type: varchar('type', { length: 50 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    isEnabled: boolean('is_enabled').default(true),
    config: longtext('config').notNull(),
    autoBackup: boolean('auto_backup').default(false),
    autoBackupPassword: longtext('auto_backup_password'),
    autoBackupRetain: int('auto_backup_retain').default(30),
    lastBackupAt: bigint('last_backup_at', { mode: 'number' }),
    lastBackupStatus: varchar('last_backup_status', { length: 20 }),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const backupTelegramHistory = mysqlTable('backup_telegram_history', {
    id: int('id').primaryKey().autoincrement(),
    providerId: int('provider_id').notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    fileId: varchar('file_id', { length: 255 }).notNull(),
    messageId: int('message_id').notNull(),
    size: int('size').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

export const backupEmailHistory = mysqlTable('backup_email_history', {
    id: int('id').primaryKey().autoincrement(),
    providerId: int('provider_id').notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    recipient: varchar('recipient', { length: 255 }).notNull(),
    size: int('size').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

export const authPasskeys = mysqlTable('auth_passkeys', {
    credentialId: varchar('credential_id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }),
    publicKey: longtext('public_key').notNull(),
    counter: bigint('counter', { mode: 'number' }).default(0),
    lastUsedAt: bigint('last_used_at', { mode: 'number' }),
    transports: varchar('transports', { length: 255 }),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

export const authSessions = mysqlTable('auth_sessions', {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    deviceId: varchar('device_id', { length: 255 }),
    provider: varchar('provider', { length: 50 }),
    deviceType: varchar('device_type', { length: 255 }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    lastActiveAt: bigint('last_active_at', { mode: 'number' }).notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

export const rateLimits = mysqlTable('rate_limits', {
    key: varchar('key', { length: 255 }).primaryKey(),
    attempts: bigint('attempts', { mode: 'number' }).default(0),
    lastAttempt: bigint('last_attempt', { mode: 'number' }),
    expiresAt: bigint('expires_at', { mode: 'number' }),
});

export const schemaMetadata = mysqlTable('_schema_metadata', {
    key: varchar('key', { length: 255 }).primaryKey(),
    value: varchar('value', { length: 255 }),
});
