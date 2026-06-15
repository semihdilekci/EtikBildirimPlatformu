import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  ApproveAdminUserClearanceBody,
  ApproveAdminUserRoleBody,
  AssignAdminUserRoleBody,
  AssignAdminUserRoleResponse,
  ListAdminUsersQuery,
  RevokeAdminUserRoleBody,
  UpdateAdminUserClearanceBody,
  UpdateAdminUserClearanceResponse,
} from '@ethics/dto';
import {
  AdminActionCode,
  ApprovalWorkItemTargetType,
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  CLEARANCE_LEVEL_VALUES,
  ErrorCode,
  Role,
  ROLE_VALUES,
  requiresStrictlyConfidentialMakerChecker,
  type ClearanceLevel as ClearanceLevelCode,
  type Role as RoleCode,
} from '@ethics/shared';
import type { Prisma } from '@prisma/client';

import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { MakerCheckerService } from '../maker-checker/maker-checker.service.js';
import { ApprovalWorkItemService } from '../maker-checker/approval-work-item.service.js';
import {
  decodeAdminUserCursor,
  deriveUserRoleStatus,
  encodeAdminUserCursor,
  toAdminUserListItem,
  toAdminUserRole,
  toPendingClearanceApproval,
  toPendingRoleApproval,
} from './admin-user.mapper.js';

const ADMIN_USER_LIST_INCLUDE = {
  company: { select: { id: true, name: true } },
  rolesAssigned: true,
} as const satisfies Prisma.UserInclude;

const ADMIN_USER_DETAIL_INCLUDE = {
  company: { select: { id: true, name: true, sourceSystem: true, sourceUpdatedAt: true } },
  location: { select: { id: true, name: true } },
  function: { select: { id: true, name: true } },
  rolesAssigned: {
    include: {
      assignedByUser: { select: { id: true, displayName: true } },
      approvedByUser: { select: { id: true, displayName: true } },
    },
    orderBy: { assignedAt: 'desc' as const },
  },
} as const satisfies Prisma.UserInclude;

