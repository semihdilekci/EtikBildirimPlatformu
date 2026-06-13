export const AuditActorType = {
  USER: 'USER',
  SYSTEM: 'SYSTEM',
  ANONYMOUS: 'ANONYMOUS',
} as const;

export type AuditActorTypeCode = (typeof AuditActorType)[keyof typeof AuditActorType];

export const AUDIT_ACTOR_TYPE_VALUES = Object.values(AuditActorType);
