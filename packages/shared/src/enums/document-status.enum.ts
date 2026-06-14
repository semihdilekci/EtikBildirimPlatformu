/** Doküman yaşam döngüsü — Docs/01_DOMAIN_MODEL.md §Document */
export const DocumentStatus = {
  UPLOADED: 'UPLOADED',
  QUARANTINED: 'QUARANTINED',
  AVAILABLE: 'AVAILABLE',
  REJECTED: 'REJECTED',
} as const;

export type DocumentStatusCode = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const DOCUMENT_STATUS_VALUES = Object.values(
  DocumentStatus,
) as readonly DocumentStatusCode[];
