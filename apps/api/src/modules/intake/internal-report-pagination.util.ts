import type { ListPendingReportsQuery } from '@ethics/dto';

export interface PendingReportListCursorPayload {
  id: string;
  sortValue: string;
}

export function encodePendingReportListCursor(payload: PendingReportListCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodePendingReportListCursor(cursor: string): PendingReportListCursorPayload {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<PendingReportListCursorPayload>;

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

export function resolvePendingReportSortField(
  sortBy: ListPendingReportsQuery['sortBy'],
): 'submittedAt' | 'urgentRiskFlag' {
  return sortBy === 'urgentRiskFlag' ? 'urgentRiskFlag' : 'submittedAt';
}

export function toPendingReportSortValue(
  sortField: ReturnType<typeof resolvePendingReportSortField>,
  row: { submittedAt: Date; urgentRiskFlag: boolean },
): string {
  if (sortField === 'urgentRiskFlag') {
    return row.urgentRiskFlag ? '1' : '0';
  }

  return row.submittedAt.toISOString();
}

export function buildPendingReportCursorSortCondition(
  sortField: ReturnType<typeof resolvePendingReportSortField>,
  sortOrder: ListPendingReportsQuery['sortOrder'],
  cursor: PendingReportListCursorPayload,
): Record<string, unknown> {
  const comparator = sortOrder === 'desc' ? 'lt' : 'gt';
  const tieComparator = sortOrder === 'desc' ? 'lt' : 'gt';

  if (sortField === 'urgentRiskFlag') {
    const urgentValue = cursor.sortValue === '1';
    return {
      OR: [
        { urgentRiskFlag: { [comparator]: urgentValue } },
        {
          AND: [{ urgentRiskFlag: urgentValue }, { id: { [tieComparator]: cursor.id } }],
        },
      ],
    };
  }

  return {
    OR: [
      { submittedAt: { [comparator]: new Date(cursor.sortValue) } },
      {
        AND: [{ submittedAt: new Date(cursor.sortValue) }, { id: { [tieComparator]: cursor.id } }],
      },
    ],
  };
}
