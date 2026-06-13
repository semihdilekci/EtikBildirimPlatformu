import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CreateReportBody } from '@ethics/dto';
import {
  AuditActorType,
  AuditEventType,
  AuditOutcome,
  ClearanceLevel,
  ErrorCode,
  REPORT_CATEGORY_CATALOG,
  REPORT_SUB_CATEGORY_TO_GROUP,
  ReportChannel,
  ReportStatus,
  type ReportSubCategoryCode,
} from '@ethics/shared';
import { Prisma } from '@prisma/client';

import { AuditEventPublisher } from '../../audit/audit-event.publisher.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { CryptoService } from '../../crypto/crypto.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  buildEncryptionMetadataEntry,
  type EncryptedReportFields,
  type ReportEncryptionMetadata,
} from './intake.types.js';
import { generateTrackingCode } from './tracking-code.util.js';
import { TrackingPasswordService } from './tracking-password.service.js';

const SUBMIT_SUCCESS_MESSAGE =
  'Bildiriminiz başarıyla alınmıştır. Takip kodunuzu güvenli bir yere kaydediniz.';

@Injectable()
export class IntakeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CryptoService) private readonly cryptoService: CryptoService,
    @Inject(TrackingPasswordService)
    private readonly trackingPasswordService: TrackingPasswordService,
    @Inject(AuditEventPublisher) private readonly auditPublisher: AuditEventPublisher,
  ) {}

  listCategories() {
    return REPORT_CATEGORY_CATALOG;
  }

  async getKvkkText() {
    const activeVersion = await this.prisma.kvkkConsentVersion.findFirst({
      where: { isActive: true },
      orderBy: { publishedAt: 'desc' },
    });

    if (!activeVersion) {
      throw new DomainException(
        ErrorCode.INTERNAL_ERROR,
        'Aktif KVKK metni bulunamadı.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      version: activeVersion.versionCode,
      effectiveDate: (activeVersion.publishedAt ?? activeVersion.createdAt).toISOString(),
      bodyHtml: `<p>${this.escapeHtml(activeVersion.contentText)}</p>`,
      privacyNoticeHtml:
        '<p>Bildiriminiz gizli tutulacaktır. Kişisel verileriniz yalnızca etik bildirim sürecinin yürütülmesi amacıyla işlenecektir.</p>',
    };
  }

  async listActiveCompanies() {
    const companies = await this.prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    return companies;
  }

  async createReport(dto: CreateReportBody, correlationId: string) {
    this.assertCategoryConsistency(dto.categoryGroup, dto.categories);
    await this.assertActiveCompany(dto.companyId);
    await this.assertActiveKvkkVersion(dto.kvkkConsentVersion);

    const reportId = randomUUID();
    const trackingCode = await this.generateUniqueTrackingCode();
    const passwordHash = await this.trackingPasswordService.hashPassword(dto.trackingPassword);
    const encryptedFields = await this.encryptReportFields(reportId, dto);
    const submittedAt = new Date();
    const kvkkConsentAt = submittedAt;

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.report.create({
        data: {
          id: reportId,
          trackingCode,
          trackingCodePasswordHash: passwordHash,
          isAnonymous: dto.isAnonymous,
          reporterIdentityName: encryptedFields.reporterIdentityName,
          reporterIdentityTitle: encryptedFields.reporterIdentityTitle,
          reporterIdentityRelation: encryptedFields.reporterIdentityRelation,
          reporterContactEmail: encryptedFields.reporterContactEmail,
          reporterContactPhone: encryptedFields.reporterContactPhone,
          reporterCountry: dto.reporterCountry ?? null,
          reporterCity: dto.reporterCity ?? null,
          incidentCountry: dto.incidentCountry,
          incidentCity: dto.incidentCity,
          incidentLocationDetail: dto.incidentLocationDetail ?? null,
          companyId: dto.companyId,
          categoryGroup: dto.categoryGroup,
          categories: dto.categories,
          isUncertainCategory: dto.isUncertainCategory,
          incidentDescription: encryptedFields.incidentDescription,
          incidentDateStart: dto.incidentDateStart ? new Date(dto.incidentDateStart) : null,
          incidentDateEnd: dto.incidentDateEnd ? new Date(dto.incidentDateEnd) : null,
          incidentIsOngoing: dto.incidentIsOngoing,
          incidentRecurrence: dto.incidentRecurrence ?? null,
          howReporterLearned: dto.howReporterLearned ?? null,
          previouslyReported: dto.previouslyReported,
          previouslyReportedTo: dto.previouslyReportedTo ?? null,
          urgentRiskFlag: dto.urgentRiskFlag,
          urgentRiskDescription: encryptedFields.urgentRiskDescription,
          involvedPersons: encryptedFields.involvedPersons,
          witnesses: encryptedFields.witnesses,
          categorySpecificData: encryptedFields.categorySpecificData,
          encryptionMetadata:
            encryptedFields.encryptionMetadata as unknown as Prisma.InputJsonValue,
          status: ReportStatus.SUBMITTED,
          confidentialityLevel: ClearanceLevel.SENSITIVE,
          channel: ReportChannel.WEB_FORM,
          kvkkConsentVersion: dto.kvkkConsentVersion,
          kvkkConsentAt,
          submittedAt,
          lastActivityAt: submittedAt,
        },
        select: {
          trackingCode: true,
          submittedAt: true,
        },
      });

      await this.auditPublisher.publish(tx, {
        eventType: AuditEventType.REPORT_SUBMITTED,
        actorType: AuditActorType.SYSTEM,
        action: 'report_submitted',
        outcome: AuditOutcome.SUCCESS,
        resourceType: 'report',
        resourceId: reportId,
        companyId: dto.companyId,
        correlationId,
        metadata: {
          channel: ReportChannel.WEB_FORM,
          categoryGroup: dto.categoryGroup,
          isAnonymous: dto.isAnonymous,
          confidentialityLevel: ClearanceLevel.SENSITIVE,
        },
        idempotencyKey: `report-submitted:${reportId}`,
      });

      return created;
    });

    return {
      trackingCode: report.trackingCode,
      submittedAt: report.submittedAt.toISOString(),
      message: SUBMIT_SUCCESS_MESSAGE,
    };
  }

  private assertCategoryConsistency(categoryGroup: string, categories: readonly string[]): void {
    for (const category of categories) {
      const expectedGroup = REPORT_SUB_CATEGORY_TO_GROUP[category as ReportSubCategoryCode];
      if (expectedGroup !== categoryGroup) {
        throw new DomainException(
          ErrorCode.DOCUMENT_TYPE_NOT_ALLOWED,
          'Seçilen kategori üst grup ile uyumlu değil.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }
  }

  private async assertActiveCompany(companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { isActive: true },
    });

    if (!company?.isActive) {
      throw new DomainException(
        ErrorCode.MASTER_DATA_INACTIVE,
        'Seçilen şirket aktif değil.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async assertActiveKvkkVersion(versionCode: string): Promise<void> {
    const version = await this.prisma.kvkkConsentVersion.findFirst({
      where: { versionCode, isActive: true },
    });

    if (!version) {
      throw new DomainException(
        ErrorCode.INTAKE_KVKK_VERSION_MISMATCH,
        'KVKK onay versiyonu geçersiz veya güncel değil.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async generateUniqueTrackingCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = generateTrackingCode();
      const existing = await this.prisma.report.findUnique({
        where: { trackingCode: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new DomainException(
      ErrorCode.INTERNAL_ERROR,
      'Takip kodu üretilemedi.',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  private async encryptReportFields(
    reportId: string,
    dto: CreateReportBody,
  ): Promise<EncryptedReportFields> {
    let metadata: ReportEncryptionMetadata = {};

    const incidentEncrypted = await this.cryptoService.encryptField(
      dto.incidentDescription,
      'incident_description',
      reportId,
    );
    metadata = {
      ...metadata,
      incident_description: buildEncryptionMetadataEntry(incidentEncrypted),
    };

    const encryptOptional = async (
      value: string | null | undefined,
      fieldName: string,
    ): Promise<string | null> => {
      if (!value?.trim()) {
        return null;
      }

      const encrypted = await this.cryptoService.encryptField(value, fieldName, reportId);
      metadata = {
        ...metadata,
        [fieldName]: buildEncryptionMetadataEntry(encrypted),
      };
      return encrypted.ciphertext;
    };

    const encryptJsonOptional = async (
      value: unknown,
      fieldName: string,
    ): Promise<string | null> => {
      if (value === null || value === undefined) {
        return null;
      }

      if (Array.isArray(value) && value.length === 0) {
        return null;
      }

      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
        return null;
      }

      const encrypted = await this.cryptoService.encryptField(
        JSON.stringify(value),
        fieldName,
        reportId,
      );
      metadata = {
        ...metadata,
        [fieldName]: buildEncryptionMetadataEntry(encrypted),
      };
      return encrypted.ciphertext;
    };

    const identityFields = dto.isAnonymous
      ? {
          reporterIdentityName: null,
          reporterIdentityTitle: null,
          reporterIdentityRelation: null,
          reporterContactEmail: null,
          reporterContactPhone: null,
        }
      : {
          reporterIdentityName: await encryptOptional(
            dto.reporterIdentityName,
            'reporter_identity_name',
          ),
          reporterIdentityTitle: await encryptOptional(
            dto.reporterIdentityTitle,
            'reporter_identity_title',
          ),
          reporterIdentityRelation: dto.reporterIdentityRelation
            ? await encryptOptional(dto.reporterIdentityRelation, 'reporter_identity_relation')
            : null,
          reporterContactEmail: await encryptOptional(
            dto.reporterContactEmail,
            'reporter_contact_email',
          ),
          reporterContactPhone: await encryptOptional(
            dto.reporterContactPhone,
            'reporter_contact_phone',
          ),
        };

    return {
      incidentDescription: incidentEncrypted.ciphertext,
      ...identityFields,
      urgentRiskDescription: await encryptOptional(
        dto.urgentRiskDescription,
        'urgent_risk_description',
      ),
      involvedPersons: await encryptJsonOptional(dto.involvedPersons, 'involved_persons'),
      witnesses: await encryptJsonOptional(dto.witnesses, 'witnesses'),
      categorySpecificData: await encryptJsonOptional(
        dto.categorySpecificData,
        'category_specific_data',
      ),
      encryptionMetadata: metadata,
    };
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
}
