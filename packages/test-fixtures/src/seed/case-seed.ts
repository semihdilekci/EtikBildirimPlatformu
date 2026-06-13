import {
  CaseState,
  ClearanceLevel,
  ReportCategoryGroup,
  ReportChannel,
  ReportStatus,
  ReportSubCategory,
  WORKFLOW_VERSION,
  WorkflowCommand,
  AuditActorType,
} from '@ethics/shared';
import type { PrismaClient } from '@prisma/client';

const SEED_REPORT_TRACKING_CODE = 'ETK-SEED-C001';
const SEED_CASE_ID = 'seed-workflow-case-001';

export const SEED_WORKFLOW_CASE = {
  caseId: SEED_CASE_ID,
  trackingCode: SEED_REPORT_TRACKING_CODE,
} as const;

export interface SeedWorkflowCaseStubResult {
  reportId: string;
  caseId: string;
  companyId: string;
  createdByUserId: string;
}

async function upsertSeedReport(prisma: PrismaClient, companyId: string): Promise<{ id: string }> {
  return prisma.report.upsert({
    where: { trackingCode: SEED_REPORT_TRACKING_CODE },
    create: {
      trackingCode: SEED_REPORT_TRACKING_CODE,
      trackingCodePasswordHash:
        '$argon2id$v=19$m=65536,t=3,p=1$c2VlZC1zYWx0$seed-placeholder-hash-not-for-auth',
      isAnonymous: true,
      incidentCountry: 'TUR',
      incidentCity: 'İstanbul',
      incidentLocationDetail: 'Sentetik seed lokasyon',
      companyId,
      categoryGroup: ReportCategoryGroup.ASSET_FINANCIAL,
      categories: [ReportSubCategory.EMBEZZLEMENT],
      incidentDescription: 'Sentetik seed bildirim — workflow test stub.',
      encryptionMetadata: { version: 'seed-v1', algorithm: 'none' },
      status: ReportStatus.SUBMITTED,
      confidentialityLevel: ClearanceLevel.SENSITIVE,
      channel: ReportChannel.MANUAL,
      kvkkConsentVersion: '1.0',
      kvkkConsentAt: new Date('2026-01-01T00:00:00.000Z'),
      submittedAt: new Date('2026-01-15T10:00:00.000Z'),
    },
    update: {
      companyId,
      status: ReportStatus.SUBMITTED,
      isAnonymous: true,
    },
    select: { id: true },
  });
}

/**
 * Sentetik report → case stub — Faz 5 workflow integration testleri için.
 * Idempotent upsert; mevcut seed case korunur.
 */
export async function seedWorkflowCaseStub(
  prisma: PrismaClient,
  options: { companyId: string; createdByUserId: string },
): Promise<SeedWorkflowCaseStubResult> {
  const report = await upsertSeedReport(prisma, options.companyId);

  const existingCase = await prisma.case.findUnique({
    where: { reportId: report.id },
    select: { id: true },
  });

  if (existingCase) {
    await prisma.report.update({
      where: { id: report.id },
      data: { caseId: existingCase.id },
    });

    return {
      reportId: report.id,
      caseId: existingCase.id,
      companyId: options.companyId,
      createdByUserId: options.createdByUserId,
    };
  }

  const openedAt = new Date('2026-01-16T09:00:00.000Z');

  const createdCase = await prisma.$transaction(async (tx) => {
    const caseRecord = await tx.case.create({
      data: {
        id: SEED_CASE_ID,
        reportId: report.id,
        currentState: CaseState.REPORT_SUBMITTED,
        workflowVersion: WORKFLOW_VERSION,
        confidentialityLevel: ClearanceLevel.SENSITIVE,
        companyId: options.companyId,
        openedAt,
        createdBy: options.createdByUserId,
      },
    });

    await tx.caseTransition.create({
      data: {
        caseId: caseRecord.id,
        fromState: CaseState.REPORT_SUBMITTED,
        toState: CaseState.REPORT_SUBMITTED,
        command: WorkflowCommand.OPEN_CASE,
        actorType: AuditActorType.SYSTEM,
        idempotencyKey: `seed-open-case-${caseRecord.id}`,
        transitionedAt: openedAt,
      },
    });

    await tx.report.update({
      where: { id: report.id },
      data: { caseId: caseRecord.id },
    });

    return caseRecord;
  });

  return {
    reportId: report.id,
    caseId: createdCase.id,
    companyId: options.companyId,
    createdByUserId: options.createdByUserId,
  };
}
