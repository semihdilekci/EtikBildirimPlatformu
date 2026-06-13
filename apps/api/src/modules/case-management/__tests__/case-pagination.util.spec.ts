import { describe, expect, it } from 'vitest';

import {
  buildCursorSortCondition,
  decodeCaseListCursor,
  encodeCaseListCursor,
  resolveCaseSortField,
  toSortValue,
} from '../case-pagination.util.js';

describe('case-pagination.util', () => {
  it('encodeCaseListCursor / decodeCaseListCursor round-trip', () => {
    const payload = { id: 'case-001', sortValue: '2026-06-13T10:00:00.000Z' };
    const cursor = encodeCaseListCursor(payload);

    expect(decodeCaseListCursor(cursor)).toEqual(payload);
  });

  it('decodeCaseListCursor geçersiz cursor → hata', () => {
    expect(() => decodeCaseListCursor('not-valid-base64!!!')).toThrow('Invalid cursor');
  });

  it('resolveCaseSortField sortBy eşlemesi', () => {
    expect(resolveCaseSortField('lastActivityAt')).toBe('updatedAt');
    expect(resolveCaseSortField('currentState')).toBe('currentState');
    expect(resolveCaseSortField('openedAt')).toBe('openedAt');
  });

  it('toSortValue ISO string döner', () => {
    const date = new Date('2026-06-13T12:00:00.000Z');
    expect(toSortValue(date)).toBe('2026-06-13T12:00:00.000Z');
  });

  it('buildCursorSortCondition tarih alanı için OR koşulu üretir', () => {
    const cursor = { id: 'case-002', sortValue: '2026-06-13T10:00:00.000Z' };
    const condition = buildCursorSortCondition('openedAt', 'desc', cursor);

    expect(condition).toHaveProperty('OR');
    expect(Array.isArray(condition.OR)).toBe(true);
  });

  it('buildCursorSortCondition currentState için string karşılaştırma kullanır', () => {
    const cursor = { id: 'case-003', sortValue: 'agenda_ready' };
    const condition = buildCursorSortCondition('currentState', 'asc', cursor);

    expect(condition).toEqual({
      OR: [
        { currentState: { gt: 'agenda_ready' } },
        {
          AND: [{ currentState: 'agenda_ready' }, { id: { gt: 'case-003' } }],
        },
      ],
    });
  });
});
