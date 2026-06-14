import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApproveAdminUserClearanceBody,
  ApproveAdminUserRoleBody,
  AssignAdminUserRoleBody,
  ListAdminUsersQuery,
  RevokeAdminUserRoleBody,
  UpdateAdminUserClearanceBody,
} from '@ethics/dto';

import { queryKeys } from '@/api/query-keys';
import {
  approveAdminUserClearance,
  approveAdminUserRole,
  assignAdminUserRole,
  fetchAdminUserDetail,
  fetchAdminUsers,
  revokeAdminUserRole,
  updateAdminUserClearance,
} from '@/features/admin/api/admin-users.api';

const THIRTY_SECONDS_MS = 30 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useAdminUsersListQuery(filters: ListAdminUsersQuery) {
  return useQuery({
    queryKey: queryKeys.admin.users.list(filters),
    queryFn: () => fetchAdminUsers(filters),
    staleTime: THIRTY_SECONDS_MS,
    gcTime: FIVE_MINUTES_MS,
    placeholderData: (previous) => previous,
  });
}

export function useAdminUserDetailQuery(userId: string) {
  return useQuery({
    queryKey: queryKeys.admin.users.detail(userId),
    queryFn: () => fetchAdminUserDetail(userId),
    enabled: Boolean(userId),
    staleTime: 0,
  });
}

function useInvalidateAdminUserQueries(userId: string) {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.detail(userId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all() }),
    ]);
  };
}

export function useAssignAdminUserRoleMutation(userId: string) {
  const invalidate = useInvalidateAdminUserQueries(userId);

  return useMutation({
    mutationFn: (body: AssignAdminUserRoleBody) => assignAdminUserRole(userId, body),
    onSuccess: invalidate,
  });
}

export function useApproveAdminUserRoleMutation(userId: string) {
  const invalidate = useInvalidateAdminUserQueries(userId);

  return useMutation({
    mutationFn: ({ roleId, body }: { roleId: string; body: ApproveAdminUserRoleBody }) =>
      approveAdminUserRole(userId, roleId, body),
    onSuccess: invalidate,
  });
}

export function useRevokeAdminUserRoleMutation(userId: string) {
  const invalidate = useInvalidateAdminUserQueries(userId);

  return useMutation({
    mutationFn: ({ roleId, body }: { roleId: string; body: RevokeAdminUserRoleBody }) =>
      revokeAdminUserRole(userId, roleId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateAdminUserClearanceMutation(userId: string) {
  const invalidate = useInvalidateAdminUserQueries(userId);

  return useMutation({
    mutationFn: (body: UpdateAdminUserClearanceBody) => updateAdminUserClearance(userId, body),
    onSuccess: invalidate,
  });
}

export function useApproveAdminUserClearanceMutation(userId: string) {
  const invalidate = useInvalidateAdminUserQueries(userId);

  return useMutation({
    mutationFn: ({ requestId, body }: { requestId: string; body: ApproveAdminUserClearanceBody }) =>
      approveAdminUserClearance(userId, requestId, body),
    onSuccess: invalidate,
  });
}
