import { AppError, type EnvBindings } from '@/app/config';
import { VaultRepository } from '@/shared/db/repositories/vaultRepository';
import { ShareRepository } from '@/shared/db/repositories/shareRepository';
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
    type CreateShareResult,
    type ResolveShareAccessInput,
    type ShareAccessDecision,
    SHARE_DEFAULT_TTL_SECONDS,
    SHARE_MAX_TTL_SECONDS,
} from '@/features/share/shareTypes';

const textEncoder = new TextEncoder();

function createId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
}

function toMetadata(value: Record<string, unknown>): string {
    return JSON.stringify(value);
}

export class ShareService {
    constructor(
        private env: EnvBindings,
        private vaultRepository: VaultRepository,
        private shareRepository: ShareRepository,
    ) {}

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

        return {
            accessible: true,
            status: 'active',
            share: null,
            itemView: {
                service: vaultItem.service,
                account: vaultItem.account,
            },
            publicHeaders,
            publicUrl: input.requestOrigin ? buildShareUrl(input.requestOrigin, input.token) : undefined,
        };
    }
}

export function createShareService(env: EnvBindings, db: any = env.DB): ShareService {
    const vaultRepository = new VaultRepository(db);
    const shareRepository = new ShareRepository(db);
    return new ShareService(env, vaultRepository, shareRepository);
}
