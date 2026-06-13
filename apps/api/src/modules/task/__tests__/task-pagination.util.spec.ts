import { describe, expect, it } from 'vitest';

import {
  buildTaskCursorSortCondition,
  decodeTaskListCursor,
  encodeTaskListCursor,
  resolveTaskSortField,
  toTaskSortValue,
} from '../task-pagination.util.js';

describe('task-pagination.util', () => {
  it('encode/decode cursor round-trip', () => {
    const payload = { id: 'task-1', sortValue: '2026-06-13T12:00:00.000Z' };
    const cursor = encodeTaskListCursor(payload);
    expect(decodeTaskListCursor(cursor)).toEqual(payload);
  });

  it('decode invalid cursor throws', () => {
    expect(() => decodeTaskListCursor('not-valid')).toThrow('Invalid cursor');
  });

  it('decode geçersiz payload throws', () => {
    const cursor = Buffer.from(JSON.stringify({ id: 'only-id' }), 'utf8').toString('base64url');
    expect(() => decodeTaskListCursor(cursor)).toThrow('Invalid cursor');
  });

  it('resolveTaskSortField maps query sortBy', () => {
    expect(resolveTaskSortField('dueAt')).toBe('dueAt');
    expect(resolveTaskSortField('status')).toBe('status');
    expect(resolveTaskSortField('createdAt')).toBe('createdAt');
  });

  it('toTaskSortValue normalizes Date and null', () => {
    expect(toTaskSortValue(new Date('2026-06-13T12:00:00.000Z'))).toBe('2026-06-13T12:00:00.000Z');
    expect(toTaskSortValue('2026-06-13T12:00:00.000Z')).toBe('2026-06-13T12:00:00.000Z');
    expect(toTaskSortValue(null)).toBe('');
  });

  it('buildTaskCursorSortCondition createdAt asc', () => {
    const condition = buildTaskCursorSortCondition('createdAt', 'asc', {
      id: 'task-2',
      sortValue: '2026-06-13T12:00:00.000Z',
    });

    expect(condition).toEqual({
      OR: [
        { createdAt: { gt: new Date('2026-06-13T12:00:00.000Z') } },
        {
          AND: [{ createdAt: new Date('2026-06-13T12:00:00.000Z') }, { id: { gt: 'task-2' } }],
        },
      ],
    });
  });

  it('buildTaskCursorSortCondition dueAt desc', () => {
    const condition = buildTaskCursorSortCondition('dueAt', 'desc', {
      id: 'task-3',
      sortValue: '2026-06-14T12:00:00.000Z',
    });

    expect(condition).toEqual({
      OR: [
        { dueAt: { lt: new Date('2026-06-14T12:00:00.000Z') } },
        {
          AND: [{ dueAt: new Date('2026-06-14T12:00:00.000Z') }, { id: { lt: 'task-3' } }],
        },
      ],
    });
  });

  it('buildTaskCursorSortCondition status asc', () => {
    const condition = buildTaskCursorSortCondition('status', 'asc', {
      id: 'task-4',
      sortValue: 'PENDING',
    });

    expect(condition).toEqual({
      OR: [
        { status: { gt: 'PENDING' } },
        {
          AND: [{ status: 'PENDING' }, { id: { gt: 'task-4' } }],
        },
      ],
    });
  });
});
