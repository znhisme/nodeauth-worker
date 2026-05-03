import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AppError } from '@/app/config';
import { ShareService } from '@/features/share/shareService';
import { hashShareSecret } from '@/features/share/shareSecurity';
import * as dbModule from '@/shared/db/db';
import * as otpModule from '@/shared/utils/otp';

const makeVaultItem = (overrides: any = {}) => ({
    id: 'vault-1',
    service: 'GitHub',
    account: 'user@example.com',
    category: '',
    secret: 'secret',
    digits: 6,
    period: 30,
    type: 'totp',
    algorithm: 'SHA1',
    counter: 0,
    createdAt: 1000,
    createdBy: 'owner-1',
    updatedAt: 1000,
    deletedAt: null,
    ...overrides,
});

const makeShareRecord = (overrides: any = {}) => ({
    id: 'share-1',
    ownerId: 'owner-1',
    vaultItemId: 'vault-1',
    tokenHash: 'token-hash',
    accessCodeHash: 'access-hash',
    expiresAt: 2000,
    revokedAt: null,
    createdAt: 1000,
    lastAccessedAt: null,
    accessCount: 0,
    ...overrides,
});

const expectRecipientSafeDecision = (decision: any) => {
    const serialized = JSON.stringify(decision);
    expect(serialized).not.toContain('ownerId');
    expect(serialized).not.toContain('vaultItemId');
    expect(serialized).not.toContain('tokenHash');
    expect(serialized).not.toContain('accessCodeHash');
    expect(decision.publicHeaders).toEqual({
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        'Referrer-Policy': 'no-referrer',
    });
};

const forbiddenRecipientValues = [
    'ownerId',
    'vaultItemId',
    'tokenHash',
    'accessCodeHash',
    'raw-public-token-123',
    'correct-code',
    'wrong-code',
    'password',
    'seed',
    'otpauth',
    'backup',
    'session',
    'http://',
    'https://',
];

const expectPublicInaccessibleDecision = (decision: any, rawToken = 'raw-public-token-123', accessCode = 'correct-code') => {
    expect(decision).toMatchObject({
        accessible: false,
        reason: 'inaccessible',
        share: null,
        itemView: null,
    });
    expect(decision.publicHeaders).toEqual({
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        'Referrer-Policy': 'no-referrer',
    });

    const serialized = JSON.stringify(decision);
    for (const forbidden of [
        ...forbiddenRecipientValues,
        rawToken,
        accessCode,
    ]) {
        expect(serialized).not.toContain(forbidden);
    }
};

const expectSafeAuditEvent = (auditEvent: any, forbiddenValues: string[]) => {
    const serialized = JSON.stringify(auditEvent);
    for (const value of forbiddenValues) {
        expect(serialized).not.toContain(value);
    }
};

