/**
 * Notification template catalog — 28 şablon (Docs/04_BACKEND_SPEC, Faz 8).
 * Her kod notification_templates.template_code ile birebir eşleşir.
 */
export const NotificationTemplateCode = {
  TASK_ASSIGNED: 'task_assigned',
  TASK_COMPLETED: 'task_completed',
  TASK_DELEGATED: 'task_delegated',
  SLA_WARNING: 'sla_warning',
  SLA_BREACH: 'sla_breach',
  CASE_TRANSITION: 'case_transition',
  SILENT_ACCEPTANCE_WARNING: 'silent_acceptance_warning',
  SILENT_ACCEPTANCE_CREATED: 'silent_acceptance_created',
  DECISION_VOTE_REQUESTED: 'decision_vote_requested',
  ACTION_ASSIGNED: 'action_assigned',
  SECURE_MESSAGE_RECEIVED: 'secure_message_received',
  SECURE_MESSAGE_REPORTER: 'secure_message_reporter',
  RAPPORTEUR_ASSIGNED: 'rapporteur_assigned',
  BOARD_VETO: 'board_veto',
  BOARD_APPROVE: 'board_approve',
  MEMBER_APPROVAL_REQUESTED: 'member_approval_requested',
  MEMBER_OBJECTION: 'member_objection',
  ACTION_RESPONSE_SUBMITTED: 'action_response_submitted',
  CASE_CLOSED: 'case_closed',
  DOCUMENT_QUARANTINED: 'document_quarantined',
  DOCUMENT_REJECTED: 'document_rejected',
  DOCUMENT_SCAN_COMPLETE: 'document_scan_complete',
  FOLLOW_UP_REASSIGNED: 'follow_up_reassigned',
  IMPLEMENTATION_LETTER_READY: 'implementation_letter_ready',
  PRE_RESEARCH_COMPLETED: 'pre_research_completed',
  CHAIR_GATE_DECISION: 'chair_gate_decision',
  DECISION_DRAFT_READY: 'decision_draft_ready',
  TASK_OVERDUE_REMINDER: 'task_overdue_reminder',
} as const;

export type NotificationTemplateCodeValue =
  (typeof NotificationTemplateCode)[keyof typeof NotificationTemplateCode];

export const NOTIFICATION_TEMPLATE_CODE_VALUES = Object.values(
  NotificationTemplateCode,
) as readonly NotificationTemplateCodeValue[];
