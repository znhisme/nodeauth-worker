import { ShareService, createShareService } from '@/features/share/shareService';
import { shareRateLimit } from '@/shared/middleware/shareRateLimitMiddleware';

/**
 * Keeps Phase 1 share primitives reachable from app bundles without mounting
 * public share routes before the route phase owns that behavior.
 */
export const SHARE_PRIMITIVES = {
    ShareService,
    createShareService,
    shareRateLimit,
};
