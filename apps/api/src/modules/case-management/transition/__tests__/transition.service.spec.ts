import { HttpStatus } from '@nestjs/common';
import {
  AuditActorType,
  AuditEventType,
  CaseState,
  ClearanceLevel,
  ErrorCode,
  Role,
  WorkflowCommand,
} from '@ethics/shared';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { AuditEventPublisher } from '../../../../audit/audit-event.publisher.js';
import { DomainException } from '../../../../common/exceptions/domain.exception.js';
import { NotificationEventPublisher } from '../../../../notification/notification-event.publisher.js';
import { TransitionSideEffects } from '../transition.side-effects.js';
import { TransitionService } from '../transition.service.js';
import { TransitionValidators } from '../transition.validators.js';

const CASE_ID = 'case-unit-001';
const USER_ID = 'user-secretary-001';
const CORRELATION_ID = 'corr-unit-001';

const baseCase = {
  id: CASE_ID,
  reportId: 'report-001',
  currentState: CaseState.REPORT_SUBMITTED,
  workflowVersion: '1.0',
  confidentialityLevel: ClearanceLevel.SENSITIVE,
  companyId: 'company-001',
  assignedRapporteurId: null,
  assignedActionOwnerId: null,
  openedAt: new Date('2026-06-13T10:00:00.000Z'),
  closedAt: null,
  optimisticLockVersion: 0,
  createdAt: new Date('2026-06-13T10:00:00.000Z'),
  updatedAt: new Date('2026-06-13T10:00:00.000Z'),
  createdBy: USER_ID,
};

const secretaryActor = {
  type: AuditActorType.USER,
  userId: USER_ID,
  roles: [Role.COUNCIL_SECRETARY],
  clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
};

function createTransitionService(prisma: Record<string, unknown>) {
  return new TransitionService(
    prisma as never,
    new TransitionValidators(),
    new TransitionSideEffects(new NotificationEventPublisher()),
    {
      publish: vi.fn(() =>
        Promise.resolve({
          id: 'audit-outbox-1',
          eventType: AuditEventType.CASE_TRANSITION,
          dispatchStatus: 'PENDING',
        }),
      ),
    } as unknown as AuditEventPublisher,
  );
}

function buildTransactionHandler(
  prisma: Record<string, unknown>,
  txCase: Record<string, unknown> = prisma.case as Record<string, unknown>,
  notificationEventCreate = vi.fn(() =>
    Promise.resolve({
      id: 'notification-1',
      eventType: 'CASE_TRANSITION',
      dispatchStatus: 'PENDING',
    }),
  ),
) {
  return vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      $executeRaw: vi.fn(() => Promise.resolve(undefined)),
      case: txCase,
      caseTransition: prisma.caseTransition,
      auditOutbox: { create: vi.fn() },
      notificationEvent: { create: notificationEventCreate, findUnique: vi.fn() },
    }),
  );
}

