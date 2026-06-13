import { TaskStatus, TaskType } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import { deriveSlaStatus, toTaskDetail, toTaskListItem } from '../task.mapper.js';

describe('task.mapper', () => {
  const baseTask = {
    id: 'task-1',
    caseId: 'case-1',
    taskType: TaskType.SECRETARIAT_REVIEW_TASK,
    status: TaskStatus.PENDING,
    assignedRole: 'council_secretary',
    assignedUserId: null,
    delegatedFromTaskId: null,
    dueAt: new Date('2026-06-20T12:00:00.000Z'),
    slaPolicyId: 'sla-1',
    outcome: null,
    completedAt: null,
    completedByUserId: null,
    createdByTransitionId: 'transition-1',
    createdAt: new Date('2026-06-01T12:00:00.000Z'),
    updatedAt: new Date('2026-06-01T12:00:00.000Z'),
    case: {
      id: 'case-1',
      currentState: 'pre_research',
      confidentialityLevel: 'SENSITIVE',
      companyId: 'company-1',
      optimisticLockVersion: 0,
      company: { id: 'company-1', name: 'Test Şirket' },
    },
  };

  it('deriveSlaStatus returns null for completed tasks', () => {
    expect(
      deriveSlaStatus({
        dueAt: new Date('2026-06-20T12:00:00.000Z'),
        status: TaskStatus.COMPLETED,
      }),
    ).toBeNull();
  });

  it('deriveSlaStatus returns OVERDUE when past dueAt', () => {
    expect(
      deriveSlaStatus({
        dueAt: new Date('2020-01-01T00:00:00.000Z'),
        status: TaskStatus.PENDING,
      }),
    ).toBe('OVERDUE');
  });

  it('deriveSlaStatus returns ON_TRACK when before dueAt', () => {
    expect(
      deriveSlaStatus({
        dueAt: new Date(Date.now() + 86_400_000),
        status: TaskStatus.PENDING,
      }),
    ).toBe('ON_TRACK');
  });

  it('toTaskListItem maps task fields', () => {
    const item = toTaskListItem(baseTask);
    expect(item.id).toBe('task-1');
    expect(item.taskType).toBe(TaskType.SECRETARIAT_REVIEW_TASK);
    expect(item.taskTypeLabel.length).toBeGreaterThan(0);
    expect(item.slaStatus).toBe('ON_TRACK');
  });

  it('toTaskDetail maps nested case metadata', () => {
    const detail = toTaskDetail(baseTask);
    expect(detail.case.companyName).toBe('Test Şirket');
    expect(detail.case.currentStateLabel.length).toBeGreaterThan(0);
  });
});
