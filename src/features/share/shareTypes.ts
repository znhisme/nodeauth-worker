export const SHARE_TOKEN_BYTES = 32;
export const SHARE_ACCESS_CODE_BYTES = 16;
export const SHARE_DEFAULT_TTL_SECONDS = 24 * 60 * 60;
export const SHARE_MAX_TTL_SECONDS = 7 * 24 * 60 * 60;
export const SHARE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const SHARE_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const SHARE_RATE_LIMIT_LOCK_MS = 15 * 60 * 1000;

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
    vaultItemId: string;
    expiresAt?: number;
    ttlSeconds?: number;
    now?: number;
    publicOrigin?: string;
    includePassword?: boolean;
    includeOtp?: boolean;
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

export interface ShareAccessDecision {
    accessible: boolean;
    status: ShareStatus;
    reason?: 'inaccessible';
    share?: SharePublicAccessRecord | null;
    publicHeaders?: Record<string, string>;
    publicUrl?: string;
    itemView?: SharedItemView | null;
}
