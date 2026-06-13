import type { ListTasksQuery } from '@ethics/dto';

export interface TaskListCursorPayload {
  id: string;
  sortValue: string;
}

export function encodeTaskListCursor(payload: TaskListCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeTaskListCursor(cursor: string): TaskListCursorPayload {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<TaskListCursorPayload>;

    if (typeof parsed.id !== 'string' || typeof parsed.sortValue !== 'string') {
      throw new Error('Invalid cursor payload');
    }

    return {
      id: parsed.id,
      sortValue: parsed.sortValue,
    };
  } catch {
    throw new Error('Invalid cursor');
  }
}

export function resolveTaskSortField(
  sortBy: ListTasksQuery['sortBy'],
): 'createdAt' | 'dueAt' | 'status' {
  switch (sortBy) {
    case 'dueAt':
      return 'dueAt';
    case 'status':
      return 'status';
    case 'createdAt':
    default:
      return 'createdAt';
  }
}

export function toTaskSortValue(value: Date | string | null): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return '';
}

export function buildTaskCursorSortCondition(
  sortField: ReturnType<typeof resolveTaskSortField>,
  sortOrder: ListTasksQuery['sortOrder'],
  cursor: TaskListCursorPayload,
): Record<string, unknown> {
  const comparator = sortOrder === 'desc' ? 'lt' : 'gt';
  const tieComparator = sortOrder === 'desc' ? 'lt' : 'gt';

  if (sortField === 'status') {
    return {
      OR: [
        { status: { [comparator]: cursor.sortValue } },
        {
          AND: [{ status: cursor.sortValue }, { id: { [tieComparator]: cursor.id } }],
        },
      ],
    };
  }

  if (sortField === 'dueAt') {
    const cursorDate = cursor.sortValue ? new Date(cursor.sortValue) : null;
    return {
      OR: [
        { dueAt: { [comparator]: cursorDate } },
        {
          AND: [{ dueAt: cursorDate }, { id: { [tieComparator]: cursor.id } }],
        },
      ],
    };
  }

  return {
    OR: [
      { createdAt: { [comparator]: new Date(cursor.sortValue) } },
      {
        AND: [{ createdAt: new Date(cursor.sortValue) }, { id: { [tieComparator]: cursor.id } }],
      },
    ],
  };
}
