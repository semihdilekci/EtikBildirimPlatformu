import { AdminActionCode, type AdminActionCodeValue } from './admin-action-codes.js';
import { ApprovalCategory, type ApprovalCategoryCode } from '../enums/approval-category.enum.js';

const ACTION_CODE_TO_CATEGORY: Record<AdminActionCodeValue, ApprovalCategoryCode> = {
  [AdminActionCode.ROLE_ASSIGN]: ApprovalCategory.ROLE_ASSIGNMENT,
  [AdminActionCode.ROLE_ASSIGN_COUNCIL_SECRETARY]: ApprovalCategory.ROLE_ASSIGNMENT,
  [AdminActionCode.ROLE_ASSIGN_BOARD_CHAIR]: ApprovalCategory.ROLE_ASSIGNMENT,
  [AdminActionCode.CLEARANCE_ELEVATE_STRICTLY_CONFIDENTIAL]: ApprovalCategory.CLEARANCE_CHANGE,
  [AdminActionCode.SYSTEM_SETTING_CHANGE]: ApprovalCategory.SYSTEM_SETTING_CHANGE,
  [AdminActionCode.FIELD_VISIBILITY_CHANGE]: ApprovalCategory.FIELD_VISIBILITY_CHANGE,
  [AdminActionCode.ACTION_MATRIX_CHANGE]: ApprovalCategory.ACTION_MATRIX_CHANGE,
  [AdminActionCode.SLA_POLICY_CHANGE]: ApprovalCategory.SLA_POLICY_CHANGE,
  [AdminActionCode.NOTIFICATION_TEMPLATE_CHANGE]: ApprovalCategory.NOTIFICATION_TEMPLATE_CHANGE,
  [AdminActionCode.KVKK_TEXT_PUBLISH]: ApprovalCategory.KVKK_TEXT_PUBLISH,
};

export function resolveApprovalCategory(actionCode: AdminActionCodeValue): ApprovalCategoryCode {
  return ACTION_CODE_TO_CATEGORY[actionCode];
}
