import { Role, type Role as RoleCode } from '@ethics/shared';

import { PermissionCode, type PermissionCode as Permission } from './permissions.js';

/**
 * Rol × permission matrisi — Docs/07_SECURITY_IMPLEMENTATION.md §3.5
 * ABAC (company, assignment, clearance) PolicyScope/PolicyGuard katmanında uygulanır.
 */
export const ROLE_PERMISSION_MAP: Readonly<Record<RoleCode, ReadonlySet<Permission>>> = {
  [Role.COUNCIL_SECRETARY]: new Set([
    PermissionCode.CASE_LIST,
    PermissionCode.CASE_READ,
    PermissionCode.CASE_TRANSITION,
    PermissionCode.CASE_PRE_REVIEW,
    PermissionCode.CASE_SET_AGENDA,
    PermissionCode.CASE_ASSIGN_RAPPORTEUR,
    PermissionCode.CASE_UPDATE_CONFIDENTIALITY,
    PermissionCode.DOCUMENT_UPLOAD,
    PermissionCode.DOCUMENT_DOWNLOAD,
    PermissionCode.TASK_LIST,
    PermissionCode.TASK_COMPLETE,
    PermissionCode.TASK_DELEGATE,
    PermissionCode.SECURE_MESSAGE_READ,
    PermissionCode.SECURE_MESSAGE_WRITE,
    PermissionCode.NOTIFICATION_LIST,
    PermissionCode.NOTIFICATION_MARK_READ,
    PermissionCode.AUTH_SESSION_READ,
  ]),

  [Role.COUNCIL_CHAIR]: new Set([
    PermissionCode.CASE_LIST,
    PermissionCode.CASE_READ,
    PermissionCode.CASE_TRANSITION,
    PermissionCode.CASE_UPDATE_CONFIDENTIALITY,
    PermissionCode.COUNCIL_VOTE_DECISION,
    PermissionCode.DOCUMENT_DOWNLOAD,
    PermissionCode.TASK_LIST,
    PermissionCode.TASK_COMPLETE,
    PermissionCode.TASK_DELEGATE,
    PermissionCode.NOTIFICATION_LIST,
    PermissionCode.NOTIFICATION_MARK_READ,
    PermissionCode.AUTH_SESSION_READ,
  ]),

  [Role.COUNCIL_MEMBER]: new Set([
    PermissionCode.CASE_LIST,
    PermissionCode.CASE_READ,
    PermissionCode.CASE_TRANSITION,
    PermissionCode.COUNCIL_VOTE_DECISION,
    PermissionCode.DOCUMENT_DOWNLOAD,
    PermissionCode.TASK_LIST,
    PermissionCode.TASK_COMPLETE,
    PermissionCode.TASK_DELEGATE,
    PermissionCode.NOTIFICATION_LIST,
    PermissionCode.NOTIFICATION_MARK_READ,
    PermissionCode.AUTH_SESSION_READ,
  ]),

  [Role.BOARD_CHAIR]: new Set([
    PermissionCode.CASE_LIST,
    PermissionCode.CASE_READ,
    PermissionCode.CASE_TRANSITION,
    PermissionCode.BOARD_APPROVE_OR_VETO,
    PermissionCode.DOCUMENT_DOWNLOAD,
    PermissionCode.TASK_LIST,
    PermissionCode.TASK_COMPLETE,
    PermissionCode.TASK_DELEGATE,
    PermissionCode.NOTIFICATION_LIST,
    PermissionCode.NOTIFICATION_MARK_READ,
    PermissionCode.AUTH_SESSION_READ,
  ]),

  [Role.RAPPORTEUR]: new Set([
    PermissionCode.CASE_LIST,
    PermissionCode.CASE_READ,
    PermissionCode.CASE_TRANSITION,
    PermissionCode.REPORT_FILE_UPLOAD,
    PermissionCode.DOCUMENT_UPLOAD,
    PermissionCode.DOCUMENT_DOWNLOAD,
    PermissionCode.TASK_LIST,
    PermissionCode.TASK_COMPLETE,
    PermissionCode.TASK_DELEGATE,
    PermissionCode.NOTIFICATION_LIST,
    PermissionCode.NOTIFICATION_MARK_READ,
    PermissionCode.AUTH_SESSION_READ,
  ]),

  [Role.ACTION_OWNER]: new Set([
    PermissionCode.CASE_LIST,
    PermissionCode.CASE_READ,
    PermissionCode.CASE_TRANSITION,
    PermissionCode.ACTION_RESPOND,
    PermissionCode.DOCUMENT_UPLOAD,
    PermissionCode.DOCUMENT_DOWNLOAD,
    PermissionCode.TASK_LIST,
    PermissionCode.TASK_COMPLETE,
    PermissionCode.TASK_DELEGATE,
    PermissionCode.NOTIFICATION_LIST,
    PermissionCode.NOTIFICATION_MARK_READ,
    PermissionCode.AUTH_SESSION_READ,
  ]),

  [Role.ADMIN]: new Set([
    PermissionCode.CASE_LIST,
    PermissionCode.CASE_READ,
    PermissionCode.ADMIN_MANAGE_ROLES,
    PermissionCode.ADMIN_MANAGE_SETTINGS,
    PermissionCode.ADMIN_VIEW_SYNC_STATUS,
    PermissionCode.AUDIT_VIEW_METADATA,
    PermissionCode.NOTIFICATION_LIST,
    PermissionCode.NOTIFICATION_MARK_READ,
    PermissionCode.AUTH_SESSION_READ,
  ]),
};

export function getPermissionsForRole(role: RoleCode): ReadonlySet<Permission> {
  return ROLE_PERMISSION_MAP[role];
}

export function roleHasPermission(role: RoleCode, permission: Permission): boolean {
  return ROLE_PERMISSION_MAP[role].has(permission);
}

export function rolesHavePermission(roles: readonly RoleCode[], permission: Permission): boolean {
  return roles.some((role) => roleHasPermission(role, permission));
}
