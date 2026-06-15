import type { WorkflowTaskDetail } from '@ethics/dto';
import { TaskStatus, TaskType, type Role as RoleCode } from '@ethics/shared';

type TaskActorUser = {
  id: string;
  roles: readonly RoleCode[];
};

export function isTaskActionableStatus(status: WorkflowTaskDetail['status']): boolean {
  return status === TaskStatus.PENDING || status === TaskStatus.IN_PROGRESS;
}

export function canUserActOnTask(task: WorkflowTaskDetail, user: TaskActorUser | null): boolean {
  if (!user) {
    return false;
  }

  if (task.assignedUserId) {
    return task.assignedUserId === user.id;
  }

  return user.roles.includes(task.assignedRole as RoleCode);
}

export function canCompleteTask(task: WorkflowTaskDetail, user: TaskActorUser | null): boolean {
  if (task.taskType === TaskType.MEMBER_APPROVAL_TASK) {
    return false;
  }

  return isTaskActionableStatus(task.status) && canUserActOnTask(task, user);
}

export function canDelegateTask(task: WorkflowTaskDetail, user: TaskActorUser | null): boolean {
  return isTaskActionableStatus(task.status) && canUserActOnTask(task, user);
}
