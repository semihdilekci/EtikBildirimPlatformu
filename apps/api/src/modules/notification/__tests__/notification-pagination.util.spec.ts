import { describe, expect, it } from 'vitest';

import {
  buildNotificationCursorCondition,
  decodeNotificationListCursor,
  encodeNotificationListCursor,
} from '../notification-pagination.util.js';

describe('notification-pagination.util', () => {
  it('encode/decode round-trip', () => {
    const payload = {
      id: 'notif-1',
      createdAt: '2026-06-10T09:00:00.000Z',
    };

    const encoded = encodeNotificationListCursor(payload);
    expect(decodeNotificationListCursor(encoded)).toEqual(payload);
  });

  it('buildNotificationCursorCondition lt createdAt veya tie-break id', () => {
    const condition = buildNotificationCursorCondition({
      id: 'notif-2',
      createdAt: '2026-06-10T09:00:00.000Z',
    });

    expect(condition).toEqual({
      OR: [
        { createdAt: { lt: new Date('2026-06-10T09:00:00.000Z') } },
        {
          AND: [{ createdAt: new Date('2026-06-10T09:00:00.000Z') }, { id: { lt: 'notif-2' } }],
        },
      ],
    });
  });

  it('invalid cursor throws', () => {
    expect(() => decodeNotificationListCursor('not-valid')).toThrow('Invalid cursor');
  });
});
