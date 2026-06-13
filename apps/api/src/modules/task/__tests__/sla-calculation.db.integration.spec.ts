import { randomUUID } from 'node:crypto';

import {
  BusinessCalendarDayType,
  ClearanceLevel,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
  Role,
  TaskType,
  WorkflowCommand,
} from '@ethics/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import type { PrismaService } from '../../../prisma/prisma.service.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { createCaseServiceForTests } from '../../case-management/__tests__/case-service.test-factory.js';
import type { CaseService } from '../../case-management/case.service.js';
import { BusinessCalendarService } from '../sla/business-calendar.service.js';
import { SlaCalculatorService } from '../sla/sla-calculator.service.js';
import { toIstanbulDateKey } from '../sla/business-calendar.util.js';

describe('SLA calculation integration (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let caseService: CaseService;
  let slaCalculator: SlaCalculatorService;
  let companyId: string;
  let secretaryUser: AuthenticatedUser;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();

    caseService = createCaseServiceForTests(environment.prisma as unknown as PrismaService);
    slaCalculator = new SlaCalculatorService(
      new BusinessCalendarService(environment.prisma as unknown as PrismaService),
    );

    const { seedSyntheticCompany } = await import('@ethics/test-fixtures');
    companyId = await seedSyntheticCompany(environment.prisma);

    const user = await environment.prisma.user.create({
      data: {
        email: 'sla-calc-secretary@ethics.local',
        displayName: 'SLA Calc Secretary',
        oidcSubjectId: 'sla-calc-secretary-oidc',
        clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        provisionedAt: new Date(),
      },
    });

    await environment.prisma.userRole.create({
      data: {
        userId: user.id,
        roleCode: Role.COUNCIL_SECRETARY,
        assignedBy: user.id,
        reason: 'SLA calculation integration test',
      },
    });

    secretaryUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: [Role.COUNCIL_SECRETARY],
      clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
      companyId: null,
      companyName: null,
      functionId: null,
      locationId: null,
      isGeneralSecretary: false,
    };
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  async function createCase(): Promise<string> {
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
        companyId,
        categoryGroup: ReportCategoryGroup.EMPLOYEE_HUMAN,
        categories: [ReportSubCategory.WORKPLACE_VIOLENCE],
        incidentDescription: 'Sentetik SLA calculation test bildirimi.',
        encryptionMetadata: { version: 'test-v1', algorithm: 'none' },
        status: ReportStatus.SUBMITTED,
        confidentialityLevel: ClearanceLevel.SENSITIVE,
        channel: ReportChannel.WEB_FORM,
        kvkkConsentVersion: '1.0',
        kvkkConsentAt: new Date(),
        submittedAt: new Date(),
      },
    });

    const created = await caseService.createCaseFromReport(
      secretaryUser,
      {
        reportId: report.id,
        idempotencyKey: randomUUID(),
      },
      randomUUID(),
    );

    return created.caseId;
  }

  it('task create sırasında due_at ve sla_policy_id set edilir', async () => {
    const caseId = await createCase();

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

    const task = await environment.prisma.task.findFirstOrThrow({
      where: {
        caseId,
        taskType: TaskType.SECRETARIAT_REVIEW_TASK,
      },
      include: {
        slaPolicy: true,
      },
    });

    expect(task.dueAt).not.toBeNull();
    expect(task.slaPolicyId).not.toBeNull();
    expect(task.slaPolicy?.slaDuration).toBe(3);
    expect(task.slaPolicy?.slaUnit).toBe('business_days');
  });

  it('14 iş günü aksiyon SLA takvim günü değil iş günü sayar', async () => {
    const assignedAt = new Date('2025-01-03T10:00:00+03:00');

    await environment.prisma.businessCalendarEntry.create({
      data: {
        date: new Date('2025-01-06T12:00:00+03:00'),
        dayType: BusinessCalendarDayType.OFFICIAL_HOLIDAY,
        description: 'Test resmi tatil',
      },
    });

    const result = await environment.prisma.$transaction((tx) =>
      slaCalculator.calculateDueAt(tx, TaskType.ACTION_RESPONSE_TASK, assignedAt),
    );

    const calendarDays = Math.round(
      (result.dueAt.getTime() - assignedAt.getTime()) / (24 * 60 * 60 * 1000),
    );

    expect(calendarDays).toBeGreaterThan(14);
    expect(toIstanbulDateKey(result.dueAt)).toBe('2025-01-23');
  });

  it('member_approval_task 24 takvim saati SLA kullanır', async () => {
    const assignedAt = new Date('2025-06-10T10:00:00+03:00');

    const result = await environment.prisma.$transaction((tx) =>
      slaCalculator.calculateDueAt(tx, TaskType.MEMBER_APPROVAL_TASK, assignedAt),
    );

    expect(result.dueAt.toISOString()).toBe(new Date('2025-06-11T10:00:00+03:00').toISOString());
  });
});
