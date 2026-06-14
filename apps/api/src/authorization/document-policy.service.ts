import { ErrorCode } from '@ethics/shared';
import { isClearanceSufficient } from '@ethics/policy';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { lazyProviderToken } from '../common/utils/lazy-provider-token.util.js';
import { DomainException } from '../common/exceptions/domain.exception.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type.js';
import type { DocumentAccessService } from '../modules/document/document-access.service.js';
import {
  DEFAULT_DOCUMENT_DOWNLOAD_GRANT_SCOPE,
  type DocumentAccessContext,
} from './document-policy.types.js';

export type DocumentAccessResult =
  | { allowed: true }
  | { allowed: false; reason: 'grant_denied' | 'clearance_denied' };

/**
 * Doküman erişim politikası — deny-by-default.
 * Vaka erişimi tek başına doküman erişimi vermez; aktif grant zorunludur.
 */
@Injectable()
export class DocumentPolicyService {
  private documentAccessRef: DocumentAccessService | null = null;

  constructor(private readonly moduleRef: ModuleRef) {}

  wireDocumentAccessServiceForTests(documentAccess: DocumentAccessService): void {
    this.documentAccessRef = documentAccess;
  }

  private get documentAccess(): DocumentAccessService {
    if (this.documentAccessRef) {
      return this.documentAccessRef;
    }

    return this.moduleRef.get(
      lazyProviderToken<DocumentAccessService>(
        '../modules/document/document-access.service.js',
        'DocumentAccessService',
      ),
      { strict: false },
    );
  }

  async canAccessDocument(
    user: AuthenticatedUser,
    documentId: string,
    context: DocumentAccessContext,
  ): Promise<DocumentAccessResult> {
    if (!isClearanceSufficient(user.clearanceLevel, context.resourceClearanceLevel)) {
      return { allowed: false, reason: 'clearance_denied' };
    }

    const requiredScope = context.requiredGrantScope ?? DEFAULT_DOCUMENT_DOWNLOAD_GRANT_SCOPE;
    const hasGrant = await this.documentAccess.hasActiveGrant(user, documentId, requiredScope);

    if (!hasGrant) {
      return { allowed: false, reason: 'grant_denied' };
    }

    return { allowed: true };
  }

  async assertDocumentAccess(
    user: AuthenticatedUser,
    documentId: string,
    context: DocumentAccessContext,
  ): Promise<void> {
    const result = await this.canAccessDocument(user, documentId, context);

    if (result.allowed) {
      return;
    }

    if (context.maskAsNotFound) {
      throw new DomainException(
        ErrorCode.AUTHZ_NOT_FOUND,
        'Kaynak bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    throw new DomainException(
      ErrorCode.AUTHZ_FORBIDDEN,
      'Bu dokümana erişim yetkiniz yok.',
      HttpStatus.FORBIDDEN,
    );
  }
}
