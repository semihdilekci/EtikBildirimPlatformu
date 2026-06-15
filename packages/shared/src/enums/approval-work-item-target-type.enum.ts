/** ApprovalWorkItem target reference types — Docs/02 §approval_work_items */
export const ApprovalWorkItemTargetType = {
  USER_ROLE: 'user_role',
  CLEARANCE_REQUEST: 'clearance_request',
  SYSTEM_SETTING_BATCH: 'system_setting_batch',
  FIELD_VISIBILITY_BATCH: 'field_visibility_batch',
  ACTION_MATRIX_BATCH: 'action_matrix_batch',
  SLA_POLICY_BATCH: 'sla_policy_batch',
  NOTIFICATION_TEMPLATE_BATCH: 'notification_template_batch',
  KVKK_TEXT_BATCH: 'kvkk_text_batch',
} as const;

export type ApprovalWorkItemTargetTypeCode =
  (typeof ApprovalWorkItemTargetType)[keyof typeof ApprovalWorkItemTargetType];

export const APPROVAL_WORK_ITEM_TARGET_TYPE_VALUES = Object.values(
  ApprovalWorkItemTargetType,
) as readonly ApprovalWorkItemTargetTypeCode[];
