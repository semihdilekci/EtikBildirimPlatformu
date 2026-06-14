export interface NotificationListCursorPayload {
  id: string;
  createdAt: string;
}

export function encodeNotificationListCursor(payload: NotificationListCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeNotificationListCursor(cursor: string): NotificationListCursorPayload {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<NotificationListCursorPayload>;

    if (typeof parsed.id !== 'string' || typeof parsed.createdAt !== 'string') {
      throw new Error('Invalid cursor payload');
    }

    return {
      id: parsed.id,
      createdAt: parsed.createdAt,
    };
  } catch {
    throw new Error('Invalid cursor');
  }
}

export function buildNotificationCursorCondition(
  cursor: NotificationListCursorPayload,
): Record<string, unknown> {
  const cursorDate = new Date(cursor.createdAt);

  return {
    OR: [
      { createdAt: { lt: cursorDate } },
      {
        AND: [{ createdAt: cursorDate }, { id: { lt: cursor.id } }],
      },
    ],
  };
}
