import {
  AuditActorType,
  CaseState,
  ClearanceLevel,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
  Role,
  WORKFLOW_VERSION,
  WorkflowCommand,
} from '@ethics/shared';
import type { Prisma } from '@prisma/client';
import { seedSyntheticCompany, seedWorkflowCaseStub } from '@ethics/test-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';

describe('Case DB integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let companyId: string;
  let secretaryUserId: string;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    companyId = await seedSyntheticCompany(environment.prisma);

    const secretary = await environment.prisma.user.create({
      data: {
        email: 'case-test-secretary@ethics.local',
        displayName: 'Case Test Secretary',
        oidcSubjectId: 'case-test-secretary-oidc',
        clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        provisionedAt: new Date(),
      },
    });
    secretaryUserId = secretary.id;

    await environment.prisma.userRole.create({
      data: {
        userId: secretary.id,
        roleCode: Role.COUNCIL_SECRETARY,
        assignedBy: secretary.id,
        reason: 'Case DB integration test',
      },
    });
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  async function createSyntheticReport(): Promise<string> {
    const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const trackingCode = `ETK-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    const report = await environment.prisma.report.create({
      data: {
        trackingCode,
        trackingCodePasswordHash:
          '$argon2id$v=19$m=65536,t=3,p=1$dGVzdA$placeholder-hash-for-integration-test',
        isAnonymous: true,
        incidentCountry: 'TUR',
        incidentCity: 'Ankara',
        companyId,
        categoryGroup: ReportCategoryGroup.EMPLOYEE_HUMAN,
        categories: [ReportSubCategory.WORKPLACE_VIOLENCE],
        incidentDescription: 'Sentetik case integration test bildirimi.',
        encryptionMetadata: { version: 'test-v1', algorithm: 'none' },
        status: ReportStatus.SUBMITTED,
        confidentialityLevel: ClearanceLevel.SENSITIVE,
        channel: ReportChannel.WEB_FORM,
        kvkkConsentVersion: '1.0',
        kvkkConsentAt: new Date(),
        submittedAt: new Date(),
      },
    });

    return report.id;
  }

  it('case create → report FK, optimistic_lock_version=0, report.case_id güncellenir', async () => {
    const reportId = await createSyntheticReport();
    const openedAt = new Date('2026-06-13T12:00:00.000Z');

    const caseRecord = await environment.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const created = await tx.case.create({
          data: {
            reportId,
            currentState: CaseState.REPORT_SUBMITTED,
            workflowVersion: WORKFLOW_VERSION,
            confidentialityLevel: ClearanceLevel.SENSITIVE,
            companyId,
            openedAt,
            createdBy: secretaryUserId,
          },
        });

        await tx.report.update({
          where: { id: reportId },
          data: { caseId: created.id },
        });

        return created;
      },
    );

    const stored = await environment.prisma.case.findUnique({
      where: { id: caseRecord.id },
      include: { report: true },
    });

    expect(stored).toMatchObject({
      reportId,
      currentState: CaseState.REPORT_SUBMITTED,
      workflowVersion: WORKFLOW_VERSION,
      confidentialityLevel: ClearanceLevel.SENSITIVE,
      companyId,
      optimisticLockVersion: 0,
      createdBy: secretaryUserId,
    });
    expect(stored?.report.caseId).toBe(caseRecord.id);
  });

  it('case_transitions INSERT → append-only kayıt oluşur', async () => {
    const reportId = await createSyntheticReport();

    const { caseId, transitionId } = await environment.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const createdCase = await tx.case.create({
          data: {
            reportId,
            currentState: CaseState.REPORT_SUBMITTED,
            workflowVersion: WORKFLOW_VERSION,
            companyId,
            createdBy: secretaryUserId,
          },
        });

        const transition = await tx.caseTransition.create({
          data: {
            caseId: createdCase.id,
            fromState: CaseState.REPORT_SUBMITTED,
            toState: CaseState.SECRETARIAT_REVIEW,
            command: WorkflowCommand.OPEN_CASE,
            actorType: AuditActorType.USER,
            performedByUserId: secretaryUserId,
            idempotencyKey: `idem-${createdCase.id}-open`,
          },
        });

        return { caseId: createdCase.id, transitionId: transition.id };
      },
    );

    const stored = await environment.prisma.caseTransition.findUnique({
      where: { id: transitionId },
    });

    expect(stored).toMatchObject({
      caseId,
      fromState: CaseState.REPORT_SUBMITTED,
      toState: CaseState.SECRETARIAT_REVIEW,
      command: WorkflowCommand.OPEN_CASE,
      actorType: AuditActorType.USER,
      performedByUserId: secretaryUserId,
    });
  });

  describe('case_transitions DB triggers (append-only)', () => {
    const createTransition = async (suffix: string) => {
      const reportId = await createSyntheticReport();

      return environment.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const createdCase = await tx.case.create({
          data: {
            reportId,
            currentState: CaseState.REPORT_SUBMITTED,
            workflowVersion: WORKFLOW_VERSION,
            companyId,
            createdBy: secretaryUserId,
          },
        });

        return tx.caseTransition.create({
          data: {
            id: `ct-${suffix}`,
            caseId: createdCase.id,
            fromState: CaseState.REPORT_SUBMITTED,
            toState: CaseState.REPORT_SUBMITTED,
            command: WorkflowCommand.OPEN_CASE,
            actorType: AuditActorType.SYSTEM,
            idempotencyKey: `idem-${suffix}`,
          },
        });
      });
    };

    it('append-only: UPDATE case_transitions DB hatası verir', async () => {
      const transition = await createTransition('immutable-update');

      await expect(
        environment.prisma.$executeRaw`
          UPDATE case_transitions
          SET command = 'tampered'
          WHERE id = ${transition.id}
        `,
      ).rejects.toThrow(/CASE_TRANSITION_APPEND_ONLY_VIOLATION/);
    });

    it('append-only: DELETE case_transitions DB hatası verir', async () => {
      const transition = await createTransition('immutable-delete');

      await expect(
        environment.prisma.$executeRaw`
          DELETE FROM case_transitions
          WHERE id = ${transition.id}
        `,
      ).rejects.toThrow(/CASE_TRANSITION_APPEND_ONLY_VIOLATION/);
    });

    it('append-only: TRUNCATE case_transitions DB hatası verir', async () => {
      await createTransition('immutable-truncate');

      // tasks.created_by_transition_id FK nedeniyle CASCADE gerekir (Faz 6).
      await expect(
        environment.prisma.$executeRaw`TRUNCATE TABLE case_transitions CASCADE`,
      ).rejects.toThrow(/CASE_TRANSITION_APPEND_ONLY_VIOLATION/);
    });
  });

  it('seedWorkflowCaseStub → sentetik report + case idempotent', async () => {
    const first = await seedWorkflowCaseStub(environment.prisma, {
      companyId,
      createdByUserId: secretaryUserId,
    });

    const second = await seedWorkflowCaseStub(environment.prisma, {
      companyId,
      createdByUserId: secretaryUserId,
    });

    expect(second.caseId).toBe(first.caseId);
    expect(second.reportId).toBe(first.reportId);

    const caseCount = await environment.prisma.case.count({
      where: { reportId: first.reportId },
    });
    expect(caseCount).toBe(1);
  });
});
