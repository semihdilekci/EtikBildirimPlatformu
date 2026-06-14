/**
 * MVP permission catalog — Docs/07_SECURITY_IMPLEMENTATION.md §3.4–3.5
 * Format: resource:action — serbest metin yetki isimleri yasaktır.
 */
export const PermissionCode = {
  // Intake (public endpoints — internal role map dışında)
  REPORT_CREATE_MANUAL: 'report:create_manual',
  REPORT_FILE_UPLOAD: 'report:file_upload',

  // Case
  CASE_LIST: 'case:list',
  CASE_READ: 'case:read',
  CASE_TRANSITION: 'case:transition',
  CASE_PRE_REVIEW: 'case:pre_review',
  CASE_SET_AGENDA: 'case:set_agenda_decision',
  CASE_ASSIGN_RAPPORTEUR: 'case:assign_rapporteur',
  CASE_UPDATE_CONFIDENTIALITY: 'case:update_confidentiality',

  // Council / board workflow commands
  COUNCIL_VOTE_DECISION: 'council:vote_decision',
  BOARD_APPROVE_OR_VETO: 'board:approve_or_veto',

  // Action owner
  ACTION_RESPOND: 'action:respond',

  // Document
  DOCUMENT_UPLOAD: 'document:upload',
  DOCUMENT_DOWNLOAD: 'document:download',

  // Task
  TASK_LIST: 'task:list',
  TASK_COMPLETE: 'task:complete',
  TASK_DELEGATE: 'task:delegate',

  // Secure messaging (internal)
  SECURE_MESSAGE_READ: 'secure_message:read',
  SECURE_MESSAGE_WRITE: 'secure_message:write',

  // Notification (in-app)
  NOTIFICATION_LIST: 'notification:list',
  NOTIFICATION_MARK_READ: 'notification:mark_read',

  // Audit
  AUDIT_VIEW_METADATA: 'audit:view_metadata',

  // Admin
  ADMIN_MANAGE_ROLES: 'admin:manage_roles',
  ADMIN_MANAGE_SETTINGS: 'admin:manage_settings',
  ADMIN_VIEW_SYNC_STATUS: 'admin:view_sync_status',

  // Tracking (public — internal role map dışında)
  TRACKING_VERIFY: 'tracking:verify',

  // Auth session (profil / oturum — PolicyGuard exempt veya hafif kontrol)
  AUTH_SESSION_READ: 'auth:session_read',
} as const;

export type PermissionCode = (typeof PermissionCode)[keyof typeof PermissionCode];

export const PERMISSION_CODE_VALUES = Object.values(PermissionCode) as readonly PermissionCode[];

/** Public endpoint'ler — internal RBAC role map dışında */
export const PUBLIC_PERMISSION_CODES = [
  PermissionCode.REPORT_CREATE_MANUAL,
  PermissionCode.TRACKING_VERIFY,
] as const satisfies readonly PermissionCode[];
