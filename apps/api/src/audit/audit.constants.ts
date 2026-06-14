import {
  AuditEventCategory,
  AuditEventType,
  AuditSeverity,
  type AuditEventCategoryCode,
  type AuditEventTypeCode,
  type AuditSeverityCode,
} from '@ethics/shared';

export const AUDIT_OUTBOX_DISPATCH_PENDING = 'PENDING' as const;
export const AUDIT_OUTBOX_DISPATCH_SENT = 'SENT' as const;
export const AUDIT_OUTBOX_DISPATCH_FAILED = 'FAILED' as const;
export const AUDIT_OUTBOX_DISPATCH_RETRYING = 'RETRYING' as const;
export const AUDIT_OUTBOX_DISPATCH_PERMANENTLY_FAILED = 'PERMANENTLY_FAILED' as const;

export const AUDIT_OUTBOX_DISPATCH_STATUSES = [
  AUDIT_OUTBOX_DISPATCH_PENDING,
  AUDIT_OUTBOX_DISPATCH_SENT,
  AUDIT_OUTBOX_DISPATCH_FAILED,
  AUDIT_OUTBOX_DISPATCH_RETRYING,
  AUDIT_OUTBOX_DISPATCH_PERMANENTLY_FAILED,
] as const;

/** PostgreSQL advisory lock — audit outbox dispatch job tekil çalıştırma */
export const AUDIT_OUTBOX_DISPATCH_ADVISORY_LOCK_KEY = 8_739_282;

export const AUDIT_EVENT_CATEGORY_BY_TYPE: Record<AuditEventTypeCode, AuditEventCategoryCode> = {
  [AuditEventType.CASE_TRANSITION]: AuditEventCategory.WORKFLOW,
  [AuditEventType.CASE_CONFIDENTIALITY_CHANGED]: AuditEventCategory.WORKFLOW,
  [AuditEventType.CASE_VIEWED]: AuditEventCategory.WORKFLOW,
  [AuditEventType.DOCUMENT_DOWNLOADED]: AuditEventCategory.DOCUMENT,
  [AuditEventType.DOCUMENT_UPLOADED]: AuditEventCategory.DOCUMENT,
  [AuditEventType.ROLE_ASSIGNMENT_REQUESTED]: AuditEventCategory.CONFIG,
  [AuditEventType.ROLE_ASSIGNMENT_APPROVED]: AuditEventCategory.CONFIG,
  [AuditEventType.ROLE_REVOKED]: AuditEventCategory.CONFIG,
  [AuditEventType.CLEARANCE_CHANGE_REQUESTED]: AuditEventCategory.CONFIG,
  [AuditEventType.CLEARANCE_UPDATED]: AuditEventCategory.CONFIG,
  [AuditEventType.SYSTEM_SETTING_CHANGED]: AuditEventCategory.CONFIG,
  [AuditEventType.TRACKING_VERIFY_ATTEMPT]: AuditEventCategory.TRACKING,
  [AuditEventType.TRACKING_AUTH_FAILED]: AuditEventCategory.TRACKING,
  [AuditEventType.SECURE_MESSAGE_READ]: AuditEventCategory.TRACKING,
  [AuditEventType.SECURE_MESSAGE_SENT]: AuditEventCategory.TRACKING,
  [AuditEventType.FIELD_VISIBILITY_CHANGED]: AuditEventCategory.CONFIG,
  [AuditEventType.ACTION_MATRIX_CHANGED]: AuditEventCategory.CONFIG,
  [AuditEventType.SSO_LOGIN_SUCCESS]: AuditEventCategory.AUTH,
  [AuditEventType.SSO_LOGIN_FAILED]: AuditEventCategory.AUTH,
  [AuditEventType.SSO_LOGOUT_SUCCESS]: AuditEventCategory.AUTH,
  [AuditEventType.AUTHZ_DENIED]: AuditEventCategory.AUTHZ,
  [AuditEventType.AUDIT_LOG_VIEWED]: AuditEventCategory.SYSTEM,
  [AuditEventType.REPORT_SUBMITTED]: AuditEventCategory.INTAKE,
  [AuditEventType.REPORT_ATTACHMENT_UPLOADED]: AuditEventCategory.INTAKE,
  [AuditEventType.TRACKING_ATTACHMENT_UPLOADED]: AuditEventCategory.TRACKING,
  [AuditEventType.TASK_COMPLETED]: AuditEventCategory.WORKFLOW,
  [AuditEventType.TASK_DELEGATED]: AuditEventCategory.WORKFLOW,
  [AuditEventType.DECISION_VOTE_CAST]: AuditEventCategory.WORKFLOW,
  [AuditEventType.SILENT_ACCEPTANCE_CREATED]: AuditEventCategory.WORKFLOW,
  [AuditEventType.MASTER_DATA_CREATED]: AuditEventCategory.CONFIG,
  [AuditEventType.MASTER_DATA_UPDATED]: AuditEventCategory.CONFIG,
  [AuditEventType.MASTER_DATA_DELETED]: AuditEventCategory.CONFIG,
  [AuditEventType.SLA_POLICY_CHANGED]: AuditEventCategory.CONFIG,
  [AuditEventType.BUSINESS_CALENDAR_UPDATED]: AuditEventCategory.CONFIG,
  [AuditEventType.NOTIFICATION_TEMPLATE_CHANGED]: AuditEventCategory.CONFIG,
  [AuditEventType.KVKK_TEXT_PUBLISHED]: AuditEventCategory.CONFIG,
};

