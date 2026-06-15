/** ApprovalWorkItem lifecycle — Docs/02 §approval_work_items */
export const ApprovalWorkItemStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type ApprovalWorkItemStatusCode =
  (typeof ApprovalWorkItemStatus)[keyof typeof ApprovalWorkItemStatus];

export const APPROVAL_WORK_ITEM_STATUS_VALUES = Object.values(
  ApprovalWorkItemStatus,
) as readonly ApprovalWorkItemStatusCode[];