describe('TransitionService', () => {
  it('geçerli geçiş → state güncellenir, CaseTransition ve audit outbox yazılır', async () => {
    const transitionedAt = new Date('2026-06-13T11:00:00.000Z');
    const caseTransitionCreate = vi.fn(() =>
      Promise.resolve({
        id: 'transition-1',
        caseId: CASE_ID,
        fromState: CaseState.REPORT_SUBMITTED,
        toState: CaseState.SECRETARIAT_REVIEW,
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        transitionedAt,
      }),
    );
    const notificationEventCreate = vi.fn(() =>
      Promise.resolve({
        id: 'notification-1',
        eventType: 'CASE_TRANSITION',
        dispatchStatus: 'PENDING',
      }),
    );

    const caseMock = {
      findUnique: vi.fn(() => Promise.resolve({ ...baseCase })),
      update: vi.fn(() =>
        Promise.resolve({
          ...baseCase,
          currentState: CaseState.SECRETARIAT_REVIEW,
          optimisticLockVersion: 1,
        }),
      ),
    };
    const prisma: Record<string, unknown> = {
      caseTransition: {
        findUnique: vi.fn(() => Promise.resolve(null)),
        create: caseTransitionCreate,
      },
      case: caseMock,
    };
    prisma.$transaction = buildTransactionHandler(prisma, caseMock, notificationEventCreate);

    const service = createTransitionService(prisma);
    const auditPublisher = (service as unknown as { auditPublisher: AuditEventPublisher })
      .auditPublisher;

    const result = await service.execute({
      caseId: CASE_ID,
      command: WorkflowCommand.ACKNOWLEDGE_REPORT,
      actor: secretaryActor,
      idempotencyKey: 'idem-ack-001',
      correlationId: CORRELATION_ID,
    });

    expect(result).toMatchObject({
      caseId: CASE_ID,
      transitionId: 'transition-1',
      fromState: CaseState.REPORT_SUBMITTED,
      toState: CaseState.SECRETARIAT_REVIEW,
      command: WorkflowCommand.ACKNOWLEDGE_REPORT,
      optimisticLockVersion: 1,
      idempotentReplay: false,
      tasksCreated: [],
    });

    expect(caseMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CASE_ID, optimisticLockVersion: 0 },
        data: expect.objectContaining({
          currentState: CaseState.SECRETARIAT_REVIEW,
        }),
      }),
    );

    expect(caseTransitionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          command: WorkflowCommand.ACKNOWLEDGE_REPORT,
          idempotencyKey: 'idem-ack-001',
        }),
      }),
    );

    expect(auditPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: AuditEventType.CASE_TRANSITION,
        caseId: CASE_ID,
        idempotencyKey: 'audit:idem-ack-001',
      }),
    );
  });

  it('map dışı geçiş → CASE_INVALID_TRANSITION (409)', async () => {
    const prisma = {
      caseTransition: {
        findUnique: vi.fn(() => Promise.resolve(null)),
      },
      case: {
        findUnique: vi.fn(() => Promise.resolve({ ...baseCase })),
      },
      $transaction: buildTransactionHandler({
        caseTransition: { findUnique: vi.fn() },
        case: {
          findUnique: vi.fn(() => Promise.resolve({ ...baseCase })),
        },
      }),
    };

    const service = createTransitionService(prisma);

    await expect(
      service.execute({
        caseId: CASE_ID,
        command: WorkflowCommand.BOARD_APPROVE,
        actor: secretaryActor,
        idempotencyKey: 'idem-invalid-001',
        correlationId: CORRELATION_ID,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.CASE_INVALID_TRANSITION,
    });

    try {
      await service.execute({
        caseId: CASE_ID,
        command: WorkflowCommand.BOARD_APPROVE,
        actor: secretaryActor,
        idempotencyKey: 'idem-invalid-002',
        correlationId: CORRELATION_ID,
      });
      expect.unreachable('Expected DomainException');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainException);
      expect((error as DomainException).getStatus()).toBe(HttpStatus.CONFLICT);
    }
  });

  it('aynı idempotencyKey ile tekrar istek → çift geçiş yok, idempotentReplay=true', async () => {
    const existingTransition = {
      id: 'transition-existing',
      caseId: CASE_ID,
      fromState: CaseState.REPORT_SUBMITTED,
      toState: CaseState.SECRETARIAT_REVIEW,
      command: WorkflowCommand.ACKNOWLEDGE_REPORT,
      transitionedAt: new Date('2026-06-13T11:00:00.000Z'),
    };

    const prisma = {
      caseTransition: {
        findUnique: vi.fn(() => Promise.resolve(existingTransition)),
      },
      case: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            ...baseCase,
            currentState: CaseState.SECRETARIAT_REVIEW,
            optimisticLockVersion: 1,
          }),
        ),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    const service = createTransitionService(prisma);

    const result = await service.execute({
      caseId: CASE_ID,
      command: WorkflowCommand.ACKNOWLEDGE_REPORT,
      actor: secretaryActor,
      idempotencyKey: 'idem-ack-001',
      correlationId: CORRELATION_ID,
    });

    expect(result.idempotentReplay).toBe(true);
    expect(result.transitionId).toBe('transition-existing');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.case.update).not.toHaveBeenCalled();
  });

  it('optimistic lock çakışması → CASE_OPTIMISTIC_LOCK (409)', async () => {
    const prisma = {
      caseTransition: {
        findUnique: vi.fn(() => Promise.resolve(null)),
        create: vi.fn(),
      },
      case: {
        findUnique: vi.fn(() => Promise.resolve({ ...baseCase })),
        update: vi.fn(),
      },
      $transaction: vi.fn(() => {
        throw new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: '6.8.2',
        });
      }),
    };

    const service = createTransitionService(prisma);

    await expect(
      service.execute({
        caseId: CASE_ID,
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        actor: secretaryActor,
        idempotencyKey: 'idem-lock-001',
        correlationId: CORRELATION_ID,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.CASE_OPTIMISTIC_LOCK,
    });
  });

  it('vaka bulunamazsa → RESOURCE_NOT_FOUND (404)', async () => {
    const prisma = {
      caseTransition: {
        findUnique: vi.fn(() => Promise.resolve(null)),
      },
      case: {
        findUnique: vi.fn(() => Promise.resolve(null)),
      },
    };

    const service = createTransitionService(prisma);

    await expect(
      service.execute({
        caseId: 'missing-case',
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        actor: secretaryActor,
        idempotencyKey: 'idem-missing-001',
        correlationId: CORRELATION_ID,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
  });

  it('clearance yetersiz → AUTHZ_FORBIDDEN (403)', async () => {
    const prisma = {
      caseTransition: {
        findUnique: vi.fn(() => Promise.resolve(null)),
      },
      case: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            ...baseCase,
            confidentialityLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
          }),
        ),
      },
      $transaction: buildTransactionHandler({
        caseTransition: { findUnique: vi.fn() },
        case: {
          findUnique: vi.fn(() =>
            Promise.resolve({
              ...baseCase,
              confidentialityLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
            }),
          ),
        },
      }),
    };

    const service = createTransitionService(prisma);

    await expect(
      service.execute({
        caseId: CASE_ID,
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        actor: {
          ...secretaryActor,
          clearanceLevel: ClearanceLevel.NORMAL,
        },
        idempotencyKey: 'idem-clearance-001',
        correlationId: CORRELATION_ID,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTHZ_FORBIDDEN,
    });
  });

  it('transaction icinde state/versiyon degismis → CASE_OPTIMISTIC_LOCK (409)', async () => {
    const prisma: Record<string, unknown> = {
      caseTransition: {
        findUnique: vi.fn(() => Promise.resolve(null)),
        create: vi.fn(),
      },
      case: {
        findUnique: vi.fn(() => Promise.resolve({ ...baseCase })),
        update: vi.fn(),
      },
    };
    prisma.$transaction = buildTransactionHandler(prisma, {
      findUnique: vi.fn(() =>
        Promise.resolve({
          ...baseCase,
          currentState: CaseState.SECRETARIAT_REVIEW,
          optimisticLockVersion: 1,
        }),
      ),
      update: vi.fn(),
    });

    const service = createTransitionService(prisma);

    await expect(
      service.execute({
        caseId: CASE_ID,
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        actor: secretaryActor,
        idempotencyKey: 'idem-stale-001',
        correlationId: CORRELATION_ID,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.CASE_OPTIMISTIC_LOCK,
    });
  });
});
