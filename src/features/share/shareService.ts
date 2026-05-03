import { AppError, type EnvBindings } from '@/app/config';
import { decryptField } from '@/shared/db/db';
import { VaultRepository } from '@/shared/db/repositories/vaultRepository';
import { ShareRepository } from '@/shared/db/repositories/shareRepository';
import { generate } from '@/shared/utils/otp';
import {
    buildShareUrl,
    clampShareTtlSeconds,
    generateAccessCode,
    generateShareToken,
    getSharePublicHeaders,
    getShareSecretPepper,
    hashShareSecret,
    verifyShareSecret,
} from '@/features/share/shareSecurity';
import {
    type CreateShareInput,
    type CreateSharesBatchInput,
    type OwnerShareCreatedView,
    type OwnerShareBatchCreatedView,
    type OwnerShareMetadataView,
    type CreateShareResult,
    type ResolveShareAccessInput,
    type ShareAccessDecision,
    type ShareCleanupResult,
    type ShareLinkRecord,
    SHARE_DEFAULT_TTL_SECONDS,
    SHARE_MAX_TTL_SECONDS,
    SHARE_RATE_LIMIT_RETENTION_MS,
} from '@/features/share/shareTypes';

const textEncoder = new TextEncoder();

function createId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
}

function toMetadata(value: Record<string, unknown>): string {
    return JSON.stringify(value);
}

function toShareStatus(share: Pick<ShareLinkRecord, 'expiresAt' | 'revokedAt'>, now: number): 'active' | 'expired' | 'revoked' {
    return share.revokedAt != null ? 'revoked' : (Number(share.expiresAt) <= now ? 'expired' : 'active');
}

export class ShareService {
    constructor(
        private env: EnvBindings,
        private vaultRepository: VaultRepository,
        private shareRepository: ShareRepository,
    ) {}

    private toOwnerMetadataView(share: ShareLinkRecord, vaultItem: { id: string; service: string; account: string }, now: number, publicUrl?: string): OwnerShareMetadataView {
        return {
            id: share.id,
            item: {
                id: vaultItem.id,
                service: vaultItem.service,
                account: vaultItem.account,
            },
            status: toShareStatus(share, now),
            createdAt: String(share.createdAt),
            expiresAt: String(share.expiresAt),
            revokedAt: share.revokedAt != null ? String(share.revokedAt) : null,
            lastAccessedAt: share.lastAccessedAt != null ? String(share.lastAccessedAt) : null,
            accessCount: Number(share.accessCount || 0),
            ...(publicUrl ? { publicUrl } : {}),
        };
    }

    async createShare(input: CreateShareInput): Promise<CreateShareResult> {
        if (!input.ownerId || !input.vaultItemId) {
            throw new AppError('share_item_inaccessible', 404);
        }

        const now = input.now ?? Date.now();
        const ttlSeconds = clampShareTtlSeconds(input.ttlSeconds ?? SHARE_DEFAULT_TTL_SECONDS);
        const expiresAt = input.expiresAt ?? now + ttlSeconds * 1000;

        if (expiresAt <= now || expiresAt > now + SHARE_MAX_TTL_SECONDS * 1000) {
            throw new AppError('share_item_inaccessible', 404);
        }

        const vaultItem = await this.vaultRepository.findActiveByIdForOwner(input.vaultItemId, input.ownerId);
        if (!vaultItem) {
            throw new AppError('share_item_inaccessible', 404);
        }

        const replacedShares = await this.shareRepository.revokeActiveForOwnerVaultItem(input.ownerId, input.vaultItemId, now);
        for (const replacedShare of replacedShares) {
            await this.shareRepository.insertAuditEvent({
                id: createId('share-audit'),
                shareId: replacedShare.id,
                eventType: 'revoked',
                actorType: 'owner',
                eventAt: now,
                ownerId: input.ownerId,
                ipHash: null,
                userAgentHash: null,
                metadata: toMetadata({
                    revokedAt: now,
                    reason: 'latest_share_wins',
                }),
            });
        }

        const rawToken = generateShareToken();
        const rawAccessCode = generateAccessCode();
        const pepper = getShareSecretPepper(this.env);
        const tokenHash = await hashShareSecret(pepper, 'share-token', rawToken);
        const accessCodeHash = await hashShareSecret(pepper, 'share-access-code', rawAccessCode);
        const shareId = createId('share');

        const share = await this.shareRepository.createShareLink({
            id: shareId,
            vaultItemId: input.vaultItemId,
            ownerId: input.ownerId,
            tokenHash,
            accessCodeHash,
            expiresAt,
            revokedAt: null,
            createdAt: now,
            lastAccessedAt: null,
            accessCount: 0,
        });

        const publicOrigin = input.publicOrigin || this.env.NODEAUTH_PUBLIC_ORIGIN;
        const publicUrl = publicOrigin ? buildShareUrl(publicOrigin, rawToken) : undefined;

        await this.shareRepository.insertAuditEvent({
            id: createId('share-audit'),
            shareId: share.id,
            eventType: 'created',
            actorType: 'owner',
            eventAt: now,
            ownerId: input.ownerId,
            ipHash: null,
            userAgentHash: null,
            metadata: toMetadata({
                vaultItemId: input.vaultItemId,
                expiresAt,
            }),
        });

        return {
            share: {
                id: share.id,
                ownerId: share.ownerId,
                vaultItemId: share.vaultItemId,
                tokenHash: share.tokenHash,
                accessCodeHash: share.accessCodeHash,
                status: share.revokedAt ? 'revoked' : (share.expiresAt <= now ? 'expired' : 'active'),
                expiresAt: String(share.expiresAt),
                revokedAt: share.revokedAt ? String(share.revokedAt) : null,
                createdAt: String(share.createdAt),
                updatedAt: String(share.createdAt),
                publicUrl,
            },
            rawToken,
            rawAccessCode,
        };
    }

