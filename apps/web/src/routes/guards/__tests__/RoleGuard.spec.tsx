import { Role } from '@ethics/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { RoleGuard } from '@/routes/guards/RoleGuard';
import { buildAuthMeUser } from '@/test/auth-fixtures';
import { useAuthStore } from '@/stores/useAuthStore';

function renderAdminRoute(roles: readonly Role[], initialPath = '/app/admin/users') {
  useAuthStore.getState().setUser(buildAuthMeUser(roles));

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/403" element={<div data-testid="forbidden-page">403</div>} />
        <Route path="/app/admin" element={<Outlet />}>
          <Route element={<RoleGuard roles={[Role.ADMIN, Role.COUNCIL_SECRETARY]} />}>
            <Route path="kvkk-texts" element={<div data-testid="kvkk-page">KVKK</div>} />
          </Route>
          <Route element={<RoleGuard roles={[Role.ADMIN]} />}>
            <Route path="users" element={<div data-testid="admin-page">Admin</div>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleGuard', () => {
  it('should redirect non-admin user to /403', () => {
    renderAdminRoute([Role.COUNCIL_MEMBER]);

    expect(screen.getByTestId('forbidden-page')).toBeTruthy();
    expect(screen.queryByTestId('admin-page')).toBeNull();
  });

  it('should redirect roleless user to /403', () => {
    renderAdminRoute([]);

    expect(screen.getByTestId('forbidden-page')).toBeTruthy();
    expect(screen.queryByTestId('admin-page')).toBeNull();
  });

  it('should allow admin user to access protected route', () => {
    renderAdminRoute([Role.ADMIN]);

    expect(screen.getByTestId('admin-page')).toBeTruthy();
    expect(screen.queryByTestId('forbidden-page')).toBeNull();
  });

  it('should allow council secretary to access KVKK admin route', () => {
    renderAdminRoute([Role.COUNCIL_SECRETARY], '/app/admin/kvkk-texts');

    expect(screen.getByTestId('kvkk-page')).toBeTruthy();
    expect(screen.queryByTestId('forbidden-page')).toBeNull();
  });

  it('should redirect council secretary from admin-only route to /403', () => {
    renderAdminRoute([Role.COUNCIL_SECRETARY], '/app/admin/users');

    expect(screen.getByTestId('forbidden-page')).toBeTruthy();
    expect(screen.queryByTestId('admin-page')).toBeNull();
  });
});
