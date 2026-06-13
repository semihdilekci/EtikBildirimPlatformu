import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { FieldMaskingService } from '../../../authorization/field-masking.service.js';
import { PolicyScopeService } from '../../../authorization/policy-scope.service.js';
import { EnvService } from '../../../common/config/env.service.js';
import { CryptoService } from '../../../crypto/crypto.service.js';
import { LocalKeyManagementAdapter } from '../../../crypto/key-management.adapter.js';
import { NotificationEventPublisher } from '../../../notification/notification-event.publisher.js';
import type { PrismaService } from '../../../prisma/prisma.service.js';
import { DecisionService } from '../../decision/decision.service.js';
import { SilentAcceptanceHandler } from '../../decision/silent-acceptance.handler.js';
import { BusinessCalendarService } from '../../task/sla/business-calendar.service.js';
import { SlaCalculatorService } from '../../task/sla/sla-calculator.service.js';
import { TaskService } from '../../task/task.service.js';
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
  const policyScopeService = new PolicyScopeService();
  const businessCalendarService = new BusinessCalendarService(prismaService);
  const slaCalculatorService = new SlaCalculatorService(businessCalendarService);
  const cryptoService = buildTestCryptoService();
  const transitionSideEffects = new TransitionSideEffects(notificationPublisher, {
    get: () => undefined,
  } as unknown as import('@nestjs/core').ModuleRef);
  const taskService = new TaskService(
    prismaService,
    policyScopeService,
    auditPublisher,
    slaCalculatorService,
    { get: () => undefined } as unknown as import('@nestjs/core').ModuleRef,
  );
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
    { get: () => undefined } as unknown as import('@nestjs/core').ModuleRef,
  );
  taskService.wireTransitionServiceForTests(transitionService);
  transitionService.wireDecisionServiceForTests(decisionService);
  decisionService.wireTransitionServiceForTests(transitionService);
  const silentAcceptanceHandler = new SilentAcceptanceHandler(prismaService, decisionService);

  const caseService = new CaseService(
    prismaService,
    policyScopeService,
    new FieldMaskingService(),
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
