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
    ttlSeconds?: number;
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
}

export interface ShareAccessDecision {
    allowed: boolean;
    status: ShareStatus;
    reason?: 'missing_access_code' | 'invalid_access_code' | 'expired' | 'revoked' | 'rate_limited' | 'not_found';
    share?: ShareLinkRecord | null;
    publicHeaders?: Record<string, string>;
    publicUrl?: string;
    itemView?: SharedItemView | null;
}
