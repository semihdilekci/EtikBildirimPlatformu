import type {
  AdminUserDetail,
  ApproveAdminUserClearanceBody,
  ApproveAdminUserRoleBody,
  AssignAdminUserRoleBody,
  AssignAdminUserRoleResponse,
  ListAdminUsersQuery,
  ListAdminUsersResponse,
  RevokeAdminUserRoleBody,
  UpdateAdminUserClearanceBody,
  UpdateAdminUserClearanceResponse,
} from '@ethics/dto';

import { apiClient } from '@/api/client';
import type { ApiSuccessEnvelope } from '@/types/api.types';

function buildListQueryParams(
  query: ListAdminUsersQuery,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {
    limit: query.limit,
  };

  if (query.search) {
    params.search = query.search;
  }

  if (query.companyId) {
    params.companyId = query.companyId;
  }

  if (query.roleCode) {
    params.roleCode = query.roleCode;
  }

  if (query.isActive !== undefined) {
    params.isActive = query.isActive;
  }

  if (query.cursor) {
    params.cursor = query.cursor;
  }

  return params;
}

export async function fetchAdminUsers(query: ListAdminUsersQuery): Promise<ListAdminUsersResponse> {
  const response = await apiClient.get<ListAdminUsersResponse>('/admin/users', {
    params: buildListQueryParams(query),
  });
  return response.data;
}

export async function fetchAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const response = await apiClient.get<ApiSuccessEnvelope<AdminUserDetail>>(
    `/admin/users/${userId}`,
  );
  return response.data.data;
}

export async function assignAdminUserRole(
  userId: string,
  body: AssignAdminUserRoleBody,
): Promise<AssignAdminUserRoleResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<AssignAdminUserRoleResponse>>(
    `/admin/users/${userId}/roles`,
    body,
  );
  return response.data.data;
}

export async function approveAdminUserRole(
  userId: string,
  roleId: string,
  body: ApproveAdminUserRoleBody,
): Promise<void> {
  await apiClient.post(`/admin/users/${userId}/roles/${roleId}/approve`, body);
}

export async function revokeAdminUserRole(
  userId: string,
  roleId: string,
  body: RevokeAdminUserRoleBody,
): Promise<void> {
  await apiClient.delete(`/admin/users/${userId}/roles/${roleId}`, { data: body });
}

export async function updateAdminUserClearance(
  userId: string,
  body: UpdateAdminUserClearanceBody,
): Promise<UpdateAdminUserClearanceResponse> {
  const response = await apiClient.patch<ApiSuccessEnvelope<UpdateAdminUserClearanceResponse>>(
    `/admin/users/${userId}/clearance`,
    body,
  );
  return response.data.data;
}

export async function approveAdminUserClearance(
  userId: string,
  requestId: string,
  body: ApproveAdminUserClearanceBody,
): Promise<void> {
  await apiClient.post(`/admin/users/${userId}/clearance/${requestId}/approve`, body);
}
