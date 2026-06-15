import {
  AdminActionCode,
  ApprovalCategory,
  ApprovalWorkItemStatus,
  ApprovalWorkItemTargetType,
  ClearanceLevel,
  ErrorCode,
  Role,
} from '@ethics/shared';
import { describe, expect, it, vi } from 'vitest';

import { createDefaultActionMatrixConfigService } from '../action-matrix-config.service.js';
import { ApprovalWorkItemService } from '../approval-work-item.service.js';

function createService() {
  const actionMatrixConfig = createDefaultActionMatrixConfigService();
  const pendingItems = new Map<
    string,
    { id: string; status: string; targetType: string; targetId: string }
  >();
  let nextId = 1;

  const createTransactionClient = () => ({
    approvalWorkItem: {
      findFirst: vi.fn(({ where }: { where: Record<string, string> }) => {
        const key = `${where.targetType ?? ''}:${where.targetId ?? ''}`;
        const existing = pendingItems.get(key);
        if (existing && existing.status === where.status) {
          return existing;
        }
        return null;
      }),
      create: vi.fn(
        ({
          data,
        }: {
          data: {
            targetType: string;
            targetId: string;
            status: string;
            category: string;
            actionCode: string;
            assignedCheckerRole: string;
            requestedBy: string;
            summary: string;
            correlationId: string;
          };
        }) => {
          const key = `${data.targetType}:${data.targetId}`;
          const record = {
            id: `awi-${String(nextId++)}`,
            ...data,
            decidedBy: null,
            decidedAt: null,
            decisionReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          pendingItems.set(key, record);
          return record;
        },
      ),
    },
  });

  const prisma = {
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(createTransactionClient()),
    ),
  };

  return {
    service: new ApprovalWorkItemService(prisma as never, actionMatrixConfig),
    prisma,
  };
}

describe('ApprovalWorkItemService', () => {
  it('rol ataması proposal → PENDING work item oluşturur', async () => {
    const { service } = createService();

    const item = await service.create({
      actionCode: AdminActionCode.ROLE_ASSIGN,
      requestedBy: 'maker-1',
      targetType: ApprovalWorkItemTargetType.USER_ROLE,
      targetId: 'role-1',
      summary: service.buildRoleAssignmentSummary({
        roleCode: Role.COUNCIL_MEMBER,
        targetDisplayName: 'Test Kullanıcı',
      }),
      correlationId: 'corr-1',
    });

    expect(item.status).toBe(ApprovalWorkItemStatus.PENDING);
    expect(item.category).toBe(ApprovalCategory.ROLE_ASSIGNMENT);
    expect(item.actionCode).toBe(AdminActionCode.ROLE_ASSIGN);
    expect(item.assignedCheckerRole).toBe(Role.COUNCIL_SECRETARY);
    expect(item.summary).toBe('Rol ataması: council_member — Test Kullanıcı');
  });

  it('clearance proposal → maskeli summary + checker rol snapshot', async () => {
    const { service } = createService();

    const item = await service.create({
      actionCode: AdminActionCode.CLEARANCE_ELEVATE_STRICTLY_CONFIDENTIAL,
      requestedBy: 'maker-2',
      targetType: ApprovalWorkItemTargetType.CLEARANCE_REQUEST,
      targetId: 'ccr-1',
      summary: service.buildClearanceChangeSummary({
        currentLevel: ClearanceLevel.SENSITIVE,
        requestedLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        targetDisplayName: 'Hedef Kullanıcı',
      }),
      correlationId: 'corr-2',
    });

    expect(item.category).toBe(ApprovalCategory.CLEARANCE_CHANGE);
    expect(item.assignedCheckerRole).toBe(Role.COUNCIL_SECRETARY);
    expect(item.summary).toBe(
      'Clearance değişikliği: SENSITIVE → STRICTLY_CONFIDENTIAL — Hedef Kullanıcı',
    );
  });

  it('aynı target için ikinci PENDING proposal → APPROVAL_WORK_ITEM_PENDING', async () => {
    const { service } = createService();

    await service.create({
      actionCode: AdminActionCode.ROLE_ASSIGN,
      requestedBy: 'maker-1',
      targetType: ApprovalWorkItemTargetType.USER_ROLE,
      targetId: 'role-dup',
      summary: 'Rol ataması: council_member — Test',
      correlationId: 'corr-dup-1',
    });

    await expect(
      service.create({
        actionCode: AdminActionCode.ROLE_ASSIGN,
        requestedBy: 'maker-1',
        targetType: ApprovalWorkItemTargetType.USER_ROLE,
        targetId: 'role-dup',
        summary: 'Rol ataması: council_member — Test',
        correlationId: 'corr-dup-2',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.APPROVAL_WORK_ITEM_PENDING });
  });
});
