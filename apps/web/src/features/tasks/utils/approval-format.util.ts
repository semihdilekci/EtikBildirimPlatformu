import {
  ApprovalWorkItemStatus,
  WorkItemKind,
  type ApprovalWorkItemStatusCode,
  type WorkItemKindCode,
} from '@ethics/shared';

const APPROVAL_STATUS_LABELS: Record<ApprovalWorkItemStatusCode, string> = {
  [ApprovalWorkItemStatus.PENDING]: 'Bekliyor',
  [ApprovalWorkItemStatus.COMPLETED]: 'Onaylandı',
  [ApprovalWorkItemStatus.REJECTED]: 'Reddedildi',
  [ApprovalWorkItemStatus.CANCELLED]: 'İptal',
};

const WORK_ITEM_KIND_LABELS: Record<WorkItemKindCode, string> = {
  [WorkItemKind.WORKFLOW]: 'Vaka Görevi',
  [WorkItemKind.APPROVAL]: 'Yapılandırma Onayı',
};

export function getApprovalStatusLabel(status: ApprovalWorkItemStatusCode): string {
  return APPROVAL_STATUS_LABELS[status];
}

export function getApprovalStatusChipColor(
  status: ApprovalWorkItemStatusCode,
): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  switch (status) {
    case ApprovalWorkItemStatus.PENDING:
      return 'warning';
    case ApprovalWorkItemStatus.COMPLETED:
      return 'success';
    case ApprovalWorkItemStatus.REJECTED:
      return 'error';
    case ApprovalWorkItemStatus.CANCELLED:
      return 'default';
    default:
      return 'default';
  }
}

export function getWorkItemKindLabel(kind: WorkItemKindCode): string {
  return WORK_ITEM_KIND_LABELS[kind];
}
