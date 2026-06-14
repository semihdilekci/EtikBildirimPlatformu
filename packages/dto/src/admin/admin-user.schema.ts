import { CLEARANCE_LEVEL_VALUES, ROLE_VALUES } from '@ethics/shared';
import { z } from 'zod';

export const adminUserRoleStatusValues = ['ACTIVE', 'PENDING_APPROVAL', 'REVOKED'] as const;

export const listAdminUsersQuerySchema = z.object({
  search: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
  roleCode: z.enum(ROLE_VALUES as [string, ...string[]]).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().min(1).optional(),
});

export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;

export const adminUserRoleSchema = z.object({
  id: z.string(),
  roleCode: z.enum(ROLE_VALUES as [string, ...string[]]),
  status: z.enum(adminUserRoleStatusValues),
  assignedBy: z.string(),
  assignedByDisplayName: z.string(),
  approvedBy: z.string().nullable(),
  approvedByDisplayName: z.string().nullable(),
  reason: z.string().nullable(),
  assignedAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
});

export type AdminUserRole = z.infer<typeof adminUserRoleSchema>;

export const adminUserListItemSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  companyId: z.string().nullable(),
  companyName: z.string().nullable(),
  clearanceLevel: z.enum(CLEARANCE_LEVEL_VALUES as [string, ...string[]]),
  roles: z.array(
    z.object({
      roleCode: z.enum(ROLE_VALUES as [string, ...string[]]),
      status: z.enum(adminUserRoleStatusValues),
    }),
  ),
  isActive: z.boolean(),
  lastLoginAt: z.string().datetime().nullable(),
  provisionedAt: z.string().datetime().nullable(),
});

export type AdminUserListItem = z.infer<typeof adminUserListItemSchema>;

export const adminUserPaginationSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type AdminUserPagination = z.infer<typeof adminUserPaginationSchema>;

export const listAdminUsersResponseSchema = z.object({
  data: z.array(adminUserListItemSchema),
  pagination: adminUserPaginationSchema,
});

export type ListAdminUsersResponse = z.infer<typeof listAdminUsersResponseSchema>;

export const adminPendingApprovalSchema = z.object({
  id: z.string(),
  type: z.enum(['ROLE_ASSIGNMENT', 'CLEARANCE_CHANGE']),
  requestedBy: z.string(),
  requestedByDisplayName: z.string(),
  requestedAt: z.string().datetime(),
  summary: z.string(),
  roleCode: z.enum(ROLE_VALUES as [string, ...string[]]).optional(),
  requestedClearanceLevel: z.enum(CLEARANCE_LEVEL_VALUES as [string, ...string[]]).optional(),
});

export type AdminPendingApproval = z.infer<typeof adminPendingApprovalSchema>;

export const adminUserDetailSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  companyId: z.string().nullable(),
  companyName: z.string().nullable(),
  locationId: z.string().nullable(),
  locationName: z.string().nullable(),
  functionId: z.string().nullable(),
  functionName: z.string().nullable(),
  positionCode: z.string().nullable(),
  employeeId: z.string().nullable(),
  clearanceLevel: z.enum(CLEARANCE_LEVEL_VALUES as [string, ...string[]]),
  isActive: z.boolean(),
  isGeneralSecretary: z.boolean(),
  lastLoginAt: z.string().datetime().nullable(),
  provisionedAt: z.string().datetime().nullable(),
  roles: z.array(adminUserRoleSchema),
  pendingApprovals: z.array(adminPendingApprovalSchema),
  hrSync: z.object({
    sourceSystem: z.string().nullable(),
    sourceUpdatedAt: z.string().datetime().nullable(),
    syncStatus: z.enum(['SYNCED', 'UNKNOWN']),
  }),
});

export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

export const assignAdminUserRoleBodySchema = z.object({
  roleCode: z.enum(ROLE_VALUES as [string, ...string[]]),
  reason: z.string().trim().min(3).max(500),
});

export type AssignAdminUserRoleBody = z.infer<typeof assignAdminUserRoleBodySchema>;

export const assignAdminUserRoleResponseSchema = z.object({
  id: z.string(),
  roleCode: z.enum(ROLE_VALUES as [string, ...string[]]),
  status: z.literal('PENDING_APPROVAL'),
  assignedBy: z.string(),
  reason: z.string(),
});

export type AssignAdminUserRoleResponse = z.infer<typeof assignAdminUserRoleResponseSchema>;

export const approveAdminUserRoleBodySchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

export type ApproveAdminUserRoleBody = z.infer<typeof approveAdminUserRoleBodySchema>;

export const revokeAdminUserRoleBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export type RevokeAdminUserRoleBody = z.infer<typeof revokeAdminUserRoleBodySchema>;

export const updateAdminUserClearanceBodySchema = z.object({
  clearanceLevel: z.enum(CLEARANCE_LEVEL_VALUES as [string, ...string[]]),
  reason: z.string().trim().min(3).max(500),
});

export type UpdateAdminUserClearanceBody = z.infer<typeof updateAdminUserClearanceBodySchema>;

export const updateAdminUserClearanceResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('UPDATED'),
    clearanceLevel: z.enum(CLEARANCE_LEVEL_VALUES as [string, ...string[]]),
  }),
  z.object({
    status: z.literal('PENDING_APPROVAL'),
    requestId: z.string(),
    clearanceLevel: z.enum(CLEARANCE_LEVEL_VALUES as [string, ...string[]]),
  }),
]);

export type UpdateAdminUserClearanceResponse = z.infer<
  typeof updateAdminUserClearanceResponseSchema
>;

export const approveAdminUserClearanceBodySchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

export type ApproveAdminUserClearanceBody = z.infer<typeof approveAdminUserClearanceBodySchema>;
