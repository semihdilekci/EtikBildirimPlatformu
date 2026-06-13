export const AuditOutcome = {
  ALLOWED: 'ALLOWED',
  DENIED: 'DENIED',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
} as const;

export type AuditOutcomeCode = (typeof AuditOutcome)[keyof typeof AuditOutcome];

export const AUDIT_OUTCOME_VALUES = Object.values(AuditOutcome);
