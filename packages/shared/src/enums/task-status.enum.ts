/** Task lifecycle states — Docs/01_DOMAIN_MODEL §Task State Machine */
export const TaskStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  DELEGATED: 'DELEGATED',
} as const;

export type TaskStatusCode = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TASK_STATUS_VALUES = Object.values(TaskStatus) as readonly TaskStatusCode[];
