import type { ListCasesQuery } from '@ethics/dto';

export interface CaseListCursorPayload {
  id: string;
  sortValue: string;
}

export function encodeCaseListCursor(payload: CaseListCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCaseListCursor(cursor: string): CaseListCursorPayload {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<CaseListCursorPayload>;

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

export function resolveCaseSortField(
  sortBy: ListCasesQuery['sortBy'],
): 'openedAt' | 'updatedAt' | 'currentState' {
  switch (sortBy) {
    case 'lastActivityAt':
      return 'updatedAt';
    case 'currentState':
      return 'currentState';
    case 'openedAt':
    default:
      return 'openedAt';
  }
}

export function toSortValue(date: Date): string {
  return date.toISOString();
}

export function buildCursorSortCondition(
  sortField: ReturnType<typeof resolveCaseSortField>,
  sortOrder: ListCasesQuery['sortOrder'],
  cursor: CaseListCursorPayload,
): Record<string, unknown> {
  const comparator = sortOrder === 'desc' ? 'lt' : 'gt';
  const tieComparator = sortOrder === 'desc' ? 'lt' : 'gt';

  if (sortField === 'currentState') {
    return {
      OR: [
        { currentState: { [comparator]: cursor.sortValue } },
        {
          AND: [{ currentState: cursor.sortValue }, { id: { [tieComparator]: cursor.id } }],
        },
      ],
    };
  }

  return {
    OR: [
      { [sortField]: { [comparator]: new Date(cursor.sortValue) } },
      {
        AND: [{ [sortField]: new Date(cursor.sortValue) }, { id: { [tieComparator]: cursor.id } }],
      },
    ],
  };
}