    async createShareForOwner(input: CreateShareInput): Promise<OwnerShareCreatedView> {
        const created = await this.createShare(input);
        const vaultItem = await this.vaultRepository.findActiveByIdForOwner(input.vaultItemId, input.ownerId);
        if (!vaultItem) {
            throw new AppError('share_item_inaccessible', 404);
        }

        return {
            ...this.toOwnerMetadataView(created.share as ShareLinkRecord, vaultItem, input.now ?? Date.now(), created.share.publicUrl),
            rawToken: created.rawToken,
            rawAccessCode: created.rawAccessCode,
        };
    }

    async createSharesForOwnerBatch(input: CreateSharesBatchInput): Promise<OwnerShareBatchCreatedView> {
        const batchNow = input.now ?? Date.now();
        const successes: OwnerShareBatchCreatedView['successes'] = [];
        const failures: OwnerShareBatchCreatedView['failures'] = [];

        for (const [requestIndex, vaultItemId] of input.vaultItemIds.entries()) {
            try {
                const share = await this.createShareForOwner({
                    ownerId: input.ownerId,
                    vaultItemId,
                    ttlSeconds: input.ttlSeconds,
                    expiresAt: input.expiresAt,
                    now: batchNow,
                    publicOrigin: input.publicOrigin,
                });
                successes.push({ requestIndex, share });
            } catch {
                failures.push({ requestIndex, error: 'could_not_create_share' });
            }
        }

        return { successes, failures };
    }

    async listSharesForOwner(ownerId: string, now = Date.now()): Promise<OwnerShareMetadataView[]> {
        const shares = await this.shareRepository.listForOwner(ownerId);
        const views: OwnerShareMetadataView[] = [];

        for (const share of shares) {
            const vaultItem = await this.vaultRepository.findActiveByIdForOwner(share.vaultItemId, ownerId);
            if (!vaultItem) {
                continue;
            }

            views.push(this.toOwnerMetadataView(share as ShareLinkRecord, vaultItem, now));
        }

        return views;
    }

    async getShareForOwner(ownerId: string, shareId: string, now = Date.now()): Promise<OwnerShareMetadataView> {
        const share = await this.shareRepository.findByIdForOwner(shareId, ownerId);
        if (!share) {
            throw new AppError('share_item_inaccessible', 404);
        }

        const vaultItem = await this.vaultRepository.findActiveByIdForOwner(share.vaultItemId, ownerId);
        if (!vaultItem) {
            throw new AppError('share_item_inaccessible', 404);
        }

        return this.toOwnerMetadataView(share as ShareLinkRecord, vaultItem, now);
    }

    async revokeShareForOwner(ownerId: string, shareId: string, now = Date.now()): Promise<OwnerShareMetadataView> {
        const share = await this.shareRepository.findByIdForOwner(shareId, ownerId);
        if (!share) {
            throw new AppError('share_item_inaccessible', 404);
        }

        const vaultItem = await this.vaultRepository.findActiveByIdForOwner(share.vaultItemId, ownerId);
        if (!vaultItem) {
            throw new AppError('share_item_inaccessible', 404);
        }

        const revoked = await this.shareRepository.revokeForOwner(shareId, ownerId, now);
        if (!revoked) {
            throw new AppError('share_item_inaccessible', 404);
        }

        await this.shareRepository.insertAuditEvent({
            id: createId('share-audit'),
            shareId,
            eventType: 'revoked',
            actorType: 'owner',
            eventAt: now,
            ownerId,
            ipHash: null,
            userAgentHash: null,
            metadata: toMetadata({ revokedAt: now }),
        });

        const revokedShare = {
            ...(share as ShareLinkRecord),
            revokedAt: now,
        };

        return this.toOwnerMetadataView(revokedShare, vaultItem, now);
    }

