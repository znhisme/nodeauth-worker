import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppError } from '@/app/config';
import { ShareService } from '@/features/share/shareService';
import { hashShareSecret } from '@/features/share/shareSecurity';

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
            revokeForOwner: vi.fn(),
            markAccessed: vi.fn(),
            insertAuditEvent: vi.fn(),
            enforceRateLimit: vi.fn(),
        };
        service = new ShareService(
            { SHARE_SECRET_PEPPER: 'pepper', JWT_SECRET: 'jwt' } as any,
            vaultRepository,
            shareRepository,
        );
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

    it('serializes successful decisions with public headers and no internal share fields', async () => {
        const accessCode = 'correct-code';
        const accessCodeHash = await hashShareSecret('pepper', 'share-access-code', accessCode);
        const rawToken = 'raw-public-token-123';
        const tokenHash = await hashShareSecret('pepper', 'share-token', rawToken);
        shareRepository.findByTokenHash.mockResolvedValue(makeShareRecord({ tokenHash, accessCodeHash }));
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem());

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
            },
        });
        expect(shareRepository.findByTokenHash).toHaveBeenCalledWith(tokenHash);
        expectRecipientSafeDecision(decision);
        const serializedDecision = JSON.stringify(decision);
        expect(serializedDecision).not.toContain(rawToken);
        expect(serializedDecision).not.toContain('https://');
        expect(serializedDecision).not.toContain('publicUrl');
        expect(serializedDecision).not.toContain('fullUrl');
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
});
