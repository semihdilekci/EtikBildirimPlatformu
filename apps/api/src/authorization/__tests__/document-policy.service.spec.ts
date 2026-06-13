import { ClearanceLevel, ErrorCode, Role } from '@ethics/shared';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { DomainException } from '../../common/exceptions/domain.exception.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { DocumentPolicyService } from '../document-policy.service.js';
import type { DocumentAccessContext } from '../document-policy.types.js';

describe('DocumentPolicyService', () => {
  const service = new DocumentPolicyService();

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
    documentCategory: 'report_attachment',
    resourceClearanceLevel: ClearanceLevel.SENSITIVE,
  };

  it('iskelet implementasyon deny-by-default döner', () => {
    expect(service.canAccessDocument(user, 'doc-1', context)).toEqual({
      allowed: false,
      reason: 'not_implemented',
    });
  });

  it('assertDocumentAccess yetkisiz erişimde AUTHZ_FORBIDDEN fırlatır', () => {
    expect(() => service.assertDocumentAccess(user, 'doc-1', context)).toThrow(DomainException);

    try {
      service.assertDocumentAccess(user, 'doc-1', context);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainException);
      const domainError = error as DomainException;
      expect(domainError.code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
      expect(domainError.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('assertDocumentAccess maskAsNotFound ile AUTHZ_NOT_FOUND fırlatır', () => {
    try {
      service.assertDocumentAccess(user, 'doc-1', { ...context, maskAsNotFound: true });
    } catch (error) {
      expect(error).toBeInstanceOf(DomainException);
      const domainError = error as DomainException;
      expect(domainError.code).toBe(ErrorCode.AUTHZ_NOT_FOUND);
      expect(domainError.getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });
});
