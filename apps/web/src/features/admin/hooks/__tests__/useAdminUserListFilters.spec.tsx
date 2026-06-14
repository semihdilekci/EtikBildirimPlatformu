import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useAdminUserListFilters } from '@/features/admin/hooks/useAdminUserListFilters';

function renderFiltersHook(initialEntry = '/app/admin/users') {
  return renderHook(() => useAdminUserListFilters(), {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
    ),
  });
}

describe('useAdminUserListFilters', () => {
  it('should parse URL filters into query object', () => {
    const { result } = renderFiltersHook(
      '/app/admin/users?search=ali&companyId=co-1&roleCode=admin&isActive=true&cursor=abc',
    );

    expect(result.current.filters).toMatchObject({
      search: 'ali',
      companyId: 'co-1',
      roleCode: 'admin',
      isActive: true,
      cursor: 'abc',
      limit: 20,
    });
  });

  it('should ignore search shorter than 2 characters in API filters', () => {
    const { result } = renderFiltersHook('/app/admin/users?search=a');

    expect(result.current.filters.search).toBeUndefined();
    expect(result.current.uiFilters.search).toBe('a');
  });

  it('should update company filter and reset cursor', () => {
    const { result } = renderFiltersHook('/app/admin/users?cursor=abc');

    act(() => {
      result.current.setCompanyFilter('company-42');
    });

    expect(result.current.filters.companyId).toBe('company-42');
    expect(result.current.filters.cursor).toBeUndefined();
  });

  it('should clear all filters', () => {
    const { result } = renderFiltersHook('/app/admin/users?search=test&pendingOnly=true');

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.uiFilters.pendingOnly).toBe(false);
  });
});
