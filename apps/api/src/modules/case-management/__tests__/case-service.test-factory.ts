import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { createDefaultFieldVisibilityPolicyService } from '../../../authorization/field-visibility-policy.service.js';
import { FieldMaskingService } from '../../../authorization/field-masking.service.js';
import { PolicyScopeService } from '../../../authorization/policy-scope.service.js';
import { EnvService } from '../../../common/config/env.service.js';
import { CryptoService } from '../../../crypto/crypto.service.js';
import { LocalKeyManagementAdapter } from '../../../crypto/key-management.adapter.js';
import { NotificationEventPublisher } from '../../../notification/notification-event.publisher.js';
import { NotificationService } from '../../../notification/notification.service.js';
import type { PrismaService } from '../../../prisma/prisma.service.js';
import { DecisionService } from '../../decision/decision.service.js';
import { SilentAcceptanceHandler } from '../../decision/silent-acceptance.handler.js';
import { createDefaultActionMatrixConfigService } from '../../admin/maker-checker/action-matrix-config.service.js';
import { ApprovalWorkItemService } from '../../admin/maker-checker/approval-work-item.service.js';
import { MakerCheckerService } from '../../admin/maker-checker/maker-checker.service.js';
import { AdminUsersService } from '../../admin/users/admin-users.service.js';
import { BusinessCalendarService } from '../../task/sla/business-calendar.service.js';
import { SlaCalculatorService } from '../../task/sla/sla-calculator.service.js';
import { TaskService } from '../../task/task.service.js';
import { UnifiedWorkItemService } from '../../task/unified-work-item.service.js';
import { CaseAvailableActionsService } from '../case-available-actions.service.js';
import { CaseReportDecryptService } from '../case-report-decrypt.service.js';
import { CaseService } from '../case.service.js';
import { TransitionSideEffects } from '../transition/transition.side-effects.js';
import { TransitionService } from '../transition/transition.service.js';
import { TransitionValidators } from '../transition/transition.validators.js';

function buildTestCryptoService(): CryptoService {
  const envService = {
    cryptoKeyManagementProvider: 'local',
    cryptoLocalKekField: Buffer.alloc(32, 0x01).toString('base64'),
    cryptoLocalKekDocument: Buffer.alloc(32, 0x02).toString('base64'),
  } as EnvService;

  return new CryptoService(new LocalKeyManagementAdapter(envService));
}

function createWorkflowBundle(prismaService: PrismaService): {
  caseService: CaseService;
  taskService: TaskService;
  transitionService: TransitionService;
  decisionService: DecisionService;
  silentAcceptanceHandler: SilentAcceptanceHandler;
} {
  const auditPublisher = new AuditEventPublisher();
  const notificationPublisher = new NotificationEventPublisher();
  const notificationService = new NotificationService(notificationPublisher);
  const policyScopeService = new PolicyScopeService();
  const businessCalendarService = new BusinessCalendarService(prismaService);
  const slaCalculatorService = new SlaCalculatorService(businessCalendarService);
  const cryptoService = buildTestCryptoService();
  const transitionSideEffects = new TransitionSideEffects(notificationService, {
    get: () => undefined,
  } as unknown as import('@nestjs/core').ModuleRef);
  transitionSideEffects.wireDocumentAccessServiceForTests({
    applyTransitionGrants: () => Promise.resolve(undefined),
  } as never);
  const unifiedWorkItemService = new UnifiedWorkItemService(prismaService, policyScopeService);
  const taskService = new TaskService(
    prismaService,
    policyScopeService,
    auditPublisher,
    slaCalculatorService,
    notificationService,
    { get: () => undefined } as unknown as import('@nestjs/core').ModuleRef,
    unifiedWorkItemService,
  );
  const makerCheckerService = new MakerCheckerService(createDefaultActionMatrixConfigService());
  const approvalWorkItemService = new ApprovalWorkItemService(
    prismaService,
    createDefaultActionMatrixConfigService(),
  );
  const adminUsersService = new AdminUsersService(
    prismaService,
    auditPublisher,
    makerCheckerService,
    approvalWorkItemService,
  );
  unifiedWorkItemService.wireAdminUsersServiceForTests(adminUsersService);
  const transitionService = new TransitionService(
    prismaService,
    new TransitionValidators(),
    transitionSideEffects,
    auditPublisher,
    { get: () => undefined } as unknown as import('@nestjs/core').ModuleRef,
  );
  transitionSideEffects.wireTaskServiceForTests(taskService);
  const decisionService = new DecisionService(
    prismaService,
    policyScopeService,
    auditPublisher,
    cryptoService,
    notificationService,
    { get: () => undefined } as unknown as import('@nestjs/core').ModuleRef,
  );
  taskService.wireTransitionServiceForTests(transitionService);
  transitionService.wireDecisionServiceForTests(decisionService);
  decisionService.wireTransitionServiceForTests(transitionService);
  const silentAcceptanceHandler = new SilentAcceptanceHandler(prismaService, decisionService);

  const caseService = new CaseService(
    prismaService,
    policyScopeService,
    new FieldMaskingService(createDefaultFieldVisibilityPolicyService()),
    transitionService,
    auditPublisher,
    new CaseReportDecryptService(cryptoService),
    new CaseAvailableActionsService(),
  );

  return {
    caseService,
    taskService,
    transitionService,
    decisionService,
    silentAcceptanceHandler,
  };
}

export function createWorkflowBundleForTests(prismaService: PrismaService): {
  caseService: CaseService;
  taskService: TaskService;
  transitionService: TransitionService;
  decisionService: DecisionService;
  silentAcceptanceHandler: SilentAcceptanceHandler;
} {
  return createWorkflowBundle(prismaService);
}

export function createCaseServiceForTests(prismaService: PrismaService): CaseService {
  return createWorkflowBundle(prismaService).caseService;
}

export function createTaskServiceForTests(prismaService: PrismaService): TaskService {
  return createWorkflowBundle(prismaService).taskService;
}

export function createDecisionServiceForTests(prismaService: PrismaService): DecisionService {
  return createWorkflowBundle(prismaService).decisionService;
}

export function createSilentAcceptanceHandlerForTests(
  prismaService: PrismaService,
  clock?: { now(): Date },
): SilentAcceptanceHandler {
  const bundle = createWorkflowBundle(prismaService);
  return new SilentAcceptanceHandler(prismaService, bundle.decisionService, clock);
}
