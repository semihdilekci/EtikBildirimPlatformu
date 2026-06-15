import {
  NotificationEventType,
  type NotificationEventTypeCode,
} from '../enums/notification-event-type.enum.js';
import {
  NotificationTemplateCode,
  type NotificationTemplateCodeValue,
} from '../enums/notification-template.enum.js';

/**
 * Outbox event_type → notification_templates.template_code (dispatch).
 */
export const NOTIFICATION_EVENT_TEMPLATE_MAP: Readonly<
  Record<NotificationEventTypeCode, NotificationTemplateCodeValue>
> = {
  [NotificationEventType.TASK_ASSIGNED]: NotificationTemplateCode.TASK_ASSIGNED,
  [NotificationEventType.TASK_COMPLETED]: NotificationTemplateCode.TASK_COMPLETED,
  [NotificationEventType.TASK_DELEGATED]: NotificationTemplateCode.TASK_DELEGATED,
  [NotificationEventType.SLA_WARNING]: NotificationTemplateCode.SLA_WARNING,
  [NotificationEventType.SLA_BREACH]: NotificationTemplateCode.SLA_BREACH,
  [NotificationEventType.CASE_TRANSITION]: NotificationTemplateCode.CASE_TRANSITION,
  [NotificationEventType.SILENT_ACCEPTANCE_WARNING]:
    NotificationTemplateCode.SILENT_ACCEPTANCE_WARNING,
  [NotificationEventType.SILENT_ACCEPTANCE_CREATED]:
    NotificationTemplateCode.SILENT_ACCEPTANCE_CREATED,
  [NotificationEventType.DECISION_VOTE_REQUESTED]: NotificationTemplateCode.DECISION_VOTE_REQUESTED,
  [NotificationEventType.ACTION_ASSIGNED]: NotificationTemplateCode.ACTION_ASSIGNED,
  [NotificationEventType.SECURE_MESSAGE_RECEIVED]: NotificationTemplateCode.SECURE_MESSAGE_RECEIVED,
  [NotificationEventType.SECURE_MESSAGE_REPORTER]: NotificationTemplateCode.SECURE_MESSAGE_REPORTER,
  [NotificationEventType.RAPPORTEUR_ASSIGNED]: NotificationTemplateCode.RAPPORTEUR_ASSIGNED,
  [NotificationEventType.BOARD_VETO]: NotificationTemplateCode.BOARD_VETO,
  [NotificationEventType.BOARD_APPROVE]: NotificationTemplateCode.BOARD_APPROVE,
  [NotificationEventType.MEMBER_APPROVAL_REQUESTED]:
    NotificationTemplateCode.MEMBER_APPROVAL_REQUESTED,
  [NotificationEventType.MEMBER_OBJECTION]: NotificationTemplateCode.MEMBER_OBJECTION,
  [NotificationEventType.ACTION_RESPONSE_SUBMITTED]:
    NotificationTemplateCode.ACTION_RESPONSE_SUBMITTED,
  [NotificationEventType.CASE_CLOSED]: NotificationTemplateCode.CASE_CLOSED,
  [NotificationEventType.DOCUMENT_QUARANTINED]: NotificationTemplateCode.DOCUMENT_QUARANTINED,
  [NotificationEventType.DOCUMENT_REJECTED]: NotificationTemplateCode.DOCUMENT_REJECTED,
  [NotificationEventType.DOCUMENT_SCAN_COMPLETE]: NotificationTemplateCode.DOCUMENT_SCAN_COMPLETE,
  [NotificationEventType.FOLLOW_UP_REASSIGNED]: NotificationTemplateCode.FOLLOW_UP_REASSIGNED,
  [NotificationEventType.IMPLEMENTATION_LETTER_READY]:
    NotificationTemplateCode.IMPLEMENTATION_LETTER_READY,
  [NotificationEventType.PRE_RESEARCH_COMPLETED]: NotificationTemplateCode.PRE_RESEARCH_COMPLETED,
  [NotificationEventType.CHAIR_GATE_DECISION]: NotificationTemplateCode.CHAIR_GATE_DECISION,
  [NotificationEventType.DECISION_DRAFT_READY]: NotificationTemplateCode.DECISION_DRAFT_READY,
  [NotificationEventType.TASK_OVERDUE_REMINDER]: NotificationTemplateCode.TASK_OVERDUE_REMINDER,
  [NotificationEventType.APPROVAL_WORK_ITEM_ASSIGNED]:
    NotificationTemplateCode.APPROVAL_WORK_ITEM_ASSIGNED,
};

export function resolveNotificationTemplateCode(
  eventType: string,
): NotificationTemplateCodeValue | null {
  if (eventType in NOTIFICATION_EVENT_TEMPLATE_MAP) {
    return NOTIFICATION_EVENT_TEMPLATE_MAP[eventType as NotificationEventTypeCode];
  }

  return null;
}