@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
    @Inject(MakerCheckerService) private readonly makerChecker: MakerCheckerService,
    @Inject(ApprovalWorkItemService)
    private readonly approvalWorkItemService: ApprovalWorkItemService,
  ) {}

  async listUsers(query: ListAdminUsersQuery) {
    const limit = query.limit;
    const where = this.buildListWhere(query);

    const users = await this.prisma.user.findMany({
      where,
      include: ADMIN_USER_LIST_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor
        ? {
            cursor: { id: decodeAdminUserCursor(query.cursor).id },
            skip: 1,
          }
        : {}),
    });

    const hasMore = users.length > limit;
    const page = hasMore ? users.slice(0, limit) : users;
    const last = page.at(-1);

    return {
      data: page.map(toAdminUserListItem),
      pagination: {
        nextCursor: hasMore && last ? encodeAdminUserCursor(last.id, last.createdAt) : null,
        hasMore,
      },
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: ADMIN_USER_DETAIL_INCLUDE,
    });

    if (!user) {
      throw new DomainException(
        ErrorCode.ADMIN_USER_NOT_FOUND,
        'Kullanıcı bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const pendingClearance = await this.prisma.clearanceChangeRequest.findMany({
      where: { userId, status: 'PENDING' },
      include: {
        requestedByUser: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pendingRoles = user.rolesAssigned.filter(
      (role) => deriveUserRoleStatus(role) === 'PENDING_APPROVAL',
    );

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
      locationId: user.locationId,
      locationName: user.location?.name ?? null,
      functionId: user.functionId,
      functionName: user.function?.name ?? null,
      positionCode: user.positionCode,
      employeeId: user.employeeId,
      clearanceLevel: user.clearanceLevel as ClearanceLevelCode,
      isActive: user.isActive,
      isGeneralSecretary: user.isGeneralSecretary,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      provisionedAt: user.provisionedAt?.toISOString() ?? null,
      roles: user.rolesAssigned.map(toAdminUserRole),
      pendingApprovals: [
        ...pendingRoles.map(toPendingRoleApproval),
        ...pendingClearance.map(toPendingClearanceApproval),
      ],
      hrSync: {
        sourceSystem: user.company?.sourceSystem ?? null,
        sourceUpdatedAt: user.company?.sourceUpdatedAt?.toISOString() ?? null,
        syncStatus: user.company?.sourceUpdatedAt ? ('SYNCED' as const) : ('UNKNOWN' as const),
      },
    };
  }

  async assignRole(
    actor: AuthenticatedUser,
    userId: string,
    body: AssignAdminUserRoleBody,
    correlationId: string,
  ): Promise<AssignAdminUserRoleResponse> {
    this.assertValidRoleCode(body.roleCode);
    const targetUser = await this.findUserOrThrow(userId);

    const actionCode = this.makerChecker.resolveRoleAssignmentAction(body.roleCode);
    this.makerChecker.assertMaker(actor, actionCode);

    const activeRole = await this.prisma.userRole.findFirst({
      where: { userId, roleCode: body.roleCode, isActive: true },
    });

    if (activeRole) {
      throw new DomainException(
        ErrorCode.ADMIN_ROLE_ALREADY_ACTIVE,
        'Kullanıcıda bu rol zaten aktif.',
        HttpStatus.CONFLICT,
      );
    }

    const pendingRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        roleCode: body.roleCode,
        isActive: false,
        approvedBy: null,
        revokedAt: null,
      },
    });

    if (pendingRole) {
      throw new DomainException(
        ErrorCode.ADMIN_ROLE_PENDING,
        'Bu rol için zaten onay bekleyen bir atama var.',
        HttpStatus.CONFLICT,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const roleAssignment = await tx.userRole.create({
        data: {
          userId,
          roleCode: body.roleCode,
          assignedBy: actor.id,
          reason: body.reason,
          isActive: false,
        },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.ROLE_ASSIGNMENT_REQUESTED,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'role_assignment_requested',
        outcome: AuditOutcome.ALLOWED,
        resourceType: 'user_role',
        resourceId: roleAssignment.id,
        correlationId,
        idempotencyKey: `role-assignment-request:${roleAssignment.id}`,
        metadata: {
          user_id: userId,
          role_code: body.roleCode,
          maker_user_id: actor.id,
          reason: body.reason,
        },
      });

      await this.approvalWorkItemService.createInTransaction(tx, {
        actionCode,
        requestedBy: actor.id,
        targetType: ApprovalWorkItemTargetType.USER_ROLE,
        targetId: roleAssignment.id,
        summary: this.approvalWorkItemService.buildRoleAssignmentSummary({
          roleCode: body.roleCode as RoleCode,
          targetDisplayName: targetUser.displayName,
        }),
        correlationId,
      });

      return roleAssignment;
    });

    return {
      id: created.id,
      roleCode: body.roleCode,
      status: 'PENDING_APPROVAL',
      assignedBy: actor.id,
      reason: body.reason,
    };
  }

  async approveRoleAssignment(
    checker: AuthenticatedUser,
    userId: string,
    roleId: string,
    body: ApproveAdminUserRoleBody,
    correlationId: string,
  ) {
    const roleAssignment = await this.prisma.userRole.findFirst({
      where: { id: roleId, userId },
    });

    if (!roleAssignment || deriveUserRoleStatus(roleAssignment) !== 'PENDING_APPROVAL') {
      throw new DomainException(
        ErrorCode.ADMIN_ROLE_NOT_FOUND,
        'Onay bekleyen rol ataması bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const actionCode = this.makerChecker.resolveRoleAssignmentAction(
      roleAssignment.roleCode as RoleCode,
    );
    this.makerChecker.assertChecker(checker, roleAssignment.assignedBy, actionCode);

    if (!body.approved) {
      const rejected = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.userRole.update({
          where: { id: roleAssignment.id },
          data: {
            revokedAt: new Date(),
            reason: body.reason,
          },
        });

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.ROLE_ASSIGNMENT_APPROVED,
          actorType: AuditActorType.USER,
          actorId: checker.id,
          action: 'role_assignment_rejected',
          outcome: AuditOutcome.DENIED,
          resourceType: 'user_role',
          resourceId: roleAssignment.id,
          correlationId,
          idempotencyKey: `role-assignment-reject:${roleAssignment.id}:${checker.id}`,
          metadata: {
            user_id: userId,
            role_code: roleAssignment.roleCode,
            checker_user_id: checker.id,
            reason: body.reason,
          },
        });

        await this.approvalWorkItemService.closeInTransaction(tx, {
          targetType: ApprovalWorkItemTargetType.USER_ROLE,
          targetId: roleAssignment.id,
          decidedBy: checker.id,
          approved: false,
          reason: body.reason,
        });

        return updated;
      });

      return {
        id: rejected.id,
        roleCode: rejected.roleCode as RoleCode,
        status: 'REVOKED' as const,
      };
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.userRole.update({
        where: { id: roleAssignment.id },
        data: {
          isActive: true,
          approvedBy: checker.id,
          reason: body.reason,
        },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.ROLE_ASSIGNMENT_APPROVED,
        actorType: AuditActorType.USER,
        actorId: checker.id,
        action: 'role_assignment_approved',
        outcome: AuditOutcome.ALLOWED,
        resourceType: 'user_role',
        resourceId: roleAssignment.id,
        correlationId,
        idempotencyKey: `role-assignment-approve:${roleAssignment.id}:${checker.id}`,
        metadata: {
          user_id: userId,
          role_code: roleAssignment.roleCode,
          checker_user_id: checker.id,
          reason: body.reason,
        },
      });

      await this.approvalWorkItemService.closeInTransaction(tx, {
        targetType: ApprovalWorkItemTargetType.USER_ROLE,
        targetId: roleAssignment.id,
        decidedBy: checker.id,
        approved: true,
        reason: body.reason,
      });

      await this.invalidateUserSessions(tx, userId);

      return updated;
    });

    return {
      id: approved.id,
      roleCode: approved.roleCode as RoleCode,
      status: 'ACTIVE' as const,
    };
  }

  async revokeRole(
    actor: AuthenticatedUser,
    userId: string,
    roleId: string,
    body: RevokeAdminUserRoleBody,
    correlationId: string,
  ) {
    const roleAssignment = await this.prisma.userRole.findFirst({
      where: { id: roleId, userId, isActive: true },
    });

    if (!roleAssignment) {
      throw new DomainException(
        ErrorCode.ADMIN_ROLE_NOT_FOUND,
        'Aktif rol ataması bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const actionCode = this.makerChecker.resolveRoleAssignmentAction(
      roleAssignment.roleCode as RoleCode,
    );
    this.makerChecker.assertMaker(actor, actionCode);

    const revoked = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.userRole.update({
        where: { id: roleAssignment.id },
        data: {
          isActive: false,
          revokedAt: new Date(),
          reason: body.reason,
        },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.ROLE_REVOKED,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'role_revoked',
        outcome: AuditOutcome.ALLOWED,
        resourceType: 'user_role',
        resourceId: roleAssignment.id,
        correlationId,
        idempotencyKey: `role-revoke:${roleAssignment.id}:${actor.id}`,
        metadata: {
          user_id: userId,
          role_code: roleAssignment.roleCode,
          revoker_user_id: actor.id,
          reason: body.reason,
        },
      });

      await this.invalidateUserSessions(tx, userId);

      return updated;
    });

    return {
      id: revoked.id,
      roleCode: revoked.roleCode as RoleCode,
      status: 'REVOKED' as const,
      revokedAt: revoked.revokedAt?.toISOString() ?? null,
    };
  }

  async updateClearance(
    actor: AuthenticatedUser,
    userId: string,
    body: UpdateAdminUserClearanceBody,
    correlationId: string,
  ): Promise<UpdateAdminUserClearanceResponse> {
    this.assertValidClearanceLevel(body.clearanceLevel);

    const user = await this.findUserOrThrow(userId);
    const currentLevel = user.clearanceLevel as ClearanceLevelCode;

    if (currentLevel === body.clearanceLevel) {
      throw new DomainException(
        ErrorCode.ADMIN_CLEARANCE_UNCHANGED,
        'Clearance seviyesi zaten bu değerde.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const needsMakerChecker = requiresStrictlyConfidentialMakerChecker(
      currentLevel,
      body.clearanceLevel,
    );

    if (needsMakerChecker) {
      this.makerChecker.assertMakerOrAdmin(
        actor,
        AdminActionCode.CLEARANCE_ELEVATE_STRICTLY_CONFIDENTIAL,
      );

      const pending = await this.prisma.clearanceChangeRequest.findFirst({
        where: { userId, status: 'PENDING' },
      });

      if (pending) {
        throw new DomainException(
          ErrorCode.MAKER_CHECKER_REQUIRED,
          'Bu kullanıcı için zaten onay bekleyen clearance değişikliği var.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const request = await this.prisma.$transaction(async (tx) => {
        const created = await tx.clearanceChangeRequest.create({
          data: {
            userId,
            requestedBy: actor.id,
            currentLevel,
            requestedLevel: body.clearanceLevel,
            reason: body.reason,
            status: 'PENDING',
          },
        });

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.CLEARANCE_CHANGE_REQUESTED,
          actorType: AuditActorType.USER,
          actorId: actor.id,
          action: 'clearance_change_requested',
          outcome: AuditOutcome.ALLOWED,
          resourceType: 'clearance_change_request',
          resourceId: created.id,
          correlationId,
          idempotencyKey: `clearance-change-request:${created.id}`,
          metadata: {
            user_id: userId,
            old_level: currentLevel,
            new_level: body.clearanceLevel,
            maker_user_id: actor.id,
            reason: body.reason,
          },
        });

        await this.approvalWorkItemService.createInTransaction(tx, {
          actionCode: AdminActionCode.CLEARANCE_ELEVATE_STRICTLY_CONFIDENTIAL,
          requestedBy: actor.id,
          targetType: ApprovalWorkItemTargetType.CLEARANCE_REQUEST,
          targetId: created.id,
          summary: this.approvalWorkItemService.buildClearanceChangeSummary({
            currentLevel: currentLevel,
            requestedLevel: body.clearanceLevel as ClearanceLevelCode,
            targetDisplayName: user.displayName,
          }),
          correlationId,
        });

        return created;
      });

      return {
        status: 'PENDING_APPROVAL',
        requestId: request.id,
        clearanceLevel: body.clearanceLevel,
      };
    }

    await this.applyClearanceChange(
      actor,
      userId,
      currentLevel,
      body.clearanceLevel,
      body.reason,
      correlationId,
    );

    return {
      status: 'UPDATED',
      clearanceLevel: body.clearanceLevel,
    };
  }

  async approveClearanceChange(
    checker: AuthenticatedUser,
    userId: string,
    requestId: string,
    body: ApproveAdminUserClearanceBody,
    correlationId: string,
  ) {
    const request = await this.prisma.clearanceChangeRequest.findFirst({
      where: { id: requestId, userId, status: 'PENDING' },
    });

    if (!request) {
      throw new DomainException(
        ErrorCode.ADMIN_CLEARANCE_REQUEST_NOT_FOUND,
        'Onay bekleyen clearance değişikliği bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    this.makerChecker.assertChecker(
      checker,
      request.requestedBy,
      AdminActionCode.CLEARANCE_ELEVATE_STRICTLY_CONFIDENTIAL,
    );

    if (!body.approved) {
      await this.prisma.$transaction(async (tx) => {
        await tx.clearanceChangeRequest.update({
          where: { id: request.id },
          data: {
            status: 'REJECTED',
            rejectedBy: checker.id,
            resolvedAt: new Date(),
          },
        });

        await this.auditPublisher.publish(tx, {
          eventType: AuditEventType.CLEARANCE_UPDATED,
          actorType: AuditActorType.USER,
          actorId: checker.id,
          action: 'clearance_change_rejected',
          outcome: AuditOutcome.DENIED,
          resourceType: 'clearance_change_request',
          resourceId: request.id,
          correlationId,
          idempotencyKey: `clearance-change-reject:${request.id}:${checker.id}`,
          metadata: {
            user_id: userId,
            old_level: request.currentLevel,
            new_level: request.requestedLevel,
            checker_user_id: checker.id,
            reason: body.reason,
          },
        });

        await this.approvalWorkItemService.closeInTransaction(tx, {
          targetType: ApprovalWorkItemTargetType.CLEARANCE_REQUEST,
          targetId: request.id,
          decidedBy: checker.id,
          approved: false,
          reason: body.reason,
        });
      });

      return {
        status: 'REJECTED' as const,
        clearanceLevel: request.currentLevel as ClearanceLevelCode,
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.clearanceChangeRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          approvedBy: checker.id,
          resolvedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { clearanceLevel: request.requestedLevel },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.CLEARANCE_UPDATED,
        actorType: AuditActorType.USER,
        actorId: checker.id,
        action: 'clearance_updated',
        outcome: AuditOutcome.ALLOWED,
        resourceType: 'user',
        resourceId: userId,
        correlationId,
        idempotencyKey: `clearance-updated:${request.id}:${checker.id}`,
        metadata: {
          user_id: userId,
          old_level: request.currentLevel,
          new_level: request.requestedLevel,
          checker_user_id: checker.id,
          reason: body.reason,
        },
      });

      await this.approvalWorkItemService.closeInTransaction(tx, {
        targetType: ApprovalWorkItemTargetType.CLEARANCE_REQUEST,
        targetId: request.id,
        decidedBy: checker.id,
        approved: true,
        reason: body.reason,
      });

      await this.invalidateUserSessions(tx, userId);
    });

    return {
      status: 'UPDATED' as const,
      clearanceLevel: request.requestedLevel as ClearanceLevelCode,
    };
  }

  private async applyClearanceChange(
    actor: AuthenticatedUser,
    userId: string,
    oldLevel: ClearanceLevelCode,
    newLevel: ClearanceLevelCode,
    reason: string,
    correlationId: string,
  ): Promise<void> {
    if (!actor.roles.includes(Role.ADMIN)) {
      throw new DomainException(
        ErrorCode.AUTHZ_FORBIDDEN,
        'Clearance güncellemesi için admin yetkisi gerekir.',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { clearanceLevel: newLevel },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.CLEARANCE_UPDATED,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'clearance_updated',
        outcome: AuditOutcome.ALLOWED,
        resourceType: 'user',
        resourceId: userId,
        correlationId,
        idempotencyKey: `clearance-updated:${userId}:${newLevel}:${correlationId}`,
        metadata: {
          user_id: userId,
          old_level: oldLevel,
          new_level: newLevel,
          reason,
        },
      });

      await this.invalidateUserSessions(tx, userId);
    });
  }

  private buildListWhere(query: ListAdminUsersQuery): Prisma.UserWhereInput {
    const and: Prisma.UserWhereInput[] = [];

    if (query.search) {
      and.push({
        OR: [
          { email: { contains: query.search, mode: 'insensitive' } },
          { displayName: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    if (query.companyId) {
      and.push({ companyId: query.companyId });
    }

    if (query.isActive !== undefined) {
      and.push({ isActive: query.isActive });
    }

    if (query.roleCode) {
      and.push({
        rolesAssigned: {
          some: {
            roleCode: query.roleCode,
            isActive: true,
          },
        },
      });
    }

    return and.length > 0 ? { AND: and } : {};
  }

  private async findUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new DomainException(
        ErrorCode.ADMIN_USER_NOT_FOUND,
        'Kullanıcı bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    return user;
  }

  private assertValidRoleCode(roleCode: string): asserts roleCode is RoleCode {
    if (!(ROLE_VALUES as readonly string[]).includes(roleCode)) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Geçersiz rol kodu.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private assertValidClearanceLevel(level: string): asserts level is ClearanceLevelCode {
    if (!(CLEARANCE_LEVEL_VALUES as readonly string[]).includes(level)) {
      throw new DomainException(
        ErrorCode.ADMIN_CLEARANCE_INVALID,
        'Geçersiz clearance seviyesi.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async invalidateUserSessions(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const sessions = await tx.userSession.findMany({
      select: { sid: true, sess: true },
    });

    const sessionIds = sessions
      .filter((session) => {
        const payload = session.sess as { passport?: { user?: { userId?: string } } };
        return payload.passport?.user?.userId === userId;
      })
      .map((session) => session.sid);

    if (sessionIds.length === 0) {
      return;
    }

    await tx.userSession.deleteMany({
      where: { sid: { in: sessionIds } },
    });
  }
}
