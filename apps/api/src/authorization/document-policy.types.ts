import {
  DocumentGrantScope,
  type ClearanceLevel,
  type DocumentGrantScopeCode,
} from '@ethics/shared';

/** Faz 7 document_access_grant entegrasyonu için erişim bağlamı */
export type DocumentAccessContext = {
  caseId: string;
  documentCategory: string;
  resourceClearanceLevel: ClearanceLevel;
  requiredGrantScope?: DocumentGrantScopeCode;
  /** Bilgi sızıntısı riski: kaynak var ama erişim yok → 404 */
  maskAsNotFound?: boolean;
};

export const DEFAULT_DOCUMENT_DOWNLOAD_GRANT_SCOPE = DocumentGrantScope.FULL_ACCESS;
