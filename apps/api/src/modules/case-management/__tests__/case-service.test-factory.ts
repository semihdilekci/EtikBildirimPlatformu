import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { FieldMaskingService } from '../../../authorization/field-masking.service.js';
import { PolicyScopeService } from '../../../authorization/policy-scope.service.js';
import { EnvService } from '../../../common/config/env.service.js';
import { CryptoService } from '../../../crypto/crypto.service.js';
import { LocalKeyManagementAdapter } from '../../../crypto/key-management.adapter.js';
import { NotificationEventPublisher } from '../../../notification/notification-event.publisher.js';
import type { PrismaService } from '../../../prisma/prisma.service.js';
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

export function createCaseServiceForTests(prismaService: PrismaService): CaseService {
  const auditPublisher = new AuditEventPublisher();
  const notificationPublisher = new NotificationEventPublisher();
  const transitionService = new TransitionService(
    prismaService,
    new TransitionValidators(),
    new TransitionSideEffects(notificationPublisher),
    auditPublisher,
  );

  return new CaseService(
    prismaService,
    new PolicyScopeService(),
    new FieldMaskingService(),
    transitionService,
    auditPublisher,
    new CaseReportDecryptService(buildTestCryptoService()),
    new CaseAvailableActionsService(),
  );
}
