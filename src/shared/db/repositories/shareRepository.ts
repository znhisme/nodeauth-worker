import { and, count, desc, eq, gt, isNull, lt, lte, sql } from 'drizzle-orm';
import {
    shareAuditEvents,
    shareLinks,
    shareRateLimits,
    type NewShareAuditEvent,
    type NewShareLink,
    type NewShareRateLimit,
    type ShareLink,
    type ShareRateLimit,
} from '@/shared/db/schema/index';
import { type ShareRateLimitDecision, type ShareRateLimitInput } from '@/features/share/shareTypes';

const ACTIVE_SHARE_REPLACE_MAX_ATTEMPTS = 3;

function createActiveShareKey(ownerId: string, vaultItemId: string): string {
    return `${ownerId}:${vaultItemId}`;
}

function isUniqueConflict(error: unknown): boolean {
    const err = error as { message?: string; code?: string };
    const msg = err.message?.toLowerCase() || '';
    const code = String(err.code || '').toLowerCase();
    return (
        msg.includes('unique') ||
        msg.includes('duplicate') ||
        code === 'er_dup_entry' ||
        code === '23505' ||
        code === '2067'
    );
}

export class ShareRepository {
    constructor(private db: any) {}

    async createShareLink(input: NewShareLink): Promise<ShareLink> {
        await this.db.insert(shareLinks).values(input);
        return await this.findByIdForOwner(input.id as string, input.ownerId as string) as ShareLink;
    }

    async findByTokenHash(tokenHash: string): Promise<ShareLink | null> {
        const result = await this.db
            .select()
            .from(shareLinks)
            .where(eq(shareLinks.tokenHash, tokenHash))
            .limit(1);
        return result[0] || null;
    }

    async findByIdForOwner(id: string, ownerId: string): Promise<ShareLink | null> {
        const result = await this.db
            .select()
            .from(shareLinks)
            .where(and(eq(shareLinks.id, id), eq(shareLinks.ownerId, ownerId)))
            .limit(1);
        return result[0] || null;
    }

    async listForOwner(ownerId: string): Promise<ShareLink[]> {
        return await this.db
            .select()
            .from(shareLinks)
            .where(eq(shareLinks.ownerId, ownerId))
            .orderBy(desc(shareLinks.createdAt));
    }

    async revokeForOwner(id: string, ownerId: string, revokedAt: number): Promise<boolean> {
        const existing = await this.findByIdForOwner(id, ownerId);
        if (!existing || (existing.revokedAt !== null && existing.revokedAt !== undefined)) {
            return false;
        }

        await this.db
            .update(shareLinks)
            .set({ revokedAt })
            .where(and(eq(shareLinks.id, id), eq(shareLinks.ownerId, ownerId), isNull(shareLinks.revokedAt)));

        return true;
    }

    async createReplacingShareLink(input: NewShareLink): Promise<{ share: ShareLink; replacedShares: ShareLink[] }> {
        const revokedAt = Number(input.createdAt);
        const activeShareKey = createActiveShareKey(input.ownerId as string, input.vaultItemId as string);
        const replacedSharesById = new Map<string, ShareLink>();

        for (let attempt = 0; attempt < ACTIVE_SHARE_REPLACE_MAX_ATTEMPTS; attempt += 1) {
            for (const share of await this.revokeActiveForOwnerVaultItem(input.ownerId as string, input.vaultItemId as string, revokedAt)) {
                replacedSharesById.set(share.id, share);
            }

            try {
                const share = await this.createShareLink({
                    ...input,
                    activeShareKey,
                } as NewShareLink);
                return { share, replacedShares: Array.from(replacedSharesById.values()) };
            } catch (error) {
                if (!isUniqueConflict(error) || attempt === ACTIVE_SHARE_REPLACE_MAX_ATTEMPTS - 1) {
                    throw error;
                }
            }
        }

        throw new Error('share_replace_conflict');
    }

