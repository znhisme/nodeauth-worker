import app from '@/app/index'
import { DbFactory } from '@/shared/db/factory'
import { migrateDatabase } from '@/shared/db/migrator'
import { createShareService } from '@/features/share/shareService'

/**
 * NodeAuth 生产级 Netlify 适配器 (Architect V8 - 多 Cookie 修复版)
 * 
 * 1. 核心修复：引入 multiValueHeaders 支持，解决多个 Set-Cookie 相互覆盖导致的登录失效。
 * 2. 数据库自愈：保持连接异常自动清理缓存逻辑。
 * 3. 路径与环境：维持 process.env 合并与路径还原逻辑。
 */

let cachedDb: any = null;
const SHARE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastShareCleanupAt = 0;

export const handler = async (event: any, context: any) => {
    try {
        // --- 1. 数据库初始化与迁移阻断 ---
        if (!cachedDb) {
            console.log('📡 [DB] Initializing new connection pool...');
            const { db, executor } = await DbFactory.create();
            cachedDb = { db, executor };
            
            if (db && typeof db.on === 'function') {
                db.on('error', (err: any) => {
                    console.error('📡 [DB Pool] Background Error:', err.message);
                    cachedDb = null;
                });
            }
            
            try {
                await migrateDatabase(executor);
            } catch (err: any) {
                console.error('🗄️ [DB Migrate] Failed:', err.message);
                cachedDb = null;
                return {
                    statusCode: 503,
                    body: JSON.stringify({ success: false, error: 'Database Initialization Failed', detail: err.message })
                };
            }
        }

        const now = Date.now();
        if (cachedDb?.db && now - lastShareCleanupAt >= SHARE_CLEANUP_INTERVAL_MS) {
            lastShareCleanupAt = now;
            try {
                const result = await createShareService({
                    ...process.env,
                    ...context,
                    DB: cachedDb.db,
                } as any).cleanupShareState(now);
                console.log('[Share Cleanup] Completed', {
                    expiredSharesMarked: result.expiredSharesMarked,
                    staleRateLimitRowsDeleted: result.staleRateLimitRowsDeleted,
                });
            } catch (err: any) {
                console.error('[Share Cleanup] Failed:', err.message || err);
            }
        }

        // --- 2. 构造标准 Request ---
        const host = event.headers.host || event.headers['Host'] || 'localhost';
        const protocol = event.headers['x-forwarded-proto'] || 'https';
        
        let path = event.headers['x-nf-original-path'] || event.path || '/';
        if (path.startsWith('/.netlify/functions/api')) {
            path = path.replace('/.netlify/functions/api', '/api');
        }
        
        const query = event.queryStringParameters ? '?' + new URLSearchParams(event.queryStringParameters).toString() : '';
        const url = `${protocol}://${host}${path}${query}`;

        const request = new Request(url, {
            method: event.httpMethod || 'GET',
            headers: event.headers,
            body: event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body) : undefined
        });

        // --- 3. 执行 Hono 逻辑 ---
        const res = await app.fetch(request, { 
            ...process.env, 
            ...context, 
            DB: cachedDb?.db 
        });

        // --- 4. 构造响应结果 (关键：分离单值与多值 Header) ---
        const headers: Record<string, string> = {};
        const multiValueHeaders: Record<string, string[]> = {};

        res.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'set-cookie') {
                if (!multiValueHeaders['set-cookie']) multiValueHeaders['set-cookie'] = [];
                multiValueHeaders['set-cookie'].push(value);
            } else {
                headers[key] = value;
            }
        });

        const contentType = res.headers.get('content-type') || '';
        let body;
        if (contentType.includes('application/json')) {
            const text = await res.text();
            try {
                body = JSON.stringify(JSON.parse(text));
            } catch {
                body = text;
            }
        } else {
            body = await res.text();
        }

        return {
            statusCode: res.status,
            headers,
            multiValueHeaders,
            body: body
        };

    } catch (err: any) {
        console.error('🛑 [Architect] Runtime Crash:', err);
        const errorMsg = err.message || '';
        if (errorMsg.includes('terminated') || errorMsg.includes('timeout') || errorMsg.includes('Connection')) {
            cachedDb = null;
        }
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: 'Internal Server Error', detail: err.message })
        };
    }
}
