import {
  ApprovalWorkItemStatus,
  getApprovalCategoryLabel,
  WorkItemKind,
  type ApprovalCategoryCode,
} from '@ethics/shared';
import type {
  ApprovalWorkItemDetail,
  ApprovalWorkItemListItem,
  WorkflowTaskDetail,
  WorkflowTaskListItem,
} from '@ethics/dto';
import type { ApprovalWorkItem, User } from '@prisma/client';

import { deriveSlaStatus, toTaskDetail, toTaskListItem, type TaskWithCase } from './task.mapper.js';

type ApprovalWorkItemWithRequester = ApprovalWorkItem & {
  requestedByUser: Pick<User, 'id' | 'displayName'>;
};

export function canDecideApprovalWorkItem(
  user: { id: string; roles: readonly string[] },
  item: Pick<ApprovalWorkItem, 'status' | 'requestedBy' | 'assignedCheckerRole'>,
): boolean {
  if (item.status !== ApprovalWorkItemStatus.PENDING) {
    return false;
  }

  if (user.id === item.requestedBy) {
    return false;
  }

  return user.roles.includes(item.assignedCheckerRole);
}

export function toApprovalWorkItemListItem(
  item: ApprovalWorkItemWithRequester,
): ApprovalWorkItemListItem {
  return {
    kind: WorkItemKind.APPROVAL,
    id: item.id,
    caseId: null,
    approvalCategory: item.category,
    approvalCategoryLabel: getApprovalCategoryLabel(item.category as ApprovalCategoryCode),
    status: item.status,
    assignedRole: item.assignedCheckerRole,
    summary: item.summary,
    requestedByDisplayName: item.requestedByUser.displayName,
    requestedAt: item.createdAt.toISOString(),
    dueAt: null,
    slaStatus: null,
    createdAt: item.createdAt.toISOString(),
  };
}

export function toApprovalWorkItemDetail(
  item: ApprovalWorkItemWithRequester,
  user: { id: string; roles: readonly string[] },
): ApprovalWorkItemDetail {
  return {
    kind: WorkItemKind.APPROVAL,
    id: item.id,
    approvalCategory: item.category,
    approvalCategoryLabel: getApprovalCategoryLabel(item.category as ApprovalCategoryCode),
    status: item.status,
    summary: item.summary,
    assignedRole: item.assignedCheckerRole,
    requestedBy: item.requestedBy,
    requestedByDisplayName: item.requestedByUser.displayName,
    requestedAt: item.createdAt.toISOString(),
    canDecide: canDecideApprovalWorkItem(user, item),
    targetType: item.targetType,
    targetId: item.targetId,
    decidedAt: item.decidedAt?.toISOString() ?? null,
    decisionReason: item.decisionReason,
    createdAt: item.createdAt.toISOString(),
  };
}

export function toWorkflowTaskListItem(task: TaskWithCase): WorkflowTaskListItem {
  return toTaskListItem(task);
}

export function toWorkflowTaskDetail(task: TaskWithCase): WorkflowTaskDetail {
  return toTaskDetail(task);
}

export { deriveSlaStatus };
