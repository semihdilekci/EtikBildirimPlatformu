import { ErrorCode } from '@ethics/shared';
import { HttpStatus, Injectable } from '@nestjs/common';

import { DomainException } from '../common/exceptions/domain.exception.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type.js';
import type { DocumentAccessContext } from './document-policy.types.js';

export type DocumentAccessResult =
  | { allowed: true }
  | { allowed: false; reason: 'grant_denied' | 'not_implemented' };

/**
 * Doküman erişim politikası iskeleti — Faz 7'de grant modeli ile doldurulacak.
 * Deny-by-default: vaka erişimi tek başına doküman erişimi vermez.
 */
@Injectable()
export class DocumentPolicyService {
  canAccessDocument(
    _user: AuthenticatedUser,
    _documentId: string,
    _context: DocumentAccessContext,
  ): DocumentAccessResult {
    return { allowed: false, reason: 'not_implemented' };
  }

  assertDocumentAccess(
    user: AuthenticatedUser,
    documentId: string,
    context: DocumentAccessContext,
  ): void {
    const result = this.canAccessDocument(user, documentId, context);

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
