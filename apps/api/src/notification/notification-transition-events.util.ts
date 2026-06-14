import {
  CaseState,
  NotificationEventType,
  TaskType,
  WorkflowCommand,
  type NotificationEventTypeCode,
  type WorkflowCommandCode,
} from '@ethics/shared';

import type { CreatedTransitionRecord } from '../modules/case-management/transition/transition.types.js';

/**
 * Geçiş komutu / hedef state → ek bildirim event tipleri (CASE_TRANSITION ve TASK_ASSIGNED dışında).
 */
export function resolveTransitionSupplementalEvents(
  transition: CreatedTransitionRecord,
): NotificationEventTypeCode[] {
  const command = transition.command as WorkflowCommandCode;
  const toState = transition.toState;

  switch (command) {
    case WorkflowCommand.ASSIGN_RAPPORTEUR:
      return [];
    case WorkflowCommand.ASSIGN_ACTION:
      return [];
    case WorkflowCommand.FOLLOW_UP_REASSIGN:
      return [NotificationEventType.FOLLOW_UP_REASSIGNED];
    case WorkflowCommand.SUBMIT_TO_MEMBER_APPROVAL:
      return [NotificationEventType.MEMBER_APPROVAL_REQUESTED];
    case WorkflowCommand.BOARD_APPROVE:
      return [NotificationEventType.BOARD_APPROVE];
    case WorkflowCommand.BOARD_VETO:
      return [NotificationEventType.BOARD_VETO];
    case WorkflowCommand.MEMBER_OBJECTION:
      return [NotificationEventType.MEMBER_OBJECTION];
    case WorkflowCommand.SUBMIT_ACTION_RESPONSE:
      return [NotificationEventType.ACTION_RESPONSE_SUBMITTED];
    case WorkflowCommand.SUBMIT_TO_CHAIR_GATE:
      return [NotificationEventType.PRE_RESEARCH_COMPLETED];
    case WorkflowCommand.APPROVE_AGENDA:
      return [NotificationEventType.CHAIR_GATE_DECISION];
    case WorkflowCommand.PREPARE_IMPLEMENTATION_LETTER:
      return [NotificationEventType.IMPLEMENTATION_LETTER_READY];
    case WorkflowCommand.CREATE_DECISION_DRAFT:
      return [NotificationEventType.DECISION_DRAFT_READY];
    case WorkflowCommand.CLOSE_NOT_ON_AGENDA:
    case WorkflowCommand.FOLLOW_UP_CLOSE:
      return [NotificationEventType.CASE_CLOSED];
    default:
      break;
  }

  if (toState === CaseState.CLOSED_ARCHIVED || toState === CaseState.NOT_ON_AGENDA_CLOSED) {
    return [NotificationEventType.CASE_CLOSED];
  }

  return [];
}

export function resolveTaskAssignedEventType(taskType: string): NotificationEventTypeCode {
  if (taskType === TaskType.ACTION_RESPONSE_TASK) {
    return NotificationEventType.ACTION_ASSIGNED;
  }

  if (taskType === TaskType.RAPPORTEUR_REPORT_TASK) {
    return NotificationEventType.RAPPORTEUR_ASSIGNED;
  }

  if (taskType === TaskType.MEMBER_APPROVAL_TASK) {
    return NotificationEventType.DECISION_VOTE_REQUESTED;
  }

  return NotificationEventType.TASK_ASSIGNED;
}
