import type { ListAdminAuditEventsQuery } from '@ethics/dto';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { dateInputToEndIso, dateInputToStartIso } from '@/features/cases/utils/case-format.util';

const DEFAULT_LIMIT = 50;

function defaultDateFromInput(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().slice(0, 10);
}

function defaultDateToInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useAdminAuditFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const uiFilters = useMemo(
    () => ({
      eventType: searchParams.get('eventType') ?? '',
      actorUserId: searchParams.get('actorUserId') ?? '',
      resourceType: searchParams.get('resourceType') ?? '',
      resourceId: searchParams.get('resourceId') ?? '',
      dateFrom: searchParams.get('dateFrom') ?? defaultDateFromInput(),
      dateTo: searchParams.get('dateTo') ?? defaultDateToInput(),
      filtersExpanded: searchParams.get('filtersExpanded') === 'true',
    }),
    [searchParams],
  );

  const filters = useMemo((): ListAdminAuditEventsQuery => {
    const query: ListAdminAuditEventsQuery = {
      limit: DEFAULT_LIMIT,
      cursor: searchParams.get('cursor') ?? undefined,
    };

    if (uiFilters.eventType) {
      query.eventType = uiFilters.eventType;
    }
    if (uiFilters.actorUserId) {
      query.actorUserId = uiFilters.actorUserId;
    }
    if (uiFilters.resourceType) {
      query.resourceType = uiFilters.resourceType;
    }
    if (uiFilters.resourceId) {
      query.resourceId = uiFilters.resourceId;
    }
    if (uiFilters.dateFrom) {
      query.dateFrom = dateInputToStartIso(uiFilters.dateFrom);
    }
    if (uiFilters.dateTo) {
      query.dateTo = dateInputToEndIso(uiFilters.dateTo);
    }

    return query;
  }, [searchParams, uiFilters]);

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

  const setEventTypeFilter = useCallback(
    (eventType: string) => {
      updateParams({ eventType: eventType || null });
    },
    [updateParams],
  );

  const setActorUserIdFilter = useCallback(
    (actorUserId: string) => {
      updateParams({ actorUserId: actorUserId || null });
    },
    [updateParams],
  );

  const setResourceTypeFilter = useCallback(
    (resourceType: string) => {
      updateParams({ resourceType: resourceType || null });
    },
    [updateParams],
  );

  const setResourceIdFilter = useCallback(
    (resourceId: string) => {
      updateParams({ resourceId: resourceId || null });
    },
    [updateParams],
  );

  const setDateFromFilter = useCallback(
    (dateFrom: string) => {
      updateParams({ dateFrom: dateFrom || null });
    },
    [updateParams],
  );

  const setDateToFilter = useCallback(
    (dateTo: string) => {
      updateParams({ dateTo: dateTo || null });
    },
    [updateParams],
  );

  const setCursor = useCallback(
    (cursor: string | null) => {
      updateParams({ cursor }, false);
    },
    [updateParams],
  );

  const toggleFiltersExpanded = useCallback(() => {
    updateParams({ filtersExpanded: uiFilters.filtersExpanded ? null : 'true' }, false);
  }, [updateParams, uiFilters.filtersExpanded]);

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const hasActiveFilters =
    Boolean(uiFilters.eventType) ||
    Boolean(uiFilters.actorUserId) ||
    Boolean(uiFilters.resourceType) ||
    Boolean(uiFilters.resourceId) ||
    uiFilters.dateFrom !== defaultDateFromInput() ||
    uiFilters.dateTo !== defaultDateToInput();

  return {
    filters,
    uiFilters,
    hasActiveFilters,
    setEventTypeFilter,
    setActorUserIdFilter,
    setResourceTypeFilter,
    setResourceIdFilter,
    setDateFromFilter,
    setDateToFilter,
    setCursor,
    toggleFiltersExpanded,
    clearFilters,
  };
}
