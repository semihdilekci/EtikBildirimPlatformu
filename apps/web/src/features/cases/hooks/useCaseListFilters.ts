import type { ListCasesQuery } from '@ethics/dto';
import { CASE_STATE_VALUES, CLEARANCE_LEVEL_VALUES, type ClearanceLevelCode } from '@ethics/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  dateInputToEndIso,
  dateInputToStartIso,
  isoToDateInput,
} from '@/features/cases/utils/case-format.util';

const DEFAULT_LIST_QUERY: ListCasesQuery = {
  limit: 20,
  sortBy: 'openedAt',
  sortOrder: 'desc',
};

function parseSortByParam(value: string | null): ListCasesQuery['sortBy'] {
  if (value === 'openedAt' || value === 'lastActivityAt' || value === 'currentState') {
    return value;
  }
  return DEFAULT_LIST_QUERY.sortBy;
}

function parseSortOrderParam(value: string | null): ListCasesQuery['sortOrder'] {
  if (value === 'asc' || value === 'desc') {
    return value;
  }
  return DEFAULT_LIST_QUERY.sortOrder;
}

function parseStatusParam(value: string | null): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const statuses = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => CASE_STATE_VALUES.includes(item as (typeof CASE_STATE_VALUES)[number]));

  return statuses.length > 0 ? statuses : undefined;
}

function isClearanceLevel(value: string): value is ClearanceLevelCode {
  return CLEARANCE_LEVEL_VALUES.some((level) => level === value);
}

function parseConfidentialityParam(value: string | null): ListCasesQuery['confidentialityLevel'] {
  if (!value || !isClearanceLevel(value)) {
    return undefined;
  }

  return value;
}

export function useCaseListFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo((): ListCasesQuery => {
    const dateFromRaw = searchParams.get('dateFrom');
    const dateToRaw = searchParams.get('dateTo');

    return {
      ...DEFAULT_LIST_QUERY,
      status: parseStatusParam(searchParams.get('status')),
      companyId: searchParams.get('companyId') ?? undefined,
      confidentialityLevel: parseConfidentialityParam(searchParams.get('confidentialityLevel')),
      dateFrom: dateFromRaw ? dateInputToStartIso(dateFromRaw) : undefined,
      dateTo: dateToRaw ? dateInputToEndIso(dateToRaw) : undefined,
      assignedToMe: searchParams.get('assignedToMe') === 'true' ? true : undefined,
      cursor: searchParams.get('cursor') ?? undefined,
      sortBy: parseSortByParam(searchParams.get('sortBy')),
      sortOrder: parseSortOrderParam(searchParams.get('sortOrder')),
    };
  }, [searchParams]);

  const uiFilters = useMemo(
    () => ({
      status: filters.status ?? [],
      companyId: filters.companyId ?? '',
      confidentialityLevel: filters.confidentialityLevel ?? '',
      dateFrom: isoToDateInput(filters.dateFrom),
      dateTo: isoToDateInput(filters.dateTo),
      assignedToMe: filters.assignedToMe === true,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    }),
    [filters],
  );

  const updateParams = useCallback(
    (updates: Record<string, string | null>, resetCursor = true) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(updates)) {
          if (value === null || value === '') {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }
        if (resetCursor) {
          next.delete('cursor');
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const setStatusFilter = useCallback(
    (statuses: string[]) => {
      updateParams({ status: statuses.length > 0 ? statuses.join(',') : null });
    },
    [updateParams],
  );

  const setCompanyFilter = useCallback(
    (companyId: string) => {
      updateParams({ companyId: companyId || null });
    },
    [updateParams],
  );

  const setConfidentialityFilter = useCallback(
    (level: string) => {
      updateParams({ confidentialityLevel: level || null });
    },
    [updateParams],
  );

  const setDateFromFilter = useCallback(
    (date: string) => {
      updateParams({ dateFrom: date || null });
    },
    [updateParams],
  );

  const setDateToFilter = useCallback(
    (date: string) => {
      updateParams({ dateTo: date || null });
    },
    [updateParams],
  );

  const setAssignedToMeFilter = useCallback(
    (assigned: boolean) => {
      updateParams({ assignedToMe: assigned ? 'true' : null });
    },
    [updateParams],
  );

  const setSort = useCallback(
    (sortBy: string) => {
      const currentSortBy = searchParams.get('sortBy') ?? 'openedAt';
      const currentSortOrder = searchParams.get('sortOrder') ?? 'desc';
      const nextSortOrder =
        currentSortBy === sortBy && currentSortOrder === 'desc' ? 'asc' : 'desc';

      updateParams({
        sortBy,
        sortOrder: nextSortOrder,
      });
    },
    [searchParams, updateParams],
  );

  const setCursor = useCallback(
    (cursor: string | null) => {
      updateParams({ cursor }, false);
    },
    [updateParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const hasActiveFilters =
    uiFilters.status.length > 0 ||
    Boolean(uiFilters.companyId) ||
    Boolean(uiFilters.confidentialityLevel) ||
    Boolean(uiFilters.dateFrom) ||
    Boolean(uiFilters.dateTo) ||
    uiFilters.assignedToMe;

  return {
    filters,
    uiFilters,
    hasActiveFilters,
    setStatusFilter,
    setCompanyFilter,
    setConfidentialityFilter,
    setDateFromFilter,
    setDateToFilter,
    setAssignedToMeFilter,
    setSort,
    setCursor,
    clearFilters,
  };
}
