import { TaskStatus, type TaskStatusCode } from '@ethics/shared';

const TASK_STATUS_LABELS: Record<TaskStatusCode, string> = {
  [TaskStatus.PENDING]: 'Bekliyor',
  [TaskStatus.IN_PROGRESS]: 'Devam Ediyor',
  [TaskStatus.COMPLETED]: 'Tamamlandı',
  [TaskStatus.CANCELLED]: 'İptal',
  [TaskStatus.DELEGATED]: 'Devredildi',
};

export function getTaskStatusLabel(status: TaskStatusCode): string {
  return TASK_STATUS_LABELS[status];
}

export function getTaskStatusChipColor(
  status: TaskStatusCode,
): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  switch (status) {
    case TaskStatus.PENDING:
      return 'warning';
    case TaskStatus.IN_PROGRESS:
      return 'primary';
    case TaskStatus.COMPLETED:
      return 'success';
    case TaskStatus.CANCELLED:
      return 'default';
    case TaskStatus.DELEGATED:
      return 'default';
    default:
      return 'default';
  }
}
