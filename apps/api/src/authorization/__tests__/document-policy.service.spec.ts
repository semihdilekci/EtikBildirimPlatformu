import { ClearanceLevel, DocumentGrantScope, ErrorCode, Role } from '@ethics/shared';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { DomainException } from '../../common/exceptions/domain.exception.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { DocumentPolicyService } from '../document-policy.service.js';
import type { DocumentAccessContext } from '../document-policy.types.js';
import type { DocumentAccessService } from '../../modules/document/document-access.service.js';

describe('DocumentPolicyService', () => {
  const user: AuthenticatedUser = {
    id: 'user-cs-1',
    email: 'cs@example.com',
    displayName: 'Council Secretary',
    roles: [Role.COUNCIL_SECRETARY],
    clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    companyId: null,
    companyName: null,
    functionId: null,
    locationId: null,
    isGeneralSecretary: true,
  };

  const context: DocumentAccessContext = {
    caseId: 'case-1',
    documentCategory: 'pre_research_note',
    resourceClearanceLevel: ClearanceLevel.SENSITIVE,
  };

  function createService(hasGrant: boolean): DocumentPolicyService {
    const documentAccess = {
      hasActiveGrant: vi.fn().mockResolvedValue(hasGrant),
    } as unknown as DocumentAccessService;

    const service = new DocumentPolicyService({ get: vi.fn() } as never);
    service.wireDocumentAccessServiceForTests(documentAccess);
    return service;
  }

  it('aktif grant ve yeterli clearance ile erişime izin verir', async () => {
    const service = createService(true);
    await expect(service.canAccessDocument(user, 'doc-1', context)).resolves.toEqual({
      allowed: true,
    });
  });

  it('grant yoksa grant_denied döner', async () => {
    const service = createService(false);
    await expect(service.canAccessDocument(user, 'doc-1', context)).resolves.toEqual({
      allowed: false,
      reason: 'grant_denied',
    });
  });

  it('clearance yetersizse clearance_denied döner', async () => {
    const service = createService(true);
    const lowClearanceUser: AuthenticatedUser = {
      ...user,
      clearanceLevel: ClearanceLevel.NORMAL,
    };

    await expect(
      service.canAccessDocument(lowClearanceUser, 'doc-1', {
        ...context,
        resourceClearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
      }),
    ).resolves.toEqual({
      allowed: false,
      reason: 'clearance_denied',
    });
  });

  it('assertDocumentAccess grant yokken AUTHZ_FORBIDDEN fırlatır', async () => {
    const service = createService(false);

    await expect(service.assertDocumentAccess(user, 'doc-1', context)).rejects.toMatchObject({
      code: ErrorCode.AUTHZ_FORBIDDEN,
    });

    try {
      await service.assertDocumentAccess(user, 'doc-1', context);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainException);
      const domainError = error as DomainException;
      expect(domainError.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('assertDocumentAccess maskAsNotFound ile AUTHZ_NOT_FOUND fırlatır', async () => {
    const service = createService(false);

    await expect(
      service.assertDocumentAccess(user, 'doc-1', { ...context, maskAsNotFound: true }),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTHZ_NOT_FOUND,
    });
  });

  it('FULL_ACCESS grant scope indirme için sorgulanır', async () => {
    const documentAccess = {
      hasActiveGrant: vi.fn().mockResolvedValue(true),
    } as unknown as DocumentAccessService;

    const service = new DocumentPolicyService({ get: vi.fn() } as never);
    service.wireDocumentAccessServiceForTests(documentAccess);

    await service.canAccessDocument(user, 'doc-1', context);

    expect(documentAccess.hasActiveGrant).toHaveBeenCalledWith(
      user,
      'doc-1',
      DocumentGrantScope.FULL_ACCESS,
    );
  });
});
