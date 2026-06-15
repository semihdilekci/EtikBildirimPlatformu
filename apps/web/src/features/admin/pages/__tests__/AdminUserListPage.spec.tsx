import { ClearanceLevel, Role } from '@ethics/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminUserListPage } from '@/features/admin/pages/AdminUserListPage';
import { buildAuthMeUser } from '@/test/auth-fixtures';
import { useAuthStore } from '@/stores/useAuthStore';

const mockUsers = [
  {
    id: 'user-1',
    email: 'admin@ethics.local',
    displayName: 'Admin User',
    companyId: null,
    companyName: null,
    clearanceLevel: ClearanceLevel.NORMAL,
    roles: [{ roleCode: Role.ADMIN, status: 'ACTIVE' as const }],
    isActive: true,
    lastLoginAt: '2026-06-14T10:00:00.000Z',
    provisionedAt: '2026-01-01T00:00:00.000Z',
  },
];

const useAdminUsersListQueryMock = vi.fn();

vi.mock('@/features/admin/hooks/useAdminUsers', () => ({
  useAdminUsersListQuery: (): ReturnType<typeof useAdminUsersListQueryMock> =>
    useAdminUsersListQueryMock(),
}));

vi.mock('@/features/intake/hooks/useIntakeQueries', () => ({
  useIntakeCompaniesQuery: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app/admin/users']}>
        <AdminUserListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminUserListPage', () => {
  beforeEach(() => {
    useAuthStore.getState().setUser(buildAuthMeUser([Role.ADMIN]));
    useAdminUsersListQueryMock.mockReset();
  });

  it('should render user rows when query returns ListAdminUsersResponse shape', () => {
    useAdminUsersListQueryMock.mockReturnValue({
      data: { data: mockUsers, pagination: { nextCursor: null, hasMore: false } },
      isLoading: false,
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByRole('heading', { name: 'Kullanıcı Yönetimi' })).toBeTruthy();
    expect(screen.getByText('Admin User')).toBeTruthy();
    expect(screen.getByText('admin@ethics.local')).toBeTruthy();
  });

  it('should not crash when query returns bare array (legacy API parse bug)', () => {
    useAdminUsersListQueryMock.mockReturnValue({
      data: mockUsers,
      isLoading: false,
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByRole('heading', { name: 'Kullanıcı Yönetimi' })).toBeTruthy();
    expect(screen.getByText('Kullanıcı bulunamadı.')).toBeTruthy();
  });
});