export const AUDIT_EVENT_DEFAULT_SEVERITY: Record<AuditEventTypeCode, AuditSeverityCode> = {
  [AuditEventType.CASE_TRANSITION]: AuditSeverity.INFO,
  [AuditEventType.CASE_CONFIDENTIALITY_CHANGED]: AuditSeverity.HIGH,
  [AuditEventType.CASE_VIEWED]: AuditSeverity.INFO,
  [AuditEventType.DOCUMENT_DOWNLOADED]: AuditSeverity.INFO,
  [AuditEventType.DOCUMENT_UPLOADED]: AuditSeverity.INFO,
  [AuditEventType.ROLE_ASSIGNMENT_REQUESTED]: AuditSeverity.HIGH,
  [AuditEventType.ROLE_ASSIGNMENT_APPROVED]: AuditSeverity.HIGH,
  [AuditEventType.ROLE_REVOKED]: AuditSeverity.HIGH,
  [AuditEventType.CLEARANCE_CHANGE_REQUESTED]: AuditSeverity.HIGH,
  [AuditEventType.CLEARANCE_UPDATED]: AuditSeverity.HIGH,
  [AuditEventType.SYSTEM_SETTING_CHANGED]: AuditSeverity.HIGH,
  [AuditEventType.TRACKING_VERIFY_ATTEMPT]: AuditSeverity.INFO,
  [AuditEventType.TRACKING_AUTH_FAILED]: AuditSeverity.WARN,
  [AuditEventType.SECURE_MESSAGE_READ]: AuditSeverity.INFO,
  [AuditEventType.SECURE_MESSAGE_SENT]: AuditSeverity.INFO,
  [AuditEventType.FIELD_VISIBILITY_CHANGED]: AuditSeverity.HIGH,
  [AuditEventType.ACTION_MATRIX_CHANGED]: AuditSeverity.HIGH,
  [AuditEventType.SSO_LOGIN_SUCCESS]: AuditSeverity.INFO,
  [AuditEventType.SSO_LOGIN_FAILED]: AuditSeverity.WARN,
  [AuditEventType.SSO_LOGOUT_SUCCESS]: AuditSeverity.INFO,
  [AuditEventType.AUTHZ_DENIED]: AuditSeverity.WARN,
  [AuditEventType.AUDIT_LOG_VIEWED]: AuditSeverity.INFO,
  [AuditEventType.REPORT_SUBMITTED]: AuditSeverity.INFO,
  [AuditEventType.REPORT_ATTACHMENT_UPLOADED]: AuditSeverity.INFO,
  [AuditEventType.TRACKING_ATTACHMENT_UPLOADED]: AuditSeverity.INFO,
  [AuditEventType.TASK_COMPLETED]: AuditSeverity.INFO,
  [AuditEventType.TASK_DELEGATED]: AuditSeverity.INFO,
  [AuditEventType.DECISION_VOTE_CAST]: AuditSeverity.INFO,
  [AuditEventType.SILENT_ACCEPTANCE_CREATED]: AuditSeverity.INFO,
  [AuditEventType.MASTER_DATA_CREATED]: AuditSeverity.INFO,
  [AuditEventType.MASTER_DATA_UPDATED]: AuditSeverity.INFO,
  [AuditEventType.MASTER_DATA_DELETED]: AuditSeverity.INFO,
  [AuditEventType.SLA_POLICY_CHANGED]: AuditSeverity.HIGH,
  [AuditEventType.BUSINESS_CALENDAR_UPDATED]: AuditSeverity.HIGH,
  [AuditEventType.NOTIFICATION_TEMPLATE_CHANGED]: AuditSeverity.HIGH,
  [AuditEventType.KVKK_TEXT_PUBLISHED]: AuditSeverity.HIGH,
};
