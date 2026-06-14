import type { AdminPendingApproval, AdminUserListItem, AdminUserRole } from '@ethics/dto';
import { Role } from '@ethics/shared';
import type {
  ClearanceChangeRequest,
  Company,
  Function,
  Location,
  User,
  UserRole,
} from '@prisma/client';

export type AdminUserRoleStatus = AdminUserRole['status'];

export function deriveUserRoleStatus(role: UserRole): AdminUserRoleStatus {
  if (role.revokedAt) {
    return 'REVOKED';
  }

  if (!role.isActive && role.approvedBy === null) {
    return 'PENDING_APPROVAL';
  }

  if (role.isActive) {
    return 'ACTIVE';
  }

  return 'REVOKED';
}

type UserWithRelations = User & {
  company: Pick<Company, 'id' | 'name'> | null;
  location?: Pick<Location, 'id' | 'name'> | null;
  function?: Pick<Function, 'id' | 'name'> | null;
  rolesAssigned: UserRole[];
};

type UserRoleWithActors = UserRole & {
  assignedByUser: Pick<User, 'id' | 'displayName'>;
  approvedByUser: Pick<User, 'id' | 'displayName'> | null;
};

export function toAdminUserListItem(user: UserWithRelations): AdminUserListItem {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    companyId: user.companyId,
    companyName: user.company?.name ?? null,
    clearanceLevel: user.clearanceLevel,
    roles: user.rolesAssigned.map((role) => ({
      roleCode: role.roleCode as Role,
      status: deriveUserRoleStatus(role),
    })),
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    provisionedAt: user.provisionedAt?.toISOString() ?? null,
  };
}

export function toAdminUserRole(role: UserRoleWithActors): AdminUserRole {
  return {
    id: role.id,
    roleCode: role.roleCode,
    status: deriveUserRoleStatus(role),
    assignedBy: role.assignedBy,
    assignedByDisplayName: role.assignedByUser.displayName,
    approvedBy: role.approvedBy,
    approvedByDisplayName: role.approvedByUser?.displayName ?? null,
    reason: role.reason,
    assignedAt: role.assignedAt.toISOString(),
    revokedAt: role.revokedAt?.toISOString() ?? null,
  };
}

export function toPendingRoleApproval(
  role: UserRole & { assignedByUser: Pick<User, 'id' | 'displayName'> },
): AdminPendingApproval {
  return {
    id: role.id,
    type: 'ROLE_ASSIGNMENT',
    requestedBy: role.assignedBy,
    requestedByDisplayName: role.assignedByUser.displayName,
    requestedAt: role.assignedAt.toISOString(),
    summary: `${role.roleCode} rol ataması onay bekliyor`,
    roleCode: role.roleCode,
  };
}

export function toPendingClearanceApproval(
  request: ClearanceChangeRequest & {
    requestedByUser: Pick<User, 'id' | 'displayName'>;
  },
): AdminPendingApproval {
  return {
    id: request.id,
    type: 'CLEARANCE_CHANGE',
    requestedBy: request.requestedBy,
    requestedByDisplayName: request.requestedByUser.displayName,
    requestedAt: request.createdAt.toISOString(),
    summary: `Clearance ${request.currentLevel} → ${request.requestedLevel}`,
    requestedClearanceLevel: request.requestedLevel,
  };
}

export function encodeAdminUserCursor(userId: string, createdAt: Date): string {
  return Buffer.from(
    JSON.stringify({ id: userId, createdAt: createdAt.toISOString() }),
    'utf8',
  ).toString('base64url');
}

export function decodeAdminUserCursor(cursor: string): { id: string; createdAt: Date } {
  const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
    id?: string;
    createdAt?: string;
  };

  if (!parsed.id || !parsed.createdAt) {
    throw new Error('Invalid admin user cursor');
  }

  return {
    id: parsed.id,
    createdAt: new Date(parsed.createdAt),
  };
}
