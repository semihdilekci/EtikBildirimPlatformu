import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useAdminAuditFilters } from '@/features/admin/hooks/useAdminAuditFilters';

function renderAuditFiltersHook(initialEntry = '/app/admin/audit') {
  return renderHook(() => useAdminAuditFilters(), {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
    ),
  });
}

describe('useAdminAuditFilters', () => {
  it('should apply default 7-day date range when URL has no dates', () => {
    const { result } = renderAuditFiltersHook('/app/admin/audit');

    expect(result.current.uiFilters.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.current.uiFilters.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.current.filters.dateFrom).toBeDefined();
    expect(result.current.filters.dateTo).toBeDefined();
  });

  it('should parse event type and resource filters from URL', () => {
    const { result } = renderAuditFiltersHook(
      '/app/admin/audit?eventType=CASE_VIEWED&resourceType=case&resourceId=case-1&cursor=abc',
    );

    expect(result.current.filters).toMatchObject({
      eventType: 'CASE_VIEWED',
      resourceType: 'case',
      resourceId: 'case-1',
      cursor: 'abc',
      limit: 50,
    });
  });

  it('should reset cursor when filter changes', () => {
    const { result } = renderAuditFiltersHook('/app/admin/audit?cursor=abc');

    act(() => {
      result.current.setEventTypeFilter('CASE_TRANSITION');
    });

    expect(result.current.filters.eventType).toBe('CASE_TRANSITION');
    expect(result.current.filters.cursor).toBeUndefined();
  });

  it('should clear all filters', () => {
    const { result } = renderAuditFiltersHook(
      '/app/admin/audit?eventType=CASE_VIEWED&actorUserId=user-1',
    );

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.filters.eventType).toBeUndefined();
  });
});
