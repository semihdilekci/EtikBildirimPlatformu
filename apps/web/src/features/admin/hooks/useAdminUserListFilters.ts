import type { ListAdminUsersQuery } from '@ethics/dto';
import { ROLE_VALUES, type Role as RoleCode } from '@ethics/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const DEFAULT_LIST_QUERY: ListAdminUsersQuery = {
  limit: 20,
};

function parseRoleCodeParam(value: string | null): ListAdminUsersQuery['roleCode'] {
  if (!value) {
    return undefined;
  }

  return ROLE_VALUES.includes(value as RoleCode) ? value : undefined;
}

function parseIsActiveParam(value: string | null): ListAdminUsersQuery['isActive'] {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
}

export function useAdminUserListFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo((): ListAdminUsersQuery => {
    const search = searchParams.get('search') ?? undefined;

    return {
      ...DEFAULT_LIST_QUERY,
      search: search && search.length >= 2 ? search : undefined,
      companyId: searchParams.get('companyId') ?? undefined,
      roleCode: parseRoleCodeParam(searchParams.get('roleCode')),
      isActive: parseIsActiveParam(searchParams.get('isActive')),
      cursor: searchParams.get('cursor') ?? undefined,
    };
  }, [searchParams]);

  const uiFilters = useMemo(
    () => ({
      search: searchParams.get('search') ?? '',
      companyId: filters.companyId ?? '',
      roleCode: filters.roleCode ?? '',
      isActive: filters.isActive,
      pendingOnly: searchParams.get('pendingOnly') === 'true',
    }),
    [filters, searchParams],
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

  const setSearchFilter = useCallback(
    (search: string) => {
      updateParams({ search: search || null });
    },
    [updateParams],
  );

  const setCompanyFilter = useCallback(
    (companyId: string) => {
      updateParams({ companyId: companyId || null });
    },
    [updateParams],
  );

  const setRoleFilter = useCallback(
    (roleCode: string) => {
      updateParams({ roleCode: roleCode || null });
    },
    [updateParams],
  );

  const setIsActiveFilter = useCallback(
    (isActive: boolean | undefined) => {
      if (isActive === undefined) {
        updateParams({ isActive: null });
        return;
      }
      updateParams({ isActive: isActive ? 'true' : 'false' });
    },
    [updateParams],
  );

  const setPendingOnlyFilter = useCallback(
    (pendingOnly: boolean) => {
      updateParams({ pendingOnly: pendingOnly ? 'true' : null });
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
    Boolean(uiFilters.search) ||
    Boolean(uiFilters.companyId) ||
    Boolean(uiFilters.roleCode) ||
    uiFilters.isActive !== undefined ||
    uiFilters.pendingOnly;

  return {
    filters,
    uiFilters,
    hasActiveFilters,
    setSearchFilter,
    setCompanyFilter,
    setRoleFilter,
    setIsActiveFilter,
    setPendingOnlyFilter,
    setCursor,
    clearFilters,
  };
}
