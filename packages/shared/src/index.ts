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

export {
  ReportCategoryGroup,
  REPORT_CATEGORY_GROUP_VALUES,
  ReportSubCategory,
  REPORT_SUB_CATEGORY_VALUES,
  REPORT_SUB_CATEGORY_TO_GROUP,
  REPORT_CATEGORY_CATALOG,
} from './enums/report-category.enum.js';
export type {
  ReportCategoryGroupCode,
  ReportSubCategoryCode,
  ReportCategoryCatalogEntry,
} from './enums/report-category.enum.js';

export {
  ReportStatus,
  REPORT_STATUS_VALUES,
  REPORT_STATUS_LABELS,
  ReportChannel,
  IncidentRecurrence,
  HowReporterLearned,
  ReporterIdentityRelation,
} from './enums/report-status.enum.js';

export { MalwareScanStatus, MALWARE_SCAN_STATUS_VALUES } from './enums/malware-scan-status.enum.js';

export {
  SecureMessageDirection,
  SECURE_MESSAGE_DIRECTION_VALUES,
  SecureMessageApiDirection,
  SecureMessageSenderType,
  SECURE_MESSAGE_SENDER_TYPE_VALUES,
  SECURE_MESSAGE_SENDER_LABELS,
  toSecureMessageApiDirection,
} from './enums/secure-message.enum.js';
export type {
  SecureMessageDirectionCode,
  SecureMessageApiDirectionCode,
  SecureMessageSenderTypeCode,
} from './enums/secure-message.enum.js';
export type { MalwareScanStatusCode } from './enums/malware-scan-status.enum.js';

export { CaseState, CASE_STATE_VALUES } from './enums/case-state.enum.js';
export type { CaseStateCode } from './enums/case-state.enum.js';

export { WorkflowCommand, WORKFLOW_COMMAND_VALUES } from './enums/workflow-command.enum.js';
export type { WorkflowCommandCode } from './enums/workflow-command.enum.js';

export { WORKFLOW_VERSION } from './constants/workflow.constants.js';

export { CASE_STATE_LABELS, getCaseStateLabel } from './constants/case-state-labels.js';

export {
  WORKFLOW_COMMAND_LABELS,
  REASON_REQUIRED_COMMANDS,
  getWorkflowCommandLabel,
} from './constants/workflow-command-labels.js';

export {
  NotificationChannel,
  NOTIFICATION_CHANNEL_VALUES,
} from './enums/notification-channel.enum.js';
export type { NotificationChannelCode } from './enums/notification-channel.enum.js';

export {
  NotificationEventType,
  NOTIFICATION_EVENT_TYPE_VALUES,
} from './enums/notification-event-type.enum.js';
export type { NotificationEventTypeCode } from './enums/notification-event-type.enum.js';

export {
  NOTIFICATION_DISPATCH_PENDING,
  NOTIFICATION_DISPATCH_SENT,
  NOTIFICATION_DISPATCH_FAILED,
  NOTIFICATION_DISPATCH_RETRYING,
} from './constants/notification.constants.js';

export {
  ALLOWED_UPLOAD_RULES,
  MAX_SINGLE_FILE_BYTES,
  MAX_TOTAL_REPORT_ATTACHMENT_BYTES,
  PRESIGNED_UPLOAD_TTL_SECONDS,
} from './constants/file-upload.constants.js';
export type { AllowedUploadRule } from './constants/file-upload.constants.js';
export type {
  ReportStatusCode,
  ReportChannelCode,
  IncidentRecurrenceCode,
  HowReporterLearnedCode,
  ReporterIdentityRelationCode,
} from './enums/report-status.enum.js';
