import { Role } from '@ethics/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AdminLayout } from '@/layouts/AdminLayout';
import { buildAuthMeUser } from '@/test/auth-fixtures';
import { useAuthStore } from '@/stores/useAuthStore';

function renderAdminLayout(initialPath = '/app/admin/users') {
  useAuthStore.getState().setUser(buildAuthMeUser([Role.ADMIN]));

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/app/admin" element={<AdminLayout />}>
            <Route path="users" element={<div>Admin users content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminLayout', () => {
  it('should show dashboard and cases navigation on admin screens', () => {
    renderAdminLayout();

    expect(screen.getByRole('link', { name: 'Gösterge Paneli' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Vakalar' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Kullanıcılar' })).toBeTruthy();
  });
});
