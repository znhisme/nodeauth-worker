import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
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
