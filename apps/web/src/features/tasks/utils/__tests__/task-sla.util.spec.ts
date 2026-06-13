import { describe, expect, it } from 'vitest';

import {
  formatSlaRemainingText,
  resolveSlaDisplayStatus,
} from '@/features/tasks/utils/task-sla.util';

describe('resolveSlaDisplayStatus', () => {
  const createdAt = '2025-06-01T08:00:00.000Z';
  const dueAt = '2025-06-15T08:00:00.000Z';

  it('returns null when dueAt is missing', () => {
    expect(resolveSlaDisplayStatus({ dueAt: null, createdAt })).toBeNull();
  });

  it('returns OVERDUE when now is past dueAt', () => {
    const nowMs = new Date('2025-06-16T08:00:00.000Z').getTime();
    expect(resolveSlaDisplayStatus({ dueAt, createdAt }, nowMs)).toBe('OVERDUE');
  });

  it('returns ON_TRACK when more than 20% time remains', () => {
    const nowMs = new Date('2025-06-02T08:00:00.000Z').getTime();
    expect(resolveSlaDisplayStatus({ dueAt, createdAt }, nowMs)).toBe('ON_TRACK');
  });

  it('returns WARNING when 20% or less time remains', () => {
    const nowMs = new Date('2025-06-13T08:00:00.000Z').getTime();
    expect(resolveSlaDisplayStatus({ dueAt, createdAt }, nowMs)).toBe('WARNING');
  });
});

describe('formatSlaRemainingText', () => {
  it('formats overdue days in Turkish', () => {
    const text = formatSlaRemainingText(
      {
        dueAt: '2025-06-10T08:00:00.000Z',
        createdAt: '2025-06-01T08:00:00.000Z',
      },
      new Date('2025-06-13T08:00:00.000Z').getTime(),
    );
    expect(text).toBe('3 gün aşım');
  });

  it('formats remaining days in Turkish', () => {
    const text = formatSlaRemainingText(
      {
        dueAt: '2025-06-15T08:00:00.000Z',
        createdAt: '2025-06-01T08:00:00.000Z',
      },
      new Date('2025-06-10T08:00:00.000Z').getTime(),
    );
    expect(text).toBe('5 gün kaldı');
  });
});
