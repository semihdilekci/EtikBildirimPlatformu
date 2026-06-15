import { randomUUID } from 'node:crypto';

import {
  ClearanceLevel,
  ErrorCode,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
  Role,
  WORKFLOW_VERSION,
} from '@ethics/shared';
import type { PrismaClient } from '@prisma/client';
import { seedRoleTestUsers, seedSyntheticCompany } from '@ethics/test-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDefaultFieldVisibilityPolicyService } from '../../../authorization/field-visibility-policy.service.js';
import { FieldMaskingService } from '../../../authorization/field-masking.service.js';
import { PolicyScopeService } from '../../../authorization/policy-scope.service.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { EnvService } from '../../../common/config/env.service.js';
import { CryptoService } from '../../../crypto/crypto.service.js';
import { LocalKeyManagementAdapter } from '../../../crypto/key-management.adapter.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import {
  createPostgresTestEnvironment,
  type PostgresTestEnvironment,
} from '../../../test/postgres-test-environment.js';
import { CaseReportDecryptService } from '../../case-management/case-report-decrypt.service.js';
import { InternalReportService } from '../internal-report.service.js';

function buildTestCryptoService(): CryptoService {
  const envService = {
    cryptoKeyManagementProvider: 'local',
    cryptoLocalKekField: Buffer.alloc(32, 0x01).toString('base64'),
    cryptoLocalKekDocument: Buffer.alloc(32, 0x02).toString('base64'),
  } as EnvService;

  return new CryptoService(new LocalKeyManagementAdapter(envService));
}

describe('Pending reports API scope (Testcontainers)', () => {
  let environment: PostgresTestEnvironment;
  let internalReportService: InternalReportService;
  let companyId: string;
  let secretaryUser: AuthenticatedUser;
  let adminUser: AuthenticatedUser;
  let limitedClearanceSecretary: AuthenticatedUser;

  beforeAll(async () => {
    environment = await createPostgresTestEnvironment();
    companyId = await seedSyntheticCompany(environment.prisma);
    await seedRoleTestUsers(environment.prisma);

    const prismaService = environment.prisma as unknown as PrismaService;
    internalReportService = new InternalReportService(
      prismaService,
      new PolicyScopeService(),
      new FieldMaskingService(createDefaultFieldVisibilityPolicyService()),
      new CaseReportDecryptService(buildTestCryptoService()),
    );

    secretaryUser = await loadUserByEmail(environment.prisma, 'council.secretary@ethics.local');
    adminUser = await loadUserByEmail(environment.prisma, 'superadmin@ethics.local');
    limitedClearanceSecretary = {
      ...secretaryUser,
      clearanceLevel: ClearanceLevel.NORMAL,
    };
  }, 120_000);

  afterAll(async () => {
    await environment.teardown();
  }, 30_000);

  async function loadUserByEmail(prisma: PrismaClient, email: string): Promise<AuthenticatedUser> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: {
        rolesAssigned: { where: { isActive: true } },
        company: true,
      },
    });

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

  async function createSubmittedReport(options?: {
    companyId?: string;
    confidentialityLevel?: ClearanceLevel;
    incidentDescription?: string;
    trackingCode?: string;
    caseId?: string | null;
  }): Promise<string> {
    const raw = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const trackingCode = options?.trackingCode ?? `ETK-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;

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
          options?.incidentDescription ??
          'Pending reports integration test — gizli olay açıklaması.',
        encryptionMetadata: { version: 'test-v1', algorithm: 'none' },
        status: ReportStatus.SUBMITTED,
        confidentialityLevel: options?.confidentialityLevel ?? ClearanceLevel.SENSITIVE,
        channel: ReportChannel.WEB_FORM,
        kvkkConsentVersion: '1.0',
        kvkkConsentAt: new Date(),
        submittedAt: new Date(),
        caseId: options?.caseId ?? null,
      },
    });

    return report.id;
  }

  it('council_secretary bekleyen SUBMITTED raporları listeler', async () => {
    const reportId = await createSubmittedReport({
      trackingCode: 'ETK-NPW7-PCGA',
      incidentDescription: 'ETK-NPW7-PCGA tipi bekleyen bildirim.',
    });

    const result = await internalReportService.listPendingReports(secretaryUser, {
      limit: 50,
      sortBy: 'submittedAt',
      sortOrder: 'desc',
    });

    expect(result.data.map((item) => item.id)).toContain(reportId);
    const item = result.data.find((row) => row.id === reportId);
    expect(item).toMatchObject({
      trackingCodeMasked: 'ETK-NPW7-****',
      status: ReportStatus.SUBMITTED,
      urgentRiskFlag: false,
    });
    expect(item).not.toHaveProperty('incidentDescription');
  });

  it('admin kullanıcı pending listeye erişemez (boş scope)', async () => {
    await createSubmittedReport();

    const result = await internalReportService.listPendingReports(adminUser, {
      limit: 50,
      sortBy: 'submittedAt',
      sortOrder: 'desc',
    });

    expect(result.data).toEqual([]);
  });

  it('admin kullanıcı rapor detayında RESOURCE_NOT_FOUND alır', async () => {
    const reportId = await createSubmittedReport();

    await expect(
      internalReportService.getInternalReportDetail(adminUser, reportId),
    ).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
  });

  it('yetersiz clearance olan sekreter yüksek gizlilik raporunu göremez', async () => {
    const reportId = await createSubmittedReport({
      confidentialityLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
    });

    const list = await internalReportService.listPendingReports(limitedClearanceSecretary, {
      limit: 50,
      sortBy: 'submittedAt',
      sortOrder: 'desc',
    });

    expect(list.data.map((item) => item.id)).not.toContain(reportId);

    await expect(
      internalReportService.getInternalReportDetail(limitedClearanceSecretary, reportId),
    ).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
  });

  it('vakası olan rapor pending listede görünmez', async () => {
    const reportId = await createSubmittedReport();
    const caseRecord = await environment.prisma.case.create({
      data: {
        reportId,
        currentState: 'report_submitted',
        workflowVersion: WORKFLOW_VERSION,
        confidentialityLevel: ClearanceLevel.SENSITIVE,
        companyId,
        createdBy: secretaryUser.id,
      },
    });

    await environment.prisma.report.update({
      where: { id: reportId },
      data: { caseId: caseRecord.id },
    });

    const result = await internalReportService.listPendingReports(secretaryUser, {
      limit: 50,
      sortBy: 'submittedAt',
      sortOrder: 'desc',
    });

    expect(result.data.map((item) => item.id)).not.toContain(reportId);
  });

  it('council_secretary maskeli rapor detayını alır', async () => {
    const reportId = await createSubmittedReport({
      incidentDescription: 'Detay önizleme — tam metin sekreterya için görünür.',
    });

    const detail = await internalReportService.getInternalReportDetail(secretaryUser, reportId);

    expect(detail).toMatchObject({
      id: reportId,
      trackingCodeMasked: expect.stringMatching(/^ETK-/),
      status: ReportStatus.SUBMITTED,
      incidentDescription: 'Detay önizleme — tam metin sekreterya için görünür.',
    });
  });
});
