import type { ListAdminDocumentOperationsQuery } from '@ethics/dto';
import { MalwareScanStatus } from '@ethics/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { dateInputToEndIso, dateInputToStartIso } from '@/features/cases/utils/case-format.util';

const DEFAULT_LIMIT = 50;

export function useAdminDocumentOpsFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const uiFilters = useMemo(
    () => ({
      scanStatus: searchParams.get('scanStatus') ?? '',
      mimeType: searchParams.get('mimeType') ?? '',
      dateFrom: searchParams.get('dateFrom') ?? '',
      dateTo: searchParams.get('dateTo') ?? '',
    }),
    [searchParams],
  );

  const filters = useMemo((): ListAdminDocumentOperationsQuery => {
    const query: ListAdminDocumentOperationsQuery = {
      limit: DEFAULT_LIMIT,
      cursor: searchParams.get('cursor') ?? undefined,
    };

    if (
      uiFilters.scanStatus &&
      Object.values(MalwareScanStatus).includes(
        uiFilters.scanStatus as (typeof MalwareScanStatus)[keyof typeof MalwareScanStatus],
      )
    ) {
      query.scanStatus = uiFilters.scanStatus;
    }
    if (uiFilters.mimeType) {
      query.mimeType = uiFilters.mimeType;
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

  const setScanStatusFilter = useCallback(
    (scanStatus: string) => {
      updateParams({ scanStatus: scanStatus || null });
    },
    [updateParams],
  );

  const setMimeTypeFilter = useCallback(
    (mimeType: string) => {
      updateParams({ mimeType: mimeType || null });
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

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const hasActiveFilters =
    Boolean(uiFilters.scanStatus) ||
    Boolean(uiFilters.mimeType) ||
    Boolean(uiFilters.dateFrom) ||
    Boolean(uiFilters.dateTo);

  return {
    filters,
    uiFilters,
    hasActiveFilters,
    setScanStatusFilter,
    setMimeTypeFilter,
    setDateFromFilter,
    setDateToFilter,
    setCursor,
    clearFilters,
  };
}
