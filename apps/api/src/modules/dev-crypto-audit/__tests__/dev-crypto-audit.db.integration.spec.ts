import { AuditActorType, AuditEventType, AuditOutcome, ClearanceLevel } from '@ethics/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { AuditEventPublisher } from '../../../audit/audit-event.publisher.js';
import { EnvService } from '../../../common/config/env.service.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { CryptoService } from '../../../crypto/crypto.service.js';
import { LocalKeyManagementAdapter } from '../../../crypto/key-management.adapter.js';
import { DevCryptoAuditService } from '../dev-crypto-audit.service.js';

const TEST_FIELD_KEK = Buffer.alloc(32, 0x01).toString('base64');
const TEST_DOCUMENT_KEK = Buffer.alloc(32, 0x02).toString('base64');

function buildEnvService(): EnvService {
  return {
    isProduction: false,
    cryptoKeyManagementProvider: 'local',
    cryptoLocalKekField: TEST_FIELD_KEK,
    cryptoLocalKekDocument: TEST_DOCUMENT_KEK,
  } as EnvService;
}

const testUser: AuthenticatedUser = {
  id: 'integration-dev-user',
  email: 'dev@ethics.local',
  displayName: 'Dev User',
  roles: [],
  clearanceLevel: ClearanceLevel.NORMAL,
  companyId: null,
  companyName: null,
  functionId: null,
  locationId: null,
  isGeneralSecretary: false,
};

describe('DevCryptoAuditService integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let service: DevCryptoAuditService;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    const keyManagement = new LocalKeyManagementAdapter(buildEnvService());
    const cryptoService = new CryptoService(keyManagement);
    const auditPublisher = new AuditEventPublisher();

    service = new DevCryptoAuditService(
      buildEnvService(),
      environment.prisma as never,
      cryptoService,
      auditPublisher,
    );
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  it('denied olmayan encrypt demo → audit_outbox PENDING + plaintext audit metadata yok', async () => {
    const correlationId = crypto.randomUUID();

    const result = await service.encryptDemo(
      testUser,
      { plaintext: 'Entegrasyon gizli metin', caseId: 'case-int-1' },
      correlationId,
    );

    expect(result.auditHandled).toBe(true);
    expect(result.ciphertextLength).toBeGreaterThan(0);

    const outbox = await environment.prisma.auditOutbox.findFirst({
      where: { correlationId },
    });

    expect(outbox).toMatchObject({
      eventType: AuditEventType.SYSTEM_SETTING_CHANGED,
      actorType: AuditActorType.USER,
      actorId: testUser.id,
      outcome: AuditOutcome.SUCCESS,
      dispatchStatus: 'PENDING',
      action: 'dev_encrypt_demo',
    });
    expect(outbox?.metadataJson).toEqual({
      fieldName: 'report_text',
      encrypted: true,
      algorithm: 'AES-256-GCM',
    });
    expect(JSON.stringify(outbox?.metadataJson)).not.toContain('Entegrasyon gizli metin');
  });

  it("outcome=DENIED audit kaydı outbox'a yazılabilir", async () => {
    const correlationId = crypto.randomUUID();
    const publisher = new AuditEventPublisher();

    await environment.prisma.$transaction(async (tx) => {
      await publisher.publish(tx, {
        eventType: AuditEventType.AUTHZ_DENIED,
        actorType: AuditActorType.USER,
        actorId: testUser.id,
        action: 'policy_denied',
        outcome: AuditOutcome.DENIED,
        correlationId,
        metadata: { permission: 'admin:manage_settings' },
        idempotencyKey: `denied-${correlationId}`,
      });
    });

    const outbox = await environment.prisma.auditOutbox.findFirst({
      where: { correlationId },
    });

    expect(outbox?.outcome).toBe(AuditOutcome.DENIED);
    expect(outbox?.eventType).toBe(AuditEventType.AUTHZ_DENIED);
  });
});
