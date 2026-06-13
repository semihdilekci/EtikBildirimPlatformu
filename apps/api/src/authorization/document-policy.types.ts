import type { ClearanceLevel } from '@ethics/shared';

/** Faz 7 document_access_grant entegrasyonu için erişim bağlamı */
export type DocumentAccessContext = {
  caseId: string;
  documentCategory: string;
  resourceClearanceLevel: ClearanceLevel;
  /** Bilgi sızıntısı riski: kaynak var ama grant yok → 404 */
  maskAsNotFound?: boolean;
};
