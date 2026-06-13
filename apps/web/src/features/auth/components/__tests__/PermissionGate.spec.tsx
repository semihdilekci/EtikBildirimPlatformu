import { PermissionCode } from '@ethics/policy';
import { Role } from '@ethics/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PermissionGate } from '@/features/auth/components/PermissionGate';
import { buildAuthMeUser } from '@/test/auth-fixtures';
import { useAuthStore } from '@/stores/useAuthStore';

describe('PermissionGate', () => {
  it('should hide children when user lacks required permission', () => {
    useAuthStore.getState().setUser(buildAuthMeUser([]));

    render(
      <PermissionGate permission={PermissionCode.CASE_LIST}>
        <span data-testid="cases-link">Vakalar</span>
      </PermissionGate>,
    );

    expect(screen.queryByTestId('cases-link')).not.toBeInTheDocument();
  });

  it('should show children when user has required permission', () => {
    useAuthStore.getState().setUser(buildAuthMeUser([Role.COUNCIL_SECRETARY]));

    render(
      <PermissionGate permission={PermissionCode.CASE_LIST}>
        <span data-testid="cases-link">Vakalar</span>
      </PermissionGate>,
    );

    expect(screen.getByTestId('cases-link')).toBeInTheDocument();
  });

  it('should hide admin children for non-admin roles even with overlapping permissions', () => {
    useAuthStore.getState().setUser(buildAuthMeUser([Role.COUNCIL_SECRETARY]));

    render(
      <PermissionGate permission={PermissionCode.ADMIN_MANAGE_ROLES} roles={[Role.ADMIN]}>
        <span data-testid="admin-link">Kullanıcılar</span>
      </PermissionGate>,
    );

    expect(screen.queryByTestId('admin-link')).not.toBeInTheDocument();
  });

  it('should show admin children for admin role with permission', () => {
    useAuthStore.getState().setUser(buildAuthMeUser([Role.ADMIN]));

    render(
      <PermissionGate permission={PermissionCode.ADMIN_MANAGE_ROLES} roles={[Role.ADMIN]}>
        <span data-testid="admin-link">Kullanıcılar</span>
      </PermissionGate>,
    );

    expect(screen.getByTestId('admin-link')).toBeInTheDocument();
  });

  it('should render fallback when access is denied', () => {
    useAuthStore.getState().setUser(buildAuthMeUser([]));

    render(
      <PermissionGate
        permission={PermissionCode.TASK_LIST}
        fallback={<span data-testid="fallback">Gizli</span>}
      >
        <span data-testid="tasks-link">Görevlerim</span>
      </PermissionGate>,
    );

    expect(screen.queryByTestId('tasks-link')).not.toBeInTheDocument();
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });
});
