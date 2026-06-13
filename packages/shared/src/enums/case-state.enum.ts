/** Case workflow states — Docs/01_DOMAIN_MODEL §Case State Machine */
export const CaseState = {
  REPORT_SUBMITTED: 'report_submitted',
  SECRETARIAT_REVIEW: 'secretariat_review',
  PRE_RESEARCH: 'pre_research',
  CHAIR_GATE: 'chair_gate',
  NOT_ON_AGENDA_CLOSED: 'not_on_agenda_closed',
  AGENDA_READY: 'agenda_ready',
  RAPPORTEUR_ASSIGNED: 'rapporteur_assigned',
  RAPPORTEUR_REPORT_SUBMITTED: 'rapporteur_report_submitted',
  MEMBER_APPROVAL: 'member_approval',
  DECISION_DRAFT: 'decision_draft',
  BOARD_CHAIR_REVIEW: 'board_chair_review',
  BOARD_APPROVED: 'board_approved',
  IMPLEMENTATION_LETTER_PREPARED: 'implementation_letter_prepared',
  ACTION_ASSIGNED: 'action_assigned',
  ACTION_RESPONSE_PENDING: 'action_response_pending',
  FOLLOW_UP_DECISION: 'follow_up_decision',
  CLOSED_ARCHIVED: 'closed_archived',
} as const;

export type CaseStateCode = (typeof CaseState)[keyof typeof CaseState];

export const CASE_STATE_VALUES = Object.values(CaseState) as readonly CaseStateCode[];
