export const AuditSeverity = {
  INFO: 'INFO',
  WARN: 'WARN',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type AuditSeverityCode = (typeof AuditSeverity)[keyof typeof AuditSeverity];

export const AUDIT_SEVERITY_VALUES = Object.values(AuditSeverity);