    async revokeShare(ownerId: string, shareId: string, now = Date.now()): Promise<void> {
        const revoked = await this.shareRepository.revokeForOwner(shareId, ownerId, now);
        if (!revoked) {
            throw new AppError('share_item_inaccessible', 404);
        }

        await this.shareRepository.insertAuditEvent({
            id: createId('share-audit'),
            shareId,
            eventType: 'revoked',
            actorType: 'owner',
            eventAt: now,
            ownerId,
            ipHash: null,
            userAgentHash: null,
            metadata: toMetadata({ revokedAt: now }),
        });
    }

    async cleanupShareState(now = Date.now()): Promise<ShareCleanupResult> {
        const expiredShares = await this.shareRepository.findExpiredSharesForCleanup(now);
        let expiredSharesMarked = 0;

        for (const share of expiredShares) {
            const inserted = await this.shareRepository.insertExpiredAuditEventIfMissing(share, now);
            if (inserted) {
                expiredSharesMarked += 1;
            }
        }

        const staleRateLimitCutoff = now - SHARE_RATE_LIMIT_RETENTION_MS;
        const staleRateLimitRowsDeleted = await this.shareRepository.deleteStaleRateLimits(staleRateLimitCutoff);

        return {
            expiredSharesMarked,
            staleRateLimitRowsDeleted,
            ranAt: now,
        };
    }

    async resolveShareAccess(input: ResolveShareAccessInput): Promise<ShareAccessDecision> {
        const now = input.now ?? Date.now();
        const pepper = getShareSecretPepper(this.env);
        const publicHeaders = getSharePublicHeaders();
        const tokenHash = await hashShareSecret(pepper, 'share-token', input.token);
        const share = await this.shareRepository.findByTokenHash(tokenHash);

        if (!share) {
            return { accessible: false, status: 'revoked', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
        }

        if (share.revokedAt !== null && share.revokedAt !== undefined) {
            return { accessible: false, status: 'revoked', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
        }

        if (share.expiresAt <= now) {
            await this.shareRepository.insertAuditEvent({
                id: createId('share-audit'),
                shareId: share.id,
                eventType: 'expired',
                actorType: 'system',
                eventAt: now,
                ownerId: share.ownerId,
                ipHash: null,
                userAgentHash: null,
                metadata: toMetadata({
                    expiredAt: now,
                    expiresAt: share.expiresAt,
                    status: 'expired',
                }),
            });
            return { accessible: false, status: 'expired', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
        }

        const vaultItem = await this.vaultRepository.findActiveByIdForOwner(share.vaultItemId, share.ownerId);
        if (!vaultItem) {
            return { accessible: false, status: 'revoked', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
        }

        const accessCode = input.accessCode || '';
        const accessCodeOk = await verifyShareSecret(pepper, 'share-access-code', accessCode, share.accessCodeHash);
        if (!accessCodeOk) {
            return { accessible: false, status: 'active', reason: 'inaccessible', share: null, itemView: null, publicHeaders };
        }

        const decryptedSecret = await decryptField(vaultItem.secret, this.env.ENCRYPTION_KEY || this.env.JWT_SECRET || '');
        const period = Number(vaultItem.period || 30);
        const remainingSeconds = period - (Math.floor(now / 1000) % period);
        const itemView = {
            service: vaultItem.service,
            account: vaultItem.account,
            ...(typeof decryptedSecret === 'string' && decryptedSecret ? {
                otp: {
                    code: await generate(
                        decryptedSecret,
                        period,
                        Number(vaultItem.digits || 6),
                        vaultItem.algorithm || 'SHA1',
                        vaultItem.type || 'totp',
                        now,
                    ),
                    period,
                    remainingSeconds,
                },
            } : {}),
        };

        await this.shareRepository.markAccessed(share.id, now);
        await this.shareRepository.insertAuditEvent({
            id: createId('share-audit'),
            shareId: share.id,
            eventType: 'access_granted',
            actorType: 'recipient',
            eventAt: now,
            ownerId: share.ownerId,
            ipHash: null,
            userAgentHash: null,
            metadata: toMetadata({
                accessedAt: now,
                status: 'active',
            }),
        });

        return {
            accessible: true,
            status: 'active',
            share: null,
            itemView,
            publicHeaders,
        };
    }
}

export function createShareService(env: EnvBindings, db: any = env.DB): ShareService {
    const vaultRepository = new VaultRepository(db);
    const shareRepository = new ShareRepository(db);
    return new ShareService(env, vaultRepository, shareRepository);
}
