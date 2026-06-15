/** Maker-checker onay kategorileri — Docs/02 §approval_work_items */
export const ApprovalCategory = {
  ROLE_ASSIGNMENT: 'ROLE_ASSIGNMENT',
  CLEARANCE_CHANGE: 'CLEARANCE_CHANGE',
  SYSTEM_SETTING_CHANGE: 'SYSTEM_SETTING_CHANGE',
  FIELD_VISIBILITY_CHANGE: 'FIELD_VISIBILITY_CHANGE',
  ACTION_MATRIX_CHANGE: 'ACTION_MATRIX_CHANGE',
  SLA_POLICY_CHANGE: 'SLA_POLICY_CHANGE',
  NOTIFICATION_TEMPLATE_CHANGE: 'NOTIFICATION_TEMPLATE_CHANGE',
  KVKK_TEXT_PUBLISH: 'KVKK_TEXT_PUBLISH',
} as const;

export type ApprovalCategoryCode = (typeof ApprovalCategory)[keyof typeof ApprovalCategory];

export const APPROVAL_CATEGORY_VALUES = Object.values(
  ApprovalCategory,
) as readonly ApprovalCategoryCode[];
