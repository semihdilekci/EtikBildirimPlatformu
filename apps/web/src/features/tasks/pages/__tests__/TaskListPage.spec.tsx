import { ApprovalCategory, ApprovalWorkItemStatus, Role, WorkItemKind } from '@ethics/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskListPage } from '@/features/tasks/pages/TaskListPage';
import { buildAuthMeUser } from '@/test/auth-fixtures';
import { useAuthStore } from '@/stores/useAuthStore';

const useTasksListQueryMock = vi.fn();
const useTaskListTabMock = vi.fn();

vi.mock('@/features/tasks/hooks/useTasks', () => ({
  useTasksListQuery: (): ReturnType<typeof useTasksListQueryMock> => useTasksListQueryMock(),
}));

vi.mock('@/features/tasks/hooks/useTaskListTab', () => ({
  useTaskListTab: (): ReturnType<typeof useTaskListTabMock> => useTaskListTabMock(),
}));

const approvalRow = {
  kind: WorkItemKind.APPROVAL,
  id: 'approval-1',
  caseId: null,
  approvalCategory: ApprovalCategory.ROLE_ASSIGNMENT,
  approvalCategoryLabel: 'Rol Ataması Onayı',
  status: ApprovalWorkItemStatus.PENDING,
  assignedRole: Role.COUNCIL_SECRETARY,
  summary: 'Kullanıcıya admin rolü atanması talebi',
  requestedByDisplayName: 'Sistem Yöneticisi',
  requestedAt: '2026-06-14T10:00:00.000Z',
  dueAt: null,
  slaStatus: null,
  createdAt: '2026-06-14T10:00:00.000Z',
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app/tasks']}>
        <TaskListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TaskListPage', () => {
  beforeEach(() => {
    useAuthStore.getState().setUser(buildAuthMeUser([Role.COUNCIL_SECRETARY]));
    useTaskListTabMock.mockReset();
    useTasksListQueryMock.mockReset();

    useTaskListTabMock.mockReturnValue({
      activeTab: 'pending',
      tabLabels: {
        pending: 'Bekleyen',
        in_progress: 'Devam Eden',
        completed: 'Tamamlanan',
      },
      kind: '',
      listQuery: { status: ['PENDING'], limit: 20, sortBy: 'dueAt', sortOrder: 'asc' },
      pendingCountQuery: { status: ['PENDING'], limit: 100, sortBy: 'dueAt', sortOrder: 'asc' },
      setActiveTab: vi.fn(),
      setCursor: vi.fn(),
      setKind: vi.fn(),
      clearFilters: vi.fn(),
      hasActiveFilters: false,
    });
  });

  it('should render approval row with kind badge and category label', () => {
    useTasksListQueryMock.mockReturnValue({
      data: {
        data: [approvalRow],
        pagination: { nextCursor: null, hasMore: false, total: null },
      },
      isPending: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('Yapılandırma Onayı')).toBeTruthy();
    expect(screen.getByText('Rol Ataması Onayı')).toBeTruthy();
    expect(screen.getByLabelText('Onay durumu: Bekliyor')).toBeTruthy();
  });
});
