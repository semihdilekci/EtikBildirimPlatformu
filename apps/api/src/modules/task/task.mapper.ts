import {
  getCaseStateLabel,
  getTaskTypeLabel,
  type CaseStateCode,
  type TaskTypeCode,
} from '@ethics/shared';
import type { TaskDetail, TaskListItem } from '@ethics/dto';
import type { Case, Company, Task } from '@prisma/client';

export type TaskWithCase = Task & {
  case: Case & {
    company: Pick<Company, 'id' | 'name'>;
  };
};

/** SLA badge iter 2'de business calendar ile hesaplanır; iter 1'de due_at yoksa null. */
export function deriveSlaStatus(task: Pick<Task, 'dueAt' | 'status'>): TaskListItem['slaStatus'] {
  if (
    !task.dueAt ||
    task.status === 'COMPLETED' ||
    task.status === 'CANCELLED' ||
    task.status === 'DELEGATED'
  ) {
    return null;
  }

  const now = Date.now();
  const dueMs = task.dueAt.getTime();

  if (now > dueMs) {
    return 'OVERDUE';
  }

  return 'ON_TRACK';
}

export function toTaskListItem(task: TaskWithCase): TaskListItem {
  return {
    id: task.id,
    caseId: task.caseId,
    taskType: task.taskType,
    taskTypeLabel: getTaskTypeLabel(task.taskType as TaskTypeCode),
    status: task.status,
    assignedRole: task.assignedRole,
    dueAt: task.dueAt?.toISOString() ?? null,
    slaStatus: deriveSlaStatus(task),
    createdAt: task.createdAt.toISOString(),
  };
}

export function toTaskDetail(task: TaskWithCase): TaskDetail {
  return {
    id: task.id,
    caseId: task.caseId,
    taskType: task.taskType,
    taskTypeLabel: getTaskTypeLabel(task.taskType as TaskTypeCode),
    status: task.status,
    assignedRole: task.assignedRole,
    assignedUserId: task.assignedUserId,
    delegatedFromTaskId: task.delegatedFromTaskId,
    dueAt: task.dueAt?.toISOString() ?? null,
    slaStatus: deriveSlaStatus(task),
    outcome: task.outcome,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    case: {
      id: task.case.id,
      currentState: task.case.currentState,
      currentStateLabel: getCaseStateLabel(task.case.currentState as CaseStateCode),
      confidentialityLevel: task.case.confidentialityLevel,
      companyId: task.case.companyId,
      companyName: task.case.company.name,
    },
  };
}
