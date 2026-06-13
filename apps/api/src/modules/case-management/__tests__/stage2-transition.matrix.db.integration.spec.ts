import { randomUUID } from 'node:crypto';

import {
  CaseState,
  ClearanceLevel,
  ErrorCode,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
  Role,
  WORKFLOW_VERSION,
  WorkflowCommand,
} from '@ethics/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { seedSyntheticCompany } from '@ethics/test-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { CaseService } from '../case.service.js';
import { createCaseServiceForTests } from './case-service.test-factory.js';

describe('Stage 2 transition matrix (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let caseService: CaseService;
  let companyId: string;
  let secretaryUser: AuthenticatedUser;
  let chairUser: AuthenticatedUser;
  let memberUser: AuthenticatedUser;
  let rapporteurUser: AuthenticatedUser;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    companyId = await seedSyntheticCompany(environment.prisma);

    const prismaService = environment.prisma as unknown as PrismaService;
    caseService = createCaseServiceForTests(prismaService);

    secretaryUser = await createRoleUser(environment.prisma, {
      email: 'stage2-secretary@ethics.local',
      oidcSubjectId: 'stage2-secretary-oidc',
      role: Role.COUNCIL_SECRETARY,
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });

    chairUser = await createRoleUser(environment.prisma, {
      email: 'stage2-chair@ethics.local',
      oidcSubjectId: 'stage2-chair-oidc',
      role: Role.COUNCIL_CHAIR,
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });

    memberUser = await createRoleUser(environment.prisma, {
      email: 'stage2-member@ethics.local',
      oidcSubjectId: 'stage2-member-oidc',
      role: Role.COUNCIL_MEMBER,
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });

    rapporteurUser = await createRoleUser(environment.prisma, {
      email: 'stage2-rapporteur@ethics.local',
      oidcSubjectId: 'stage2-rapporteur-oidc',
      role: Role.RAPPORTEUR,
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  async function createRoleUser(
    prisma: PrismaClient,
    input: {
      email: string;
      oidcSubjectId: string;
      role: Role;
      clearanceLevel: ClearanceLevel;
    },
  ): Promise<AuthenticatedUser> {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        displayName: input.email,
        oidcSubjectId: input.oidcSubjectId,
        clearanceLevel: input.clearanceLevel,
        provisionedAt: new Date(),
      },
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleCode: input.role,
        assignedBy: user.id,
        reason: 'Stage 2 matrix test',
      },
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: [input.role],
      clearanceLevel: input.clearanceLevel,
      companyId: null,
      companyName: null,
      functionId: null,
      locationId: null,
      isGeneralSecretary: false,
    };
  }

  async function createCaseAtState(currentState: string, createdBy: string): Promise<string> {
    const raw = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const trackingCode = `ETK-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;

    return environment.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const report = await tx.report.create({
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
          incidentDescription: 'Stage 2 matrix test bildirimi.',
          encryptionMetadata: { version: 'test-v1', algorithm: 'none' },
          status: ReportStatus.SUBMITTED,
          confidentialityLevel: ClearanceLevel.SENSITIVE,
          channel: ReportChannel.WEB_FORM,
          kvkkConsentVersion: '1.0',
          kvkkConsentAt: new Date(),
          submittedAt: new Date(),
        },
      });

      const createdCase = await tx.case.create({
        data: {
          reportId: report.id,
          currentState,
          workflowVersion: WORKFLOW_VERSION,
          confidentialityLevel: ClearanceLevel.SENSITIVE,
          companyId,
          createdBy,
        },
      });

      await tx.report.update({
        where: { id: report.id },
        data: { caseId: createdCase.id },
      });

      return createdCase.id;
    });
  }

  it('agenda_ready → assign_rapporteur → rapporteur_assigned', async () => {
    const caseId = await createCaseAtState(CaseState.AGENDA_READY, secretaryUser.id);

    const result = await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.ASSIGN_RAPPORTEUR,
        idempotencyKey: randomUUID(),
        metadata: { rapporteurUserId: rapporteurUser.id },
      },
      randomUUID(),
    );

    expect(result).toMatchObject({
      fromState: CaseState.AGENDA_READY,
      toState: CaseState.RAPPORTEUR_ASSIGNED,
      command: WorkflowCommand.ASSIGN_RAPPORTEUR,
    });

    const stored = await environment.prisma.case.findUnique({ where: { id: caseId } });
    expect(stored?.assignedRapporteurId).toBe(rapporteurUser.id);
  });

  it('rapporteur_assigned → submit_rapporteur_report → rapporteur_report_submitted', async () => {
    const caseId = await createCaseAtState(CaseState.RAPPORTEUR_ASSIGNED, secretaryUser.id);
    await environment.prisma.case.update({
      where: { id: caseId },
      data: { assignedRapporteurId: rapporteurUser.id },
    });

    const result = await caseService.executeTransition(
      rapporteurUser,
      caseId,
      {
        command: WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT,
        idempotencyKey: randomUUID(),
        metadata: { rapporteurReportDocumentId: randomUUID() },
      },
      randomUUID(),
    );

    expect(result.toState).toBe(CaseState.RAPPORTEUR_REPORT_SUBMITTED);
  });

  it('rapporteur_report_submitted → return_to_agenda → agenda_ready', async () => {
    const caseId = await createCaseAtState(CaseState.RAPPORTEUR_REPORT_SUBMITTED, secretaryUser.id);

    const result = await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.RETURN_TO_AGENDA,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    expect(result.toState).toBe(CaseState.AGENDA_READY);
  });

  it('raportor dongusu E2E: agenda_ready → ... → agenda_ready', async () => {
    const caseId = await createCaseAtState(CaseState.AGENDA_READY, secretaryUser.id);

    await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.ASSIGN_RAPPORTEUR,
        idempotencyKey: randomUUID(),
        metadata: { rapporteurUserId: rapporteurUser.id },
      },
      randomUUID(),
    );

    await caseService.executeTransition(
      rapporteurUser,
      caseId,
      {
        command: WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT,
        idempotencyKey: randomUUID(),
        metadata: { rapporteurReportDocumentId: randomUUID() },
      },
      randomUUID(),
    );

    await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.RETURN_TO_AGENDA,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    const stored = await environment.prisma.case.findUnique({ where: { id: caseId } });
    expect(stored?.currentState).toBe(CaseState.AGENDA_READY);
    expect(stored?.assignedRapporteurId).toBe(rapporteurUser.id);
  });

  it('agenda_ready → submit_to_member_approval → member_approval', async () => {
    const caseId = await createCaseAtState(CaseState.AGENDA_READY, secretaryUser.id);

    const result = await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.SUBMIT_TO_MEMBER_APPROVAL,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    expect(result.toState).toBe(CaseState.MEMBER_APPROVAL);
  });

  it('member_approval → member_objection → member_approval (itiraz dongusu)', async () => {
    const caseId = await createCaseAtState(CaseState.MEMBER_APPROVAL, secretaryUser.id);

    const result = await caseService.executeTransition(
      memberUser,
      caseId,
      {
        command: WorkflowCommand.MEMBER_OBJECTION,
        idempotencyKey: randomUUID(),
        metadata: { objectionSummary: 'Karar metninde eksiklik var.' },
      },
      randomUUID(),
    );

    expect(result).toMatchObject({
      fromState: CaseState.MEMBER_APPROVAL,
      toState: CaseState.MEMBER_APPROVAL,
      command: WorkflowCommand.MEMBER_OBJECTION,
    });
  });

  it('negatif: assign_rapporteur metadata eksik → VALIDATION_FAILED', async () => {
    const caseId = await createCaseAtState(CaseState.AGENDA_READY, secretaryUser.id);

    await expect(
      caseService.executeTransition(
        secretaryUser,
        caseId,
        {
          command: WorkflowCommand.ASSIGN_RAPPORTEUR,
          idempotencyKey: randomUUID(),
          metadata: {},
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('negatif: raportor olmayan kullanici atanamaz → CASE_PRECONDITION_FAILED', async () => {
    const caseId = await createCaseAtState(CaseState.AGENDA_READY, secretaryUser.id);

    await expect(
      caseService.executeTransition(
        secretaryUser,
        caseId,
        {
          command: WorkflowCommand.ASSIGN_RAPPORTEUR,
          idempotencyKey: randomUUID(),
          metadata: { rapporteurUserId: memberUser.id },
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.CASE_PRECONDITION_FAILED });
  });

  it('negatif: atanmamis raportor submit_rapporteur_report → AUTHZ_FORBIDDEN', async () => {
    const caseId = await createCaseAtState(CaseState.RAPPORTEUR_ASSIGNED, secretaryUser.id);
    await environment.prisma.case.update({
      where: { id: caseId },
      data: { assignedRapporteurId: rapporteurUser.id },
    });

    await expect(
      caseService.executeTransition(
        memberUser,
        caseId,
        {
          command: WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT,
          idempotencyKey: randomUUID(),
          metadata: { rapporteurReportDocumentId: randomUUID() },
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.AUTHZ_FORBIDDEN });
  });

  it('negatif: submit_rapporteur_report dokuman metadata eksik → VALIDATION_FAILED', async () => {
    const caseId = await createCaseAtState(CaseState.RAPPORTEUR_ASSIGNED, secretaryUser.id);
    await environment.prisma.case.update({
      where: { id: caseId },
      data: { assignedRapporteurId: rapporteurUser.id },
    });

    await expect(
      caseService.executeTransition(
        rapporteurUser,
        caseId,
        {
          command: WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT,
          idempotencyKey: randomUUID(),
          metadata: {},
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('negatif: council_member assign_rapporteur yapamaz → AUTHZ_FORBIDDEN', async () => {
    const caseId = await createCaseAtState(CaseState.AGENDA_READY, secretaryUser.id);

    await expect(
      caseService.executeTransition(
        memberUser,
        caseId,
        {
          command: WorkflowCommand.ASSIGN_RAPPORTEUR,
          idempotencyKey: randomUUID(),
          metadata: { rapporteurUserId: rapporteurUser.id },
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.AUTHZ_FORBIDDEN });
  });

  it('negatif: agenda_ready state inde approve_agenda → CASE_INVALID_TRANSITION', async () => {
    const caseId = await createCaseAtState(CaseState.AGENDA_READY, secretaryUser.id);

    await expect(
      caseService.executeTransition(
        chairUser,
        caseId,
        {
          command: WorkflowCommand.APPROVE_AGENDA,
          idempotencyKey: randomUUID(),
          metadata: {},
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.CASE_INVALID_TRANSITION });
  });

  it('confidentiality update: council_secretary gunceller ve audit kaydi olusur', async () => {
    const caseId = await createCaseAtState(CaseState.AGENDA_READY, secretaryUser.id);
    const idempotencyKey = randomUUID();
    const correlationId = randomUUID();

    const result = await caseService.updateConfidentiality(
      secretaryUser,
      caseId,
      {
        confidentialityLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        reason: 'Kurul karariyla en yuksek gizlilik seviyesi.',
        idempotencyKey,
      },
      correlationId,
    );

    expect(result).toMatchObject({
      caseId,
      previousLevel: ClearanceLevel.SENSITIVE,
      confidentialityLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
      idempotentReplay: false,
    });

    const storedCase = await environment.prisma.case.findUnique({ where: { id: caseId } });
    expect(storedCase?.confidentialityLevel).toBe(ClearanceLevel.STRICTLY_CONFIDENTIAL);

    const storedReport = await environment.prisma.report.findFirst({
      where: { caseId },
    });
    expect(storedReport?.confidentialityLevel).toBe(ClearanceLevel.STRICTLY_CONFIDENTIAL);

    const auditRecord = await environment.prisma.auditOutbox.findFirst({
      where: { idempotencyKey: `audit:case-confidentiality:${idempotencyKey}` },
    });

    expect(auditRecord).toMatchObject({
      eventType: 'CASE_CONFIDENTIALITY_CHANGED',
      resourceId: caseId,
      caseId,
      correlationId,
      dispatchStatus: 'PENDING',
    });
  });

  it('confidentiality update: council_chair guncelleyebilir', async () => {
    const caseId = await createCaseAtState(CaseState.AGENDA_READY, secretaryUser.id);

    const result = await caseService.updateConfidentiality(
      chairUser,
      caseId,
      {
        confidentialityLevel: ClearanceLevel.NORMAL,
        reason: 'Kurul baskani gizlilik dusurme karari.',
        idempotencyKey: randomUUID(),
      },
      randomUUID(),
    );

    expect(result.confidentialityLevel).toBe(ClearanceLevel.NORMAL);
  });

  it('confidentiality idempotency: ayni key ile tekrar istek cift guncelleme yapmaz', async () => {
    const caseId = await createCaseAtState(CaseState.AGENDA_READY, secretaryUser.id);
    const idempotencyKey = randomUUID();
    const body = {
      confidentialityLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
      reason: 'Idempotency testi.',
      idempotencyKey,
    };

    const first = await caseService.updateConfidentiality(
      secretaryUser,
      caseId,
      body,
      randomUUID(),
    );

    const second = await caseService.updateConfidentiality(
      secretaryUser,
      caseId,
      body,
      randomUUID(),
    );

    expect(second.idempotentReplay).toBe(true);
    expect(second.confidentialityLevel).toBe(first.confidentialityLevel);

    const auditCount = await environment.prisma.auditOutbox.count({
      where: { idempotencyKey: `audit:case-confidentiality:${idempotencyKey}` },
    });
    expect(auditCount).toBe(1);
  });

  it('negatif: action_owner confidentiality guncelleyemez (ABAC 404)', async () => {
    const caseId = await createCaseAtState(CaseState.AGENDA_READY, secretaryUser.id);
    const actionOwner = await createRoleUser(environment.prisma, {
      email: 'stage2-owner@ethics.local',
      oidcSubjectId: 'stage2-owner-oidc',
      role: Role.ACTION_OWNER,
      clearanceLevel: ClearanceLevel.SENSITIVE,
    });

    await expect(
      caseService.updateConfidentiality(
        actionOwner,
        caseId,
        {
          confidentialityLevel: ClearanceLevel.NORMAL,
          reason: 'Yetkisiz deneme.',
          idempotencyKey: randomUUID(),
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
  });

  it('negatif: ayni gizlilik seviyesi → VALIDATION_FAILED', async () => {
    const caseId = await createCaseAtState(CaseState.AGENDA_READY, secretaryUser.id);

    await expect(
      caseService.updateConfidentiality(
        secretaryUser,
        caseId,
        {
          confidentialityLevel: ClearanceLevel.SENSITIVE,
          reason: 'Degisiklik yok.',
          idempotencyKey: randomUUID(),
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });
});