    async revokeActiveForOwnerVaultItem(ownerId: string, vaultItemId: string, revokedAt: number): Promise<ShareLink[]> {
        const activeShares = await this.db
            .select()
            .from(shareLinks)
            .where(and(
                eq(shareLinks.ownerId, ownerId),
                eq(shareLinks.vaultItemId, vaultItemId),
                isNull(shareLinks.revokedAt),
                gt(shareLinks.expiresAt, revokedAt),
            ));

        await this.db
            .update(shareLinks)
            .set({ revokedAt, activeShareKey: null })
            .where(and(
                eq(shareLinks.ownerId, ownerId),
                eq(shareLinks.vaultItemId, vaultItemId),
                isNull(shareLinks.revokedAt),
            ));

        return activeShares;
    }

    async markAccessed(id: string, accessedAt: number): Promise<void> {
        await this.db
            .update(shareLinks)
            .set({
                lastAccessedAt: accessedAt,
                accessCount: sql<number>`coalesce(${shareLinks.accessCount}, 0) + 1`,
            })
            .where(eq(shareLinks.id, id));
    }

    async insertAuditEvent(input: NewShareAuditEvent): Promise<void> {
        await this.db.insert(shareAuditEvents).values(input);
    }

    async findExpiredSharesForCleanup(now: number): Promise<ShareLink[]> {
        return await this.db
            .select()
            .from(shareLinks)
            .where(and(lte(shareLinks.expiresAt, now), isNull(shareLinks.revokedAt)));
    }

    async insertExpiredAuditEventIfMissing(share: ShareLink, eventAt: number): Promise<boolean> {
        const existing = await this.db
            .select({ count: count() })
            .from(shareAuditEvents)
            .where(and(eq(shareAuditEvents.shareId, share.id), eq(shareAuditEvents.eventType, 'expired')));

        if (Number(existing[0]?.count || 0) > 0) {
            return false;
        }

        await this.db.insert(shareAuditEvents).values({
            id: `share-audit-${crypto.randomUUID()}`,
            shareId: share.id,
            eventType: 'expired',
            actorType: 'system',
            eventAt,
            ownerId: share.ownerId,
            ipHash: null,
            userAgentHash: null,
            metadata: JSON.stringify({
                expiredAt: eventAt,
                expiresAt: share.expiresAt,
                status: 'expired',
            }),
        });

        return true;
    }

    async deleteStaleRateLimits(cutoff: number): Promise<number> {
        const conditions = lt(shareRateLimits.lastAttemptAt, cutoff);

        const countRes = await this.db.select().from(shareRateLimits).where(conditions);

        await this.db
            .delete(shareRateLimits)
            .where(conditions);

        return countRes.length;
    }

    async enforceRateLimit(input: ShareRateLimitInput): Promise<ShareRateLimitDecision> {
        const now = input.now ?? Date.now();
        const existing = await this.db
            .select()
            .from(shareRateLimits)
            .where(eq(shareRateLimits.key, input.key))
            .limit(1);
        const current = existing[0] as ShareRateLimit | undefined;

        if (!current) {
            await this.db.insert(shareRateLimits).values({
                key: input.key,
                shareId: input.shareId,
                attempts: 1,
                windowStartedAt: now,
                lastAttemptAt: now,
                lockedUntil: null,
            } as NewShareRateLimit);
            return { allowed: true, attempts: 1, lockedUntil: null };
        }

        if (current.lockedUntil && current.lockedUntil > now) {
            return { allowed: false, attempts: current.attempts || 0, lockedUntil: current.lockedUntil };
        }

        const windowExpired = now - current.windowStartedAt >= input.windowMs;
        const attempts = windowExpired ? 1 : (current.attempts || 0) + 1;
        const lockedUntil = attempts > input.maxAttempts ? now + input.lockMs : null;

        await this.db
            .update(shareRateLimits)
            .set({
                shareId: input.shareId,
                attempts,
                windowStartedAt: windowExpired ? now : current.windowStartedAt,
                lastAttemptAt: now,
                lockedUntil,
            })
            .where(eq(shareRateLimits.key, input.key));

        return {
            allowed: lockedUntil === null,
            attempts,
            lockedUntil,
        };
    }
}
