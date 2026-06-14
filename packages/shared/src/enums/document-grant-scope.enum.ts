/** Doküman erişim grant kapsamı — Docs/02_DATABASE_SCHEMA.md §document_access_grants */
export const DocumentGrantScope = {
  FULL_ACCESS: 'FULL_ACCESS',
  METADATA_ONLY: 'METADATA_ONLY',
} as const;

export type DocumentGrantScopeCode = (typeof DocumentGrantScope)[keyof typeof DocumentGrantScope];

export const DOCUMENT_GRANT_SCOPE_VALUES = Object.values(
  DocumentGrantScope,
) as readonly DocumentGrantScopeCode[];
