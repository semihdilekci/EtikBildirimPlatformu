/** Maker-checker action matrix keys — Docs/07 §11.1 */
export const AdminActionCode = {
  ROLE_ASSIGN: 'role_assign',
  ROLE_ASSIGN_COUNCIL_SECRETARY: 'role_assign_council_secretary',
  ROLE_ASSIGN_BOARD_CHAIR: 'role_assign_board_chair',
  CLEARANCE_ELEVATE_STRICTLY_CONFIDENTIAL: 'clearance_elevate_strictly_confidential',
  SYSTEM_SETTING_CHANGE: 'system_setting_change',
  FIELD_VISIBILITY_CHANGE: 'field_visibility_change',
  ACTION_MATRIX_CHANGE: 'action_matrix_change',
  SLA_POLICY_CHANGE: 'sla_policy_change',
  NOTIFICATION_TEMPLATE_CHANGE: 'notification_template_change',
  KVKK_TEXT_PUBLISH: 'kvkk_text_publish',
} as const;

export type AdminActionCodeValue = (typeof AdminActionCode)[keyof typeof AdminActionCode];

export const ADMIN_ACTION_CODE_VALUES = Object.values(
  AdminActionCode,
) as readonly AdminActionCodeValue[];
