import { Role } from '@ethics/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { RoleGuard } from '@/routes/guards/RoleGuard';
import { buildAuthMeUser } from '@/test/auth-fixtures';
import { useAuthStore } from '@/stores/useAuthStore';

function renderAdminRoute(roles: readonly Role[]) {
  useAuthStore.getState().setUser(buildAuthMeUser(roles));

  return render(
    <MemoryRouter initialEntries={['/app/admin/users']}>
      <Routes>
        <Route path="/403" element={<div data-testid="forbidden-page">403</div>} />
        <Route element={<RoleGuard roles={[Role.ADMIN]} />}>
          <Route path="/app/admin/users" element={<div data-testid="admin-page">Admin</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleGuard', () => {
  it('should redirect non-admin user to /403', () => {
    renderAdminRoute([Role.COUNCIL_SECRETARY]);

    expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument();
  });

  it('should redirect roleless user to /403', () => {
    renderAdminRoute([]);

    expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument();
  });

  it('should allow admin user to access protected route', () => {
    renderAdminRoute([Role.ADMIN]);

    expect(screen.getByTestId('admin-page')).toBeInTheDocument();
    expect(screen.queryByTestId('forbidden-page')).not.toBeInTheDocument();
  });
});
