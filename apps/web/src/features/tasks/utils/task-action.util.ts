import type { TaskDetail } from '@ethics/dto';
import { TaskStatus, TaskType, type Role as RoleCode } from '@ethics/shared';

type TaskActorUser = {
  id: string;
  roles: readonly RoleCode[];
};

export function isTaskActionableStatus(status: TaskDetail['status']): boolean {
  return status === TaskStatus.PENDING || status === TaskStatus.IN_PROGRESS;
}

export function canUserActOnTask(task: TaskDetail, user: TaskActorUser | null): boolean {
  if (!user) {
    return false;
  }

  if (task.assignedUserId) {
    return task.assignedUserId === user.id;
  }

  return user.roles.includes(task.assignedRole as RoleCode);
}

export function canCompleteTask(task: TaskDetail, user: TaskActorUser | null): boolean {
  if (task.taskType === TaskType.MEMBER_APPROVAL_TASK) {
    return false;
  }

  return isTaskActionableStatus(task.status) && canUserActOnTask(task, user);
}

export function canDelegateTask(task: TaskDetail, user: TaskActorUser | null): boolean {
  return isTaskActionableStatus(task.status) && canUserActOnTask(task, user);
}
