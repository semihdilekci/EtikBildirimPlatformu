import { TaskStatus, TaskType } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import type { TaskDetail } from '@ethics/dto';

import { canCompleteTask, canDelegateTask } from '@/features/tasks/utils/task-action.util';

const baseTask: TaskDetail = {
  id: 'task-1',
  caseId: 'case-1',
  taskType: TaskType.SECRETARIAT_REVIEW_TASK,
  taskTypeLabel: 'Ön Değerlendirme',
  status: TaskStatus.PENDING,
  assignedRole: 'council_secretary',
  assignedUserId: 'user-1',
  delegatedFromTaskId: null,
  dueAt: '2025-06-15T08:00:00.000Z',
  slaStatus: 'ON_TRACK',
  outcome: null,
  completedAt: null,
  createdAt: '2025-06-01T08:00:00.000Z',
  updatedAt: '2025-06-01T08:00:00.000Z',
  case: {
    id: 'case-1',
    currentState: 'pre_research',
    currentStateLabel: 'Ön Araştırma',
    confidentialityLevel: 'NORMAL',
    companyId: 'company-1',
    companyName: 'Test Şirket',
  },
};

describe('canCompleteTask', () => {
  it('denies member approval tasks', () => {
    expect(
      canCompleteTask(
        { ...baseTask, taskType: TaskType.MEMBER_APPROVAL_TASK },
        { id: 'user-1', roles: ['council_member'] },
      ),
    ).toBe(false);
  });

  it('allows assignee for actionable tasks', () => {
    expect(canCompleteTask(baseTask, { id: 'user-1', roles: ['council_secretary'] })).toBe(true);
  });

  it('denies non-assignee users', () => {
    expect(canCompleteTask(baseTask, { id: 'user-2', roles: ['council_secretary'] })).toBe(false);
  });

  it('denies completed tasks', () => {
    expect(
      canCompleteTask(
        { ...baseTask, status: TaskStatus.COMPLETED },
        { id: 'user-1', roles: ['council_secretary'] },
      ),
    ).toBe(false);
  });
});

describe('canDelegateTask', () => {
  it('allows assignee for pending tasks', () => {
    expect(canDelegateTask(baseTask, { id: 'user-1', roles: ['council_secretary'] })).toBe(true);
  });

  it('allows role holder when task is unassigned to user', () => {
    expect(
      canDelegateTask(
        { ...baseTask, assignedUserId: null },
        { id: 'user-2', roles: ['council_secretary'] },
      ),
    ).toBe(true);
  });
});
