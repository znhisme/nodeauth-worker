export const SHARE_TOKEN_BYTES = 32;
export const SHARE_ACCESS_CODE_BYTES = 16;
export const SHARE_DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SHARE_MAX_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SHARE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const SHARE_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const SHARE_RATE_LIMIT_LOCK_MS = 15 * 60 * 1000;
export const SHARE_RATE_LIMIT_RETENTION_MS = SHARE_RATE_LIMIT_WINDOW_MS + SHARE_RATE_LIMIT_LOCK_MS;

export type ShareStatus = 'active' | 'expired' | 'revoked';
export type ShareAuditEventType = 'created' | 'access_granted' | 'access_denied_threshold' | 'expired' | 'revoked';
export type ShareActorType = 'owner' | 'recipient' | 'system';

export interface SharedItemView {
    service: string;
    account: string;
    password?: string;
    otp?: {
        code: string;
        period: number;
        remainingSeconds: number;
    };
}

export interface OwnerShareItemReferenceView {
    id: string;
    service: string;
    account: string;
}

export interface OwnerShareMetadataView {
    id: string;
    item: OwnerShareItemReferenceView;
    status: ShareStatus;
    createdAt: string;
    expiresAt: string;
    revokedAt: string | null;
    lastAccessedAt: string | null;
    accessCount: number;
    publicUrl?: string;
}

export interface OwnerShareCreatedView extends OwnerShareMetadataView {
    rawToken: string;
    rawAccessCode: string;
}

export interface ShareLinkRecord {
    id: string;
    ownerId: string;
    vaultItemId: string;
    tokenHash: string;
    accessCodeHash: string;
    status: ShareStatus;
    expiresAt: string;
    revokedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    lastAccessedAt?: string | null;
    accessCount?: number;
    publicUrl?: string;
}

export interface SharePublicAccessRecord {
    status: ShareStatus;
    expiresAt: string;
    revokedAt?: string | null;
    createdAt: string;
}

export interface ShareAuditEvent {
    id: string;
    shareId: string;
    actorType: ShareActorType;
    eventType: ShareAuditEventType;
    createdAt: string;
    metadata?: Record<string, unknown> | null;
}

export interface CreateShareInput {
    ownerId: string;
    ownerAliases?: string[];
    vaultItemId: string;
    expiresAt?: number;
    ttlSeconds?: number;
    now?: number;
    publicOrigin?: string;
    includePassword?: boolean;
    includeOtp?: boolean;
}

export interface CreateSharesBatchInput extends Omit<CreateShareInput, 'vaultItemId'> {
    vaultItemIds: string[];
}

export interface OwnerShareBatchSuccessView {
    requestIndex: number;
    share: OwnerShareCreatedView;
}

export interface OwnerShareBatchFailureView {
    requestIndex: number;
    error: 'could_not_create_share';
}

export interface OwnerShareBatchCreatedView {
    successes: OwnerShareBatchSuccessView[];
    failures: OwnerShareBatchFailureView[];
}

export interface CreateShareResult {
    share: ShareLinkRecord;
    rawToken: string;
    rawAccessCode: string;
}

export interface ResolveShareAccessInput {
    token: string;
    accessCode?: string;
    requestOrigin?: string;
    now?: number;
}

export interface ShareRateLimitInput {
    key: string;
    shareId: string;
    windowMs: number;
    maxAttempts: number;
    lockMs: number;
    now?: number;
}

export interface ShareRateLimitDecision {
    allowed: boolean;
    attempts: number;
    lockedUntil?: number | null;
}

export interface ShareCleanupResult {
    expiredSharesMarked: number;
    staleRateLimitRowsDeleted: number;
    ranAt: number;
}

export interface ShareAccessDecision {
    accessible: boolean;
    status: ShareStatus;
    reason?: 'inaccessible';
    share?: SharePublicAccessRecord | null;
    publicHeaders?: Record<string, string>;
    publicUrl?: string;
    itemView?: SharedItemView | null;
}
