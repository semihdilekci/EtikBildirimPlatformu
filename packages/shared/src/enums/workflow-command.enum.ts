/**
 * Workflow transition commands — Docs/03_API_CONTRACTS §8.4 + Docs/01_DOMAIN_MODEL geçiş tablosu.
 * OPEN_CASE: vaka açılış kaydı (seed/sistem); state değiştirmez.
 */
export const WorkflowCommand = {
  OPEN_CASE: 'open_case',

  ACKNOWLEDGE_REPORT: 'acknowledge_report',
  START_PRE_RESEARCH: 'start_pre_research',
  SUBMIT_TO_CHAIR_GATE: 'submit_to_chair_gate',
  APPROVE_AGENDA: 'approve_agenda',
  CLOSE_NOT_ON_AGENDA: 'close_not_on_agenda',

  ASSIGN_RAPPORTEUR: 'assign_rapporteur',
  SUBMIT_RAPPORTEUR_REPORT: 'submit_rapporteur_report',
  RETURN_TO_AGENDA: 'return_to_agenda',
  SUBMIT_TO_MEMBER_APPROVAL: 'submit_to_member_approval',
  MEMBER_OBJECTION: 'member_objection',

  CREATE_DECISION_DRAFT: 'create_decision_draft',
  SUBMIT_TO_BOARD_REVIEW: 'submit_to_board_review',
  BOARD_APPROVE: 'board_approve',
  BOARD_VETO: 'board_veto',

  PREPARE_IMPLEMENTATION_LETTER: 'prepare_implementation_letter',
  ASSIGN_ACTION: 'assign_action',
  BEGIN_ACTION_RESPONSE: 'begin_action_response',
  SUBMIT_ACTION_RESPONSE: 'submit_action_response',
  SUBMIT_FOLLOW_UP_REVIEW: 'submit_follow_up_review',
  FOLLOW_UP_CLOSE: 'follow_up_close',
  FOLLOW_UP_REASSIGN: 'follow_up_reassign',
} as const;

export type WorkflowCommandCode = (typeof WorkflowCommand)[keyof typeof WorkflowCommand];

export const WORKFLOW_COMMAND_VALUES = Object.values(
  WorkflowCommand,
) as readonly WorkflowCommandCode[];