describe('ShareService', () => {
    let vaultRepository: any;
    let shareRepository: any;
    let service: ShareService;

    beforeEach(() => {
        vaultRepository = {
            findActiveByIdForOwner: vi.fn(),
        };
        shareRepository = {
            createShareLink: vi.fn(),
            findByTokenHash: vi.fn(),
            findByIdForOwner: vi.fn(),
            listForOwner: vi.fn(),
            revokeForOwner: vi.fn(),
            markAccessed: vi.fn(),
            insertAuditEvent: vi.fn(),
            enforceRateLimit: vi.fn(),
            findExpiredSharesForCleanup: vi.fn(),
            insertExpiredAuditEventIfMissing: vi.fn(),
            deleteStaleRateLimits: vi.fn(),
        };
        service = new ShareService(
            { SHARE_SECRET_PEPPER: 'pepper', JWT_SECRET: 'jwt' } as any,
            vaultRepository,
            shareRepository,
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rejects a missing vault item with share_item_inaccessible', async () => {
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(null);

        await expect(service.createShare({
            ownerId: 'owner-1',
            vaultItemId: 'vault-1',
        })).rejects.toMatchObject({ name: 'AppError', message: 'share_item_inaccessible' });
    });

    it('rejects a deleted vault item with share_item_inaccessible', async () => {
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(null);

        await expect(service.createShare({
            ownerId: 'owner-1',
            vaultItemId: 'vault-1',
        })).rejects.toMatchObject({ name: 'AppError', message: 'share_item_inaccessible' });
    });

    it('rejects a vault item owned by another user with share_item_inaccessible', async () => {
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(null);

        await expect(service.createShare({
            ownerId: 'owner-1',
            vaultItemId: 'vault-1',
        })).rejects.toMatchObject({ name: 'AppError', message: 'share_item_inaccessible' });
    });

    it('stores only hashed share secrets', async () => {
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem());
        shareRepository.createShareLink.mockResolvedValue({
            id: 'share-1',
            vaultItemId: 'vault-1',
            ownerId: 'owner-1',
            tokenHash: 'stored-token-hash',
            accessCodeHash: 'stored-access-code-hash',
            expiresAt: 2000,
            revokedAt: null,
            createdAt: 1000,
            lastAccessedAt: null,
            accessCount: 0,
        });

        const result = await service.createShare({
            ownerId: 'owner-1',
            vaultItemId: 'vault-1',
            now: 1000,
            expiresAt: 2000,
        } as any);

        expect(result.rawToken).toBeTruthy();
        expect(result.rawAccessCode).toBeTruthy();
        const createInput = shareRepository.createShareLink.mock.calls[0][0];
        expect(createInput.tokenHash).not.toBe(result.rawToken);
        expect(createInput.accessCodeHash).not.toBe(result.rawAccessCode);
        expect(createInput.tokenHash).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(createInput.accessCodeHash).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(JSON.stringify(createInput)).not.toContain(result.rawToken);
        expect(JSON.stringify(createInput)).not.toContain(result.rawAccessCode);
    });

    it('serializes owner metadata without forbidden secret fields and with descending status coverage', async () => {
        shareRepository.listForOwner.mockResolvedValue([
            makeShareRecord({
                id: 'share-active',
                expiresAt: 2000,
                revokedAt: null,
                createdAt: 3000,
                lastAccessedAt: 3500,
                accessCount: 2,
            }),
            makeShareRecord({
                id: 'share-expired',
                expiresAt: 900,
                revokedAt: null,
                createdAt: 2000,
                lastAccessedAt: null,
                accessCount: 1,
            }),
            makeShareRecord({
                id: 'share-revoked',
                expiresAt: 4000,
                revokedAt: 2500,
                createdAt: 1000,
                lastAccessedAt: 2600,
                accessCount: 3,
            }),
        ]);

        vaultRepository.findActiveByIdForOwner
            .mockResolvedValueOnce(makeVaultItem({ id: 'vault-1', service: 'GitHub', account: 'user@example.com' }))
            .mockResolvedValueOnce(makeVaultItem({ id: 'vault-2', service: 'GitLab', account: 'team@example.com' }))
            .mockResolvedValueOnce(makeVaultItem({ id: 'vault-3', service: 'Bitbucket', account: 'ops@example.com' }));

        const views = await service.listSharesForOwner('owner-1', 1000);

        expect(shareRepository.listForOwner).toHaveBeenCalledWith('owner-1');
        expect(views.map((view: any) => view.status)).toEqual(['active', 'expired', 'revoked']);
        expect(JSON.stringify(views)).not.toContain('tokenHash');
        expect(JSON.stringify(views)).not.toContain('accessCodeHash');
        expect(JSON.stringify(views)).not.toContain('rawToken');
        expect(JSON.stringify(views)).not.toContain('rawAccessCode');
        expect(JSON.stringify(views)).not.toContain('password');
        expect(JSON.stringify(views)).not.toContain('secret');
        expect(JSON.stringify(views)).not.toContain('seed');
        expect(JSON.stringify(views)).not.toContain('otp');
        expect(JSON.stringify(views)).not.toContain('ownerId');
        expect(JSON.stringify(views)).not.toContain('session');
    });

    it('serializes owner detail and revoke views without forbidden secret fields', async () => {
        shareRepository.findByIdForOwner.mockResolvedValueOnce(makeShareRecord({
            id: 'share-1',
            expiresAt: 2000,
            revokedAt: null,
            createdAt: 1000,
            lastAccessedAt: 1500,
            accessCount: 4,
        }));
        shareRepository.findByIdForOwner.mockResolvedValueOnce(makeShareRecord({
            id: 'share-1',
            expiresAt: 2000,
            revokedAt: 1000,
            createdAt: 1000,
            lastAccessedAt: 1500,
            accessCount: 4,
        }));
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem({
            id: 'vault-1',
            service: 'GitHub',
            account: 'user@example.com',
        }));
        shareRepository.revokeForOwner.mockResolvedValue(true);

        const detail = await service.getShareForOwner('owner-1', 'share-1', 1000);
        const revoked = await service.revokeShareForOwner('owner-1', 'share-1', 1000);

        expect(shareRepository.findByIdForOwner).toHaveBeenCalledWith('share-1', 'owner-1');
        expect(JSON.stringify(detail)).not.toContain('tokenHash');
        expect(JSON.stringify(detail)).not.toContain('accessCodeHash');
        expect(JSON.stringify(detail)).not.toContain('rawToken');
        expect(JSON.stringify(detail)).not.toContain('rawAccessCode');
        expect(JSON.stringify(detail)).not.toContain('password');
        expect(JSON.stringify(detail)).not.toContain('secret');
        expect(JSON.stringify(detail)).not.toContain('seed');
        expect(JSON.stringify(detail)).not.toContain('otp');
        expect(JSON.stringify(detail)).not.toContain('ownerId');
        expect(JSON.stringify(detail)).not.toContain('session');
        expect(JSON.stringify(revoked)).toContain('"status":"revoked"');
        expect(JSON.stringify(revoked)).not.toContain('tokenHash');
        expect(JSON.stringify(revoked)).not.toContain('accessCodeHash');
        expect(JSON.stringify(revoked)).not.toContain('rawToken');
        expect(JSON.stringify(revoked)).not.toContain('rawAccessCode');
    });

    it('returns inaccessible for expired revoked deleted-item and wrong-code cases', async () => {
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord({ expiresAt: 900 }));
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem());

        await expect(service.resolveShareAccess({
            token: 'token',
            accessCode: 'code',
            now: 1000,
        } as any)).resolves.toMatchObject({ accessible: false, reason: 'inaccessible' });

        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord({ revokedAt: 1000 }));

        await expect(service.resolveShareAccess({
            token: 'token',
            accessCode: 'code',
            now: 1000,
        } as any)).resolves.toMatchObject({ accessible: false, reason: 'inaccessible' });

        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord());
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(null);

        await expect(service.resolveShareAccess({
            token: 'token',
            accessCode: 'code',
            now: 1000,
        } as any)).resolves.toMatchObject({ accessible: false, reason: 'inaccessible' });

        vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem());
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord());

        await expect(service.resolveShareAccess({
            token: 'token',
            accessCode: 'wrong-code',
            now: 1000,
        } as any)).resolves.toMatchObject({ accessible: false, reason: 'inaccessible' });
    });

    it('serializes missing inaccessible decisions with public headers and no internal share fields', async () => {
        shareRepository.findByTokenHash.mockResolvedValue(null);

        const decision = await service.resolveShareAccess({
            token: 'token',
            accessCode: 'code',
            now: 1000,
        } as any);

        expect(decision).toMatchObject({ accessible: false, reason: 'inaccessible' });
        expectRecipientSafeDecision(decision);
    });

    it('missing token hash / token enumeration resolves inaccessible without share data', async () => {
        const rawToken = 'raw-public-token-123';
        shareRepository.findByTokenHash.mockResolvedValue(null);

        const decision = await service.resolveShareAccess({
            token: rawToken,
            accessCode: 'correct-code',
            now: 1000,
        } as any);

        expectPublicInaccessibleDecision(decision, rawToken);
        expect(vaultRepository.findActiveByIdForOwner).not.toHaveBeenCalled();
        expect(shareRepository.markAccessed).not.toHaveBeenCalled();
    });

    it('serializes expired decisions with public headers and no internal share fields', async () => {
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord({ expiresAt: 900 }));

        const decision = await service.resolveShareAccess({
            token: 'token',
            accessCode: 'code',
            now: 1000,
        } as any);

        expect(decision).toMatchObject({ accessible: false, status: 'expired', reason: 'inaccessible' });
        expectRecipientSafeDecision(decision);
    });

    it('expired share resolves inaccessible before vault lookup', async () => {
        const rawToken = 'raw-public-token-123';
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord({ expiresAt: 900 }));

        const decision = await service.resolveShareAccess({
            token: rawToken,
            accessCode: 'correct-code',
            now: 1000,
        } as any);

        expectPublicInaccessibleDecision(decision, rawToken);
        expect(decision.status).toBe('expired');
        expect(vaultRepository.findActiveByIdForOwner).not.toHaveBeenCalled();
    });

    it('serializes revoked decisions with public headers and no internal share fields', async () => {
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord({ revokedAt: 1000 }));

        const decision = await service.resolveShareAccess({
            token: 'token',
            accessCode: 'code',
            now: 1000,
        } as any);

        expect(decision).toMatchObject({ accessible: false, status: 'revoked', reason: 'inaccessible' });
        expectRecipientSafeDecision(decision);
    });

    it('revoked share resolves inaccessible without secret processing', async () => {
        const rawToken = 'raw-public-token-123';
        const decryptSpy = vi.spyOn(dbModule, 'decryptField');
        const generateSpy = vi.spyOn(otpModule, 'generate');
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord({ revokedAt: 1000 }));

        const decision = await service.resolveShareAccess({
            token: rawToken,
            accessCode: 'correct-code',
            now: 1000,
        } as any);

        expectPublicInaccessibleDecision(decision, rawToken);
        expect(decision.status).toBe('revoked');
        expect(decryptSpy).not.toHaveBeenCalled();
        expect(generateSpy).not.toHaveBeenCalled();
    });

    it('serializes deleted-item decisions with public headers and no internal share fields', async () => {
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord());
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(null);

        const decision = await service.resolveShareAccess({
            token: 'token',
            accessCode: 'code',
            now: 1000,
        } as any);

        expect(decision).toMatchObject({ accessible: false, reason: 'inaccessible' });
        expectRecipientSafeDecision(decision);
    });

    it('deleted item resolves inaccessible without decrypting', async () => {
        const rawToken = 'raw-public-token-123';
        const decryptSpy = vi.spyOn(dbModule, 'decryptField');
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord());
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(null);

        const decision = await service.resolveShareAccess({
            token: rawToken,
            accessCode: 'correct-code',
            now: 1000,
        } as any);

        expectPublicInaccessibleDecision(decision, rawToken);
        expect(vaultRepository.findActiveByIdForOwner).toHaveBeenCalledWith('vault-1', 'owner-1');
        expect(decryptSpy).not.toHaveBeenCalled();
    });

    it('serializes wrong-code decisions with public headers and no internal share fields', async () => {
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord());
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem());

        const decision = await service.resolveShareAccess({
            token: 'token',
            accessCode: 'wrong-code',
            now: 1000,
        } as any);

        expect(decision).toMatchObject({ accessible: false, status: 'active', reason: 'inaccessible' });
        expectRecipientSafeDecision(decision);
    });

    it('wrong code resolves inaccessible without decrypting or generating OTP', async () => {
        const rawToken = 'raw-public-token-123';
        const decryptSpy = vi.spyOn(dbModule, 'decryptField');
        const generateSpy = vi.spyOn(otpModule, 'generate');
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord());
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem());

        const decision = await service.resolveShareAccess({
            token: rawToken,
            accessCode: 'wrong-code',
            now: 1000,
        } as any);

        expectPublicInaccessibleDecision(decision, rawToken, 'wrong-code');
        expect(decision.status).toBe('active');
        expect(decryptSpy).not.toHaveBeenCalled();
        expect(generateSpy).not.toHaveBeenCalled();
    });

    it('wrong owner uses the share owner for vault lookup instead of request-owner data', async () => {
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord({
            ownerId: 'real-owner@example.com',
            vaultItemId: 'vault-owned-by-real-owner',
        }));
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(null);

        const decision = await service.resolveShareAccess({
            token: 'raw-public-token-123',
            accessCode: 'correct-code',
            ownerId: 'attacker@example.com',
            now: 1000,
        } as any);

        expectPublicInaccessibleDecision(decision);
        expect(vaultRepository.findActiveByIdForOwner)
            .toHaveBeenCalledWith('vault-owned-by-real-owner', 'real-owner@example.com');
        expect(JSON.stringify(vaultRepository.findActiveByIdForOwner.mock.calls)).not.toContain('attacker@example.com');
    });

    it('serializes successful decisions with public headers and no internal share fields', async () => {
        const accessCode = 'correct-code';
        const accessCodeHash = await hashShareSecret('pepper', 'share-access-code', accessCode);
        const rawToken = 'raw-public-token-123';
        const tokenHash = await hashShareSecret('pepper', 'share-token', rawToken);
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord({ tokenHash, accessCodeHash }));
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem({
            secret: await dbModule.encryptField('JBSWY3DPEHPK3PXP', 'jwt'),
        }));

        const decision = await service.resolveShareAccess({
            token: rawToken,
            accessCode,
            requestOrigin: 'https://example.test',
            now: 1000,
        } as any);

        expect(decision).toMatchObject({
            accessible: true,
            status: 'active',
            itemView: {
                service: 'GitHub',
                account: 'user@example.com',
                otp: {
                    code: expect.any(String),
                    period: 30,
                    remainingSeconds: 29,
                },
            },
        });
        expect(shareRepository.findByTokenHash).toHaveBeenCalledWith(tokenHash);
        expectRecipientSafeDecision(decision);
        const serializedDecision = JSON.stringify(decision);
        expect(serializedDecision).not.toContain(rawToken);
        expect(serializedDecision).not.toContain('https://');
        expect(serializedDecision).not.toContain('publicUrl');
        expect(serializedDecision).not.toContain('fullUrl');
        expect(serializedDecision).not.toContain('seed');
        expect(serializedDecision).not.toContain('otpauth');
        expect(vaultRepository.findActiveByIdForOwner).toHaveBeenCalledWith('vault-1', 'owner-1');
        expect(shareRepository.markAccessed).toHaveBeenCalledWith('share-1', 1000);
        expect(shareRepository.insertAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            shareId: 'share-1',
            eventType: 'access_granted',
            actorType: 'recipient',
            eventAt: 1000,
            ownerId: 'owner-1',
            ipHash: null,
            userAgentHash: null,
        }));
        const accessAuditEvent = shareRepository.insertAuditEvent.mock.calls[shareRepository.insertAuditEvent.mock.calls.length - 1]?.[0];
        expectSafeAuditEvent(accessAuditEvent, [
            rawToken,
            accessCode,
            'password',
            'seed',
            'otpauth',
            'http://',
            'https://',
            'publicUrl',
            'fullUrl',
            'accessCode',
            'token',
        ]);
        expect(accessAuditEvent.metadata).toBe(JSON.stringify({
            accessedAt: 1000,
            status: 'active',
        }));
    });

    it('wrong-code access does not decrypt or generate OTP output', async () => {
        const decryptSpy = vi.spyOn(dbModule, 'decryptField');
        const generateSpy = vi.spyOn(otpModule, 'generate');
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord());
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem());

        const decision = await service.resolveShareAccess({
            token: 'token',
            accessCode: 'wrong-code',
            now: 1000,
        } as any);

        expect(decision).toMatchObject({
            accessible: false,
            status: 'active',
            reason: 'inaccessible',
            itemView: null,
        });
        expect(decryptSpy).not.toHaveBeenCalled();
        expect(generateSpy).not.toHaveBeenCalled();
        expect(shareRepository.markAccessed).not.toHaveBeenCalled();
        expect(shareRepository.insertAuditEvent).not.toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'access_granted',
        }));
    });

    it('correct-code access decrypts once, generates OTP, marks accessed, and records a safe audit event', async () => {
        const accessCode = 'correct-code';
        const accessCodeHash = await hashShareSecret('pepper', 'share-access-code', accessCode);
        const rawToken = 'raw-public-token-123';
        const tokenHash = await hashShareSecret('pepper', 'share-token', rawToken);
        const decryptSpy = vi.spyOn(dbModule, 'decryptField');
        const generateSpy = vi.spyOn(otpModule, 'generate');
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord({ tokenHash, accessCodeHash }));
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem({
            secret: await dbModule.encryptField('JBSWY3DPEHPK3PXP', 'jwt'),
        }));

        const decision = await service.resolveShareAccess({
            token: rawToken,
            accessCode,
            now: 1000,
        } as any);

        expect(decision).toMatchObject({
            accessible: true,
            status: 'active',
            itemView: {
                service: 'GitHub',
                account: 'user@example.com',
                otp: {
                    code: expect.any(String),
                    period: 30,
                    remainingSeconds: 29,
                },
            },
        });
        expect(decryptSpy).toHaveBeenCalledTimes(1);
        expect(generateSpy).toHaveBeenCalledTimes(1);
        expect(shareRepository.markAccessed).toHaveBeenCalledWith('share-1', 1000);
        expect(shareRepository.insertAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            shareId: 'share-1',
            eventType: 'access_granted',
            actorType: 'recipient',
            eventAt: 1000,
            ownerId: 'owner-1',
        }));
        expectRecipientSafeDecision(decision);
    });

    it('records an expired audit event before returning an inaccessible expired decision', async () => {
        const rawToken = 'raw-public-token-123';
        const tokenHash = await hashShareSecret('pepper', 'share-token', rawToken);
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord({
            tokenHash,
            expiresAt: 999,
        }));

        const decision = await service.resolveShareAccess({
            token: rawToken,
            accessCode: 'correct-code',
            now: 1000,
        } as any);

        expect(decision).toMatchObject({
            accessible: false,
            status: 'expired',
            reason: 'inaccessible',
            share: null,
            itemView: null,
        });
        expect(shareRepository.findByTokenHash).toHaveBeenCalledWith(tokenHash);
        expect(vaultRepository.findActiveByIdForOwner).not.toHaveBeenCalled();
        expect(shareRepository.insertAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            shareId: 'share-1',
            eventType: 'expired',
            actorType: 'system',
            eventAt: 1000,
            ownerId: 'owner-1',
            ipHash: null,
            userAgentHash: null,
        }));
        const expiredAuditEvent = shareRepository.insertAuditEvent.mock.calls[shareRepository.insertAuditEvent.mock.calls.length - 1]?.[0];
        expectSafeAuditEvent(expiredAuditEvent, [
            rawToken,
            'correct-code',
            'password',
            'seed',
            'otpauth',
            'http://',
            'https://',
            'publicUrl',
            'fullUrl',
            'accessCode',
            'token',
        ]);
        expect(expiredAuditEvent.metadata).toBe(JSON.stringify({
            expiredAt: 1000,
            expiresAt: 999,
            status: 'expired',
        }));
    });

    it('revokes a share and records a safe audit event', async () => {
        shareRepository.revokeForOwner.mockResolvedValue(true);

        await service.revokeShare('owner-1', 'share-1', 1000);

        expect(shareRepository.revokeForOwner).toHaveBeenCalledWith('share-1', 'owner-1', 1000);
        expect(shareRepository.insertAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'revoked',
            actorType: 'owner',
            shareId: 'share-1',
        }));
        expect(JSON.stringify(shareRepository.insertAuditEvent.mock.calls[0][0])).not.toContain('rawToken');
        expect(JSON.stringify(shareRepository.insertAuditEvent.mock.calls[0][0])).not.toContain('rawAccessCode');
        expect(JSON.stringify(shareRepository.insertAuditEvent.mock.calls[0][0])).not.toContain('password');
        expect(JSON.stringify(shareRepository.insertAuditEvent.mock.calls[0][0])).not.toContain('seed');
    });

    it('rejects missing wrong-owner and already-revoked revoke attempts without audit', async () => {
        shareRepository.revokeForOwner.mockResolvedValue(false);

        await expect(service.revokeShare('owner-1', 'share-1', 1000))
            .rejects.toMatchObject({ name: 'AppError', message: 'share_item_inaccessible', statusCode: 404 });

        expect(shareRepository.insertAuditEvent).not.toHaveBeenCalled();
    });

    it('cleanupShareState records expired shares and deletes stale rate-limit rows once', async () => {
        const expiredShares = [
            makeShareRecord({ id: 'share-1', expiresAt: 900 }),
            makeShareRecord({ id: 'share-2', expiresAt: 800 }),
        ];
        shareRepository.findExpiredSharesForCleanup.mockResolvedValue(expiredShares);
        shareRepository.insertExpiredAuditEventIfMissing
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
        shareRepository.deleteStaleRateLimits.mockResolvedValue(3);

        const result = await service.cleanupShareState(1700000000000);

        expect(shareRepository.findExpiredSharesForCleanup).toHaveBeenCalledWith(1700000000000);
        expect(shareRepository.insertExpiredAuditEventIfMissing).toHaveBeenNthCalledWith(1, expiredShares[0], 1700000000000);
        expect(shareRepository.insertExpiredAuditEventIfMissing).toHaveBeenNthCalledWith(2, expiredShares[1], 1700000000000);
        expect(shareRepository.deleteStaleRateLimits).toHaveBeenCalledWith(1699998200000);
        expect(result).toEqual({
            expiredSharesMarked: 1,
            staleRateLimitRowsDeleted: 3,
            ranAt: 1700000000000,
        });
    });

    it('cleanupShareState returns a count-only idempotent shape without sensitive values', async () => {
        shareRepository.findExpiredSharesForCleanup.mockResolvedValue([
            makeShareRecord({
                id: 'share-raw-public-token',
                ownerId: 'owner@example.com',
                vaultItemId: 'GitHub',
                tokenHash: 'tokenHash',
                accessCodeHash: 'accessCode',
            }),
        ]);
        shareRepository.insertExpiredAuditEventIfMissing.mockResolvedValue(false);
        shareRepository.deleteStaleRateLimits.mockResolvedValue(0);

        const first = await service.cleanupShareState(1700000000000);
        const second = await service.cleanupShareState(1700000000000);

        expect(first).toEqual(second);
        expect(Object.keys(first).sort()).toEqual(['expiredSharesMarked', 'ranAt', 'staleRateLimitRowsDeleted']);
        const serialized = JSON.stringify(first);
        for (const forbidden of [
            'share-',
            'raw-public-token',
            'accessCode',
            'tokenHash',
            'owner@example.com',
            'GitHub',
            'password',
            'seed',
            'otpauth',
        ]) {
            expect(serialized).not.toContain(forbidden);
        }
    });
});
