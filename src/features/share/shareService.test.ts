import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppError } from '@/app/config';
import { ShareService } from '@/features/share/shareService';

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
        shareRepository.findByTokenHash.mockResolvedValue({
            id: 'share-1',
            ownerId: 'owner-1',
            vaultItemId: 'vault-1',
            tokenHash: 'token-hash',
            accessCodeHash: 'access-hash',
            expiresAt: 900,
            revokedAt: null,
            createdAt: 1000,
            lastAccessedAt: null,
            accessCount: 0,
        });
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem());

        await expect(service.resolveShareAccess({
            token: 'token',
            accessCode: 'code',
            now: 1000,
        } as any)).resolves.toMatchObject({ accessible: false, reason: 'inaccessible' });

        shareRepository.findByTokenHash.mockResolvedValue({
            id: 'share-1',
            ownerId: 'owner-1',
            vaultItemId: 'vault-1',
            tokenHash: 'token-hash',
            accessCodeHash: 'access-hash',
            expiresAt: 2000,
            revokedAt: 1000,
            createdAt: 1000,
            lastAccessedAt: null,
            accessCount: 0,
        });

        await expect(service.resolveShareAccess({
            token: 'token',
            accessCode: 'code',
            now: 1000,
        } as any)).resolves.toMatchObject({ accessible: false, reason: 'inaccessible' });

        shareRepository.findByTokenHash.mockResolvedValue({
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
        });
        vaultRepository.findActiveByIdForOwner.mockResolvedValue(null);

        await expect(service.resolveShareAccess({
            token: 'token',
            accessCode: 'code',
            now: 1000,
        } as any)).resolves.toMatchObject({ accessible: false, reason: 'inaccessible' });

        vaultRepository.findActiveByIdForOwner.mockResolvedValue(makeVaultItem());
        shareRepository.findByTokenHash.mockResolvedValue({
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
        });

        await expect(service.resolveShareAccess({
            token: 'token',
            accessCode: 'wrong-code',
            now: 1000,
        } as any)).resolves.toMatchObject({ accessible: false, reason: 'inaccessible' });
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
});
