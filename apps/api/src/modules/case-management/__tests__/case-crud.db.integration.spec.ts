import { randomUUID } from 'node:crypto';

import {
  AuditEventType,
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
import { seedRoleTestUsers, seedSyntheticCompany } from '@ethics/test-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDefaultFieldVisibilityPolicyService } from '../../../authorization/field-visibility-policy.service.js';
import { FieldMaskingService } from '../../../authorization/field-masking.service.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { CaseService } from '../case.service.js';
import { createCaseServiceForTests } from './case-service.test-factory.js';

describe('Case CRUD + ABAC scoping (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let caseService: CaseService;
  let fieldMasking: FieldMaskingService;
  let companyId: string;
  let otherCompanyId: string;
  let secretaryUser: AuthenticatedUser;
  let actionOwnerUser: AuthenticatedUser;
  let adminUser: AuthenticatedUser;
  let limitedClearanceSecretary: AuthenticatedUser;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    companyId = await seedSyntheticCompany(environment.prisma);
    await seedRoleTestUsers(environment.prisma);

    otherCompanyId = await environment.prisma.company
      .create({
        data: {
          code: 'OTHER-CO-CRUD',
          name: 'Diğer Şirket CRUD',
          sourceSystem: 'seed',
          sourceRecordId: 'other-company-crud',
        },
        select: { id: true },
      })
      .then((company) => company.id);

    const prismaService = environment.prisma as unknown as PrismaService;
    caseService = createCaseServiceForTests(prismaService);
    fieldMasking = new FieldMaskingService(createDefaultFieldVisibilityPolicyService());

    secretaryUser = await loadUserByEmail(environment.prisma, 'council.secretary@ethics.local');
    actionOwnerUser = await loadUserByEmail(
      environment.prisma,
      'action.owner@ethics.local',
      companyId,
    );
    adminUser = await loadUserByEmail(environment.prisma, 'superadmin@ethics.local');
    limitedClearanceSecretary = {
      ...secretaryUser,
      clearanceLevel: ClearanceLevel.NORMAL,
    };
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  async function loadUserByEmail(
    prisma: PrismaClient,
    email: string,
    expectedCompanyId?: string,
  ): Promise<AuthenticatedUser> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: {
        rolesAssigned: { where: { isActive: true } },
        company: true,
      },
    });

    if (expectedCompanyId) {
      expect(user.companyId).toBe(expectedCompanyId);
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.rolesAssigned.map((role) => role.roleCode as Role),
      clearanceLevel: user.clearanceLevel as ClearanceLevel,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
      functionId: user.functionId,
      locationId: user.locationId,
      isGeneralSecretary: user.isGeneralSecretary,
    };
  }

  async function createReport(options?: {
    companyId?: string;
    confidentialityLevel?: ClearanceLevel;
    incidentDescription?: string;
  }): Promise<string> {
    const raw = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const trackingCode = `ETK-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;

    const report = await environment.prisma.report.create({
      data: {
        trackingCode,
        trackingCodePasswordHash:
          '$argon2id$v=19$m=65536,t=3,p=1$dGVzdA$placeholder-hash-for-integration-test',
        isAnonymous: true,
        incidentCountry: 'TUR',
        incidentCity: 'Ankara',
        companyId: options?.companyId ?? companyId,
        categoryGroup: ReportCategoryGroup.EMPLOYEE_HUMAN,
        categories: [ReportSubCategory.WORKPLACE_VIOLENCE],
        incidentDescription:
          options?.incidentDescription ?? 'CRUD integration test — gizli olay açıklaması.',
        encryptionMetadata: { version: 'test-v1', algorithm: 'none' },
        status: ReportStatus.SUBMITTED,
        confidentialityLevel: options?.confidentialityLevel ?? ClearanceLevel.SENSITIVE,
        channel: ReportChannel.WEB_FORM,
        kvkkConsentVersion: '1.0',
        kvkkConsentAt: new Date(),
        submittedAt: new Date(),
      },
    });

    return report.id;
  }

  async function createCaseWithAssignment(
    options: {
      assignedActionOwnerId?: string;
      assignedRapporteurId?: string;
      companyId?: string;
      currentState?: string;
      confidentialityLevel?: ClearanceLevel;
      incidentDescription?: string;
    } = {},
  ): Promise<string> {
    const reportId = await createReport({
      companyId: options.companyId ?? companyId,
      confidentialityLevel: options.confidentialityLevel,
      incidentDescription: options.incidentDescription,
    });

    return environment.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdCase = await tx.case.create({
        data: {
          reportId,
          currentState: options.currentState ?? CaseState.REPORT_SUBMITTED,
          workflowVersion: WORKFLOW_VERSION,
          confidentialityLevel: options.confidentialityLevel ?? ClearanceLevel.SENSITIVE,
          companyId: options.companyId ?? companyId,
          assignedActionOwnerId: options.assignedActionOwnerId ?? null,
          assignedRapporteurId: options.assignedRapporteurId ?? null,
          createdBy: secretaryUser.id,
        },
      });

      await tx.report.update({
        where: { id: reportId },
        data: { caseId: createdCase.id },
      });

      return createdCase.id;
    });
  }

  it('council_secretary tüm şirket vakalarını listede görür', async () => {
    const ownCompanyCaseId = await createCaseWithAssignment({ companyId });
    const otherCompanyCaseId = await createCaseWithAssignment({ companyId: otherCompanyId });

    const result = await caseService.listCases(secretaryUser, {
      limit: 100,
      sortBy: 'openedAt',
      sortOrder: 'desc',
    });

    const ids = result.data.map((item) => item.id);
    expect(ids).toContain(ownCompanyCaseId);
    expect(ids).toContain(otherCompanyCaseId);
  });

  it('action_owner yalnızca kendi şirket vakalarını listede görür', async () => {
    const ownCompanyCaseId = await createCaseWithAssignment({
      companyId,
      assignedActionOwnerId: actionOwnerUser.id,
      confidentialityLevel: ClearanceLevel.NORMAL,
    });
    const otherCompanyCaseId = await createCaseWithAssignment({
      companyId: otherCompanyId,
      confidentialityLevel: ClearanceLevel.NORMAL,
    });

    const result = await caseService.listCases(actionOwnerUser, {
      limit: 100,
      sortBy: 'openedAt',
      sortOrder: 'desc',
    });
    const ids = result.data.map((item) => item.id);

    expect(ids).toContain(ownCompanyCaseId);
    expect(ids).not.toContain(otherCompanyCaseId);
  });

  it('clearance yetersiz kullanıcı SENSITIVE vaka detayına erişemez (404)', async () => {
    const caseId = await createCaseWithAssignment({
      confidentialityLevel: ClearanceLevel.SENSITIVE,
    });

    await expect(
      caseService.getCaseDetail(limitedClearanceSecretary, caseId, randomUUID()),
    ).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
  });

  it('[AUTH-006] admin rolü vaka detayında incidentDescription alanını görmez', async () => {
    const caseId = await createCaseWithAssignment({
      incidentDescription: 'Admin görmemeli — gizli içerik',
    });

    const detail = await caseService.getCaseDetail(adminUser, caseId, randomUUID());

    expect(detail.id).toBe(caseId);
    expect(detail.incidentDescription).toBeUndefined();
    expect(detail.categoryGroup).toBeDefined();
  });

  it('admin field masking birim testi ile uyumlu — report_text yanıtta yok', () => {
    const masked = fieldMasking.applyCaseFieldPolicy(adminUser, {
      id: 'case-admin-mask',
      case_number: 'case-admin-mask',
      created_at: new Date().toISOString(),
      company_id: companyId,
      category: ReportCategoryGroup.EMPLOYEE_HUMAN,
      status: CaseState.REPORT_SUBMITTED,
      workflow_state: CaseState.REPORT_SUBMITTED,
      confidentiality_level: ClearanceLevel.SENSITIVE,
      report_text: 'Gizli metin',
      incident_description: 'Gizli olay',
    });

    expect(masked).not.toHaveProperty('report_text');
    expect(masked).not.toHaveProperty('incident_description');
  });

  it('report → case açma idempotent ve audit kaydı oluşturur', async () => {
    const reportId = await createReport();
    const idempotencyKey = randomUUID();
    const correlationId = randomUUID();

    const first = await caseService.createCaseFromReport(
      secretaryUser,
      { reportId, idempotencyKey },
      correlationId,
    );
    const second = await caseService.createCaseFromReport(
      secretaryUser,
      { reportId, idempotencyKey },
      randomUUID(),
    );

    expect(second.idempotentReplay).toBe(true);
    expect(second.caseId).toBe(first.caseId);

    const auditCount = await environment.prisma.auditOutbox.count({
      where: {
        eventType: AuditEventType.CASE_TRANSITION,
        action: 'case_opened',
        caseId: first.caseId,
      },
    });
    expect(auditCount).toBe(1);
  });

  it('vaka detayı availableActions döndürür', async () => {
    const caseId = await createCaseWithAssignment({ currentState: CaseState.REPORT_SUBMITTED });

    const detail = await caseService.getCaseDetail(secretaryUser, caseId, randomUUID());

    expect(detail.availableActions).toContain(WorkflowCommand.ACKNOWLEDGE_REPORT);
  });

  it('yetkisiz vaka detayı → RESOURCE_NOT_FOUND', async () => {
    const caseId = await createCaseWithAssignment({ companyId: otherCompanyId });

    await expect(
      caseService.getCaseDetail(actionOwnerUser, caseId, randomUUID()),
    ).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
  });

  it('concurrent transition → biri başarılı, diğeri reddedilir (409)', async () => {
    const caseId = await createCaseWithAssignment({ currentState: CaseState.REPORT_SUBMITTED });

    const firstPromise = caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    const secondPromise = caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    const results = await Promise.allSettled([firstPromise, secondPromise]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectedResult = rejected[0];
    expect(rejectedResult?.status).toBe('rejected');
    if (rejectedResult?.status === 'rejected') {
      expect(rejectedResult.reason).toBeInstanceOf(DomainException);
      const code = (rejectedResult.reason as DomainException).code;
      expect([ErrorCode.CASE_OPTIMISTIC_LOCK, ErrorCode.CASE_INVALID_TRANSITION]).toContain(code);
    }
  });

  it('liste filtreleri status, companyId ve assignedToMe uygular', async () => {
    const assignedCaseId = await createCaseWithAssignment({
      assignedActionOwnerId: actionOwnerUser.id,
      currentState: CaseState.ACTION_ASSIGNED,
      confidentialityLevel: ClearanceLevel.NORMAL,
    });
    await createCaseWithAssignment({
      companyId: otherCompanyId,
      currentState: CaseState.REPORT_SUBMITTED,
      confidentialityLevel: ClearanceLevel.NORMAL,
    });

    const filtered = await caseService.listCases(actionOwnerUser, {
      limit: 50,
      sortBy: 'openedAt',
      sortOrder: 'desc',
      status: [CaseState.ACTION_ASSIGNED],
      companyId,
      assignedToMe: true,
    });

    expect(filtered.data.map((item) => item.id)).toEqual([assignedCaseId]);
  });

  it('liste tarih filtreleri dateFrom/dateTo uygular', async () => {
    const caseId = await createCaseWithAssignment({ confidentialityLevel: ClearanceLevel.NORMAL });
    const openedAt = new Date('2026-06-01T10:00:00.000Z');
    await environment.prisma.case.update({
      where: { id: caseId },
      data: { openedAt },
    });

    const inRange = await caseService.listCases(secretaryUser, {
      limit: 50,
      sortBy: 'openedAt',
      sortOrder: 'desc',
      dateFrom: '2026-06-01T00:00:00.000Z',
      dateTo: '2026-06-30T23:59:59.999Z',
    });

    const outOfRange = await caseService.listCases(secretaryUser, {
      limit: 50,
      sortBy: 'openedAt',
      sortOrder: 'desc',
      dateFrom: '2027-01-01T00:00:00.000Z',
    });

    expect(inRange.data.map((item) => item.id)).toContain(caseId);
    expect(outOfRange.data.map((item) => item.id)).not.toContain(caseId);
  });

  it('listCaseTransitions geçiş tarihçesini döner', async () => {
    const caseId = await createCaseWithAssignment({ currentState: CaseState.REPORT_SUBMITTED });

    await caseService.executeTransition(
      secretaryUser,
      caseId,
      {
        command: WorkflowCommand.ACKNOWLEDGE_REPORT,
        idempotencyKey: randomUUID(),
        metadata: {},
      },
      randomUUID(),
    );

    const transitions = await caseService.listCaseTransitions(secretaryUser, caseId);

    expect(transitions.length).toBeGreaterThanOrEqual(1);
    expect(transitions[0]).toMatchObject({
      fromState: CaseState.REPORT_SUBMITTED,
      toState: CaseState.SECRETARIAT_REVIEW,
      command: WorkflowCommand.ACKNOWLEDGE_REPORT,
    });
  });

  it('createCaseFromReport — bildirim bulunamazsa RESOURCE_NOT_FOUND', async () => {
    await expect(
      caseService.createCaseFromReport(
        secretaryUser,
        { reportId: randomUUID(), idempotencyKey: randomUUID() },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
  });

  it('GET detail CASE_VIEWED audit outbox kaydı oluşturur', async () => {
    const caseId = await createCaseWithAssignment();
    const correlationId = randomUUID();

    await caseService.getCaseDetail(secretaryUser, caseId, correlationId);

    const audit = await environment.prisma.auditOutbox.findUnique({
      where: { idempotencyKey: `audit:case-viewed:${correlationId}:${caseId}` },
    });

    expect(audit).toMatchObject({
      eventType: AuditEventType.CASE_VIEWED,
      action: 'case_viewed',
      caseId,
    });
  });
});
