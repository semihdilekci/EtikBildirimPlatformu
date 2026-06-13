export const AuditEventCategory = {
  AUTH: 'AUTH',
  AUTHZ: 'AUTHZ',
  WORKFLOW: 'WORKFLOW',
  DOCUMENT: 'DOCUMENT',
  CONFIG: 'CONFIG',
  TRACKING: 'TRACKING',
  SYSTEM: 'SYSTEM',
  INTAKE: 'INTAKE',
} as const;

export type AuditEventCategoryCode = (typeof AuditEventCategory)[keyof typeof AuditEventCategory];

export const AUDIT_EVENT_CATEGORY_VALUES = Object.values(AuditEventCategory);
