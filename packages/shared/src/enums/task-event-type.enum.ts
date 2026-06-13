export const TaskEventType = {
  CREATED: 'CREATED',
  STARTED: 'STARTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  DELEGATED: 'DELEGATED',
  SLA_WARNED: 'SLA_WARNED',
  SLA_BREACHED: 'SLA_BREACHED',
  PAUSED: 'PAUSED',
  RESUMED: 'RESUMED',
} as const;

export type TaskEventTypeCode = (typeof TaskEventType)[keyof typeof TaskEventType];

export const TASK_EVENT_TYPE_VALUES = Object.values(TaskEventType);
