export const PLATFORM_NAME = 'ethics-platform' as const;

export { Role, ROLE_VALUES } from './enums/role.enum.js';
export type { Role as RoleCode } from './enums/role.enum.js';

export { ClearanceLevel, CLEARANCE_LEVEL_VALUES } from './enums/clearance-level.enum.js';
export type { ClearanceLevel as ClearanceLevelCode } from './enums/clearance-level.enum.js';

export { ErrorCode } from './constants/error-codes.js';
export type { ErrorCodeValue } from './constants/error-codes.js';

export { AUDIT_FORBIDDEN_METADATA_KEYS } from './constants/audit-forbidden-keys.js';
export type { AuditForbiddenMetadataKey } from './constants/audit-forbidden-keys.js';

export { AuditEventType, AUDIT_EVENT_TYPE_VALUES } from './enums/audit-event-type.enum.js';
export type { AuditEventTypeCode } from './enums/audit-event-type.enum.js';

export { AuditActorType, AUDIT_ACTOR_TYPE_VALUES } from './enums/audit-actor-type.enum.js';
export type { AuditActorTypeCode } from './enums/audit-actor-type.enum.js';

export { AuditOutcome, AUDIT_OUTCOME_VALUES } from './enums/audit-outcome.enum.js';
export type { AuditOutcomeCode } from './enums/audit-outcome.enum.js';

export { AuditSeverity, AUDIT_SEVERITY_VALUES } from './enums/audit-severity.enum.js';
export type { AuditSeverityCode } from './enums/audit-severity.enum.js';

export {
  AuditEventCategory,
  AUDIT_EVENT_CATEGORY_VALUES,
} from './enums/audit-event-category.enum.js';
export type { AuditEventCategoryCode } from './enums/audit-event-category.enum.js';
