import { PermissionCode } from '@ethics/policy';
import { Role } from '@ethics/shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { buildAuthMeUser } from '@/test/auth-fixtures';
import { useAuthStore } from '@/stores/useAuthStore';

describe('usePermissions', () => {
  it('should deny all permissions for roleless JIT user', () => {
    useAuthStore.getState().setUser(buildAuthMeUser([]));

    const { result } = renderHook(() => usePermissions());

    expect(result.current.roles).toEqual([]);
    expect(result.current.hasPermission(PermissionCode.CASE_LIST)).toBe(false);
    expect(result.current.hasPermission(PermissionCode.AUTH_SESSION_READ)).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });

  it('should grant council_secretary case and task permissions', () => {
    useAuthStore.getState().setUser(buildAuthMeUser([Role.COUNCIL_SECRETARY]));

    const { result } = renderHook(() => usePermissions());

    expect(result.current.hasPermission(PermissionCode.CASE_LIST)).toBe(true);
    expect(result.current.hasPermission(PermissionCode.TASK_LIST)).toBe(true);
    expect(result.current.hasPermission(PermissionCode.ADMIN_MANAGE_ROLES)).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });

  it('should identify admin role and admin permissions', () => {
    useAuthStore.getState().setUser(buildAuthMeUser([Role.ADMIN]));

    const { result } = renderHook(() => usePermissions());

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.hasAnyRole([Role.ADMIN])).toBe(true);
    expect(result.current.hasPermission(PermissionCode.ADMIN_MANAGE_ROLES)).toBe(true);
    expect(result.current.hasPermission(PermissionCode.CASE_TRANSITION)).toBe(false);
  });

  it('should union permissions across multiple roles', () => {
    useAuthStore.getState().setUser(buildAuthMeUser([Role.RAPPORTEUR, Role.ACTION_OWNER]));

    const { result } = renderHook(() => usePermissions());

    expect(result.current.hasPermission(PermissionCode.REPORT_FILE_UPLOAD)).toBe(true);
    expect(result.current.hasPermission(PermissionCode.ACTION_RESPOND)).toBe(true);
    expect(result.current.permissions.size).toBeGreaterThan(0);
  });
});
