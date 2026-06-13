/** Task type catalog — Docs/01_DOMAIN_MODEL §Task görev tipi kataloğu */
export const TaskType = {
  SECRETARIAT_REVIEW_TASK: 'secretariat_review_task',
  PRE_RESEARCH_TASK: 'pre_research_task',
  CHAIR_GATE_TASK: 'chair_gate_task',
  RAPPORTEUR_ASSIGN_TASK: 'rapporteur_assign_task',
  RAPPORTEUR_REPORT_TASK: 'rapporteur_report_task',
  MEMBER_APPROVAL_TASK: 'member_approval_task',
  DECISION_DRAFT_TASK: 'decision_draft_task',
  BOARD_REVIEW_TASK: 'board_review_task',
  IMPLEMENTATION_LETTER_TASK: 'implementation_letter_task',
  ACTION_RESPONSE_TASK: 'action_response_task',
  FOLLOW_UP_REVIEW_TASK: 'follow_up_review_task',
} as const;

export type TaskTypeCode = (typeof TaskType)[keyof typeof TaskType];

export const TASK_TYPE_VALUES = Object.values(TaskType) as readonly TaskTypeCode[];
