import { drizzle } from 'drizzle-orm/d1';
import app from '@/app/index';
import * as schema from '@/shared/db/schema/sqlite';
import { handleScheduledBackup } from '@/features/backup/backupRoutes';
import { createShareService } from '@/features/share/shareService';
import { migrateDatabase } from '@/shared/db/migrator';
import { D1Executor } from '@/shared/db/d1Executor';

const migrationPromises = new WeakMap<object, Promise<void>>();

async function ensureDatabaseMigrated(d1: any): Promise<void> {
    const executor = new D1Executor(d1);

    if (!d1 || (typeof d1 !== 'object' && typeof d1 !== 'function')) {
        await migrateDatabase(executor);
        return;
    }

    let migration = migrationPromises.get(d1);
    if (!migration) {
        migration = migrateDatabase(executor).catch((error) => {
            migrationPromises.delete(d1);
            throw error;
        });
        migrationPromises.set(d1, migration);
    }

    await migration;
}

export default {
    async fetch(request: Request, env: any, ctx: any) {
        // Initialize D1 driver
        const db = drizzle(env.DB, { schema });

        // Share-link writes depend on the latest schema immediately after deploys.
        // Run migrations before routing so first traffic cannot race new columns/indexes.
        await ensureDatabaseMigrated(env.DB);

        // Pass specialized DB and env vars to agnostic router
        const specializedEnv = {
            ...env,
            DB: db, // Replace D1 with Drizzle ORM instance
            ASSETS: env.ASSETS // Ensure ASSETS exists
        };

        return app.fetch(request, specializedEnv, ctx);
    },

    // Scheduled Backup trigger via Cloudflare Cron
    async scheduled(event: any, env: any, ctx: any) {
        const db = drizzle(env.DB, { schema });
        const specializedEnv = {
            ...env,
            DB: db
        };
        ctx.waitUntil(Promise.all([
            handleScheduledBackup(specializedEnv),
            createShareService(specializedEnv as any).cleanupShareState(),
        ]));
    }
};
