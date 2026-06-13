import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';

import { CryptoService } from '../../crypto/crypto.service.js';
import type { EncryptedFieldResult } from '../../crypto/crypto.types.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import type { ReportEncryptionMetadata } from '../intake/intake.types.js';

type ReportFieldRow = {
  id: string;
  incidentDescription: string;
  reporterIdentityName: string | null;
  reporterIdentityTitle: string | null;
  reporterIdentityRelation: string | null;
  reporterContactEmail: string | null;
  reporterContactPhone: string | null;
  urgentRiskDescription: string | null;
  involvedPersons: string | null;
  witnesses: string | null;
  categorySpecificData: string | null;
  encryptionMetadata: unknown;
};

export type DecryptedReportFields = {
  incidentDescription: string;
  reporterIdentityName: string | null;
  reporterIdentityTitle: string | null;
  reporterIdentityRelation: string | null;
  reporterContactEmail: string | null;
  reporterContactPhone: string | null;
  urgentRiskDescription: string | null;
  involvedPersons: unknown;
  witnesses: unknown;
  categorySpecificData: unknown;
};

@Injectable()
export class CaseReportDecryptService {
  constructor(private readonly cryptoService: CryptoService) {}

  async decryptReportFields(report: ReportFieldRow): Promise<DecryptedReportFields> {
    const metadata = report.encryptionMetadata as ReportEncryptionMetadata | { algorithm?: string };

    if (this.isPlaintextMetadata(metadata)) {
      return this.fromPlaintextReport(report);
    }

    const encryptedMetadata = metadata as ReportEncryptionMetadata;

    return {
      incidentDescription: await this.decryptField(
        report.id,
        'incident_description',
        report.incidentDescription,
        encryptedMetadata,
      ),
      reporterIdentityName: await this.decryptOptionalField(
        report.id,
        'reporter_identity_name',
        report.reporterIdentityName,
        encryptedMetadata,
      ),
      reporterIdentityTitle: await this.decryptOptionalField(
        report.id,
        'reporter_identity_title',
        report.reporterIdentityTitle,
        encryptedMetadata,
      ),
      reporterIdentityRelation: await this.decryptOptionalField(
        report.id,
        'reporter_identity_relation',
        report.reporterIdentityRelation,
        encryptedMetadata,
      ),
      reporterContactEmail: await this.decryptOptionalField(
        report.id,
        'reporter_contact_email',
        report.reporterContactEmail,
        encryptedMetadata,
      ),
      reporterContactPhone: await this.decryptOptionalField(
        report.id,
        'reporter_contact_phone',
        report.reporterContactPhone,
        encryptedMetadata,
      ),
      urgentRiskDescription: await this.decryptOptionalField(
        report.id,
        'urgent_risk_description',
        report.urgentRiskDescription,
        encryptedMetadata,
      ),
      involvedPersons: await this.decryptOptionalJsonField(
        report.id,
        'involved_persons',
        report.involvedPersons,
        encryptedMetadata,
      ),
      witnesses: await this.decryptOptionalJsonField(
        report.id,
        'witnesses',
        report.witnesses,
        encryptedMetadata,
      ),
      categorySpecificData: await this.decryptOptionalJsonField(
        report.id,
        'category_specific_data',
        report.categorySpecificData,
        encryptedMetadata,
      ),
    };
  }

  private isPlaintextMetadata(metadata: unknown): metadata is { algorithm: 'none' } {
    return (
      typeof metadata === 'object' &&
      metadata !== null &&
      'algorithm' in metadata &&
      (metadata as { algorithm?: string }).algorithm === 'none'
    );
  }

  private fromPlaintextReport(report: ReportFieldRow): DecryptedReportFields {
    return {
      incidentDescription: report.incidentDescription,
      reporterIdentityName: report.reporterIdentityName,
      reporterIdentityTitle: report.reporterIdentityTitle,
      reporterIdentityRelation: report.reporterIdentityRelation,
      reporterContactEmail: report.reporterContactEmail,
      reporterContactPhone: report.reporterContactPhone,
      urgentRiskDescription: report.urgentRiskDescription,
      involvedPersons: this.parseJsonValue(report.involvedPersons),
      witnesses: this.parseJsonValue(report.witnesses),
      categorySpecificData: this.parseJsonValue(report.categorySpecificData),
    };
  }

  private async decryptOptionalField(
    reportId: string,
    fieldName: string,
    value: string | null,
    metadata: ReportEncryptionMetadata,
  ): Promise<string | null> {
    if (!value) {
      return null;
    }

    return this.decryptField(reportId, fieldName, value, metadata);
  }

  private async decryptOptionalJsonField(
    reportId: string,
    fieldName: string,
    value: string | null,
    metadata: ReportEncryptionMetadata,
  ): Promise<unknown> {
    if (!value) {
      return null;
    }

    const decrypted = await this.decryptField(reportId, fieldName, value, metadata);
    return this.parseJsonValue(decrypted);
  }

  private async decryptField(
    reportId: string,
    fieldName: string,
    ciphertext: string,
    metadata: ReportEncryptionMetadata,
  ): Promise<string> {
    const fieldMeta = metadata[fieldName];

    if (!fieldMeta) {
      return ciphertext;
    }

    const encrypted: EncryptedFieldResult = {
      ciphertext,
      encryptedDek: fieldMeta.encryptedDek,
      kmsKeyId: fieldMeta.kmsKeyId,
      algorithm: fieldMeta.algorithm as EncryptedFieldResult['algorithm'],
    };

    try {
      return await this.cryptoService.decryptField(encrypted, fieldName, reportId);
    } catch (error) {
      if (error instanceof DomainException && error.code === ErrorCode.CRYPTO_DECRYPT_FAILED) {
        throw error;
      }

      throw new DomainException(
        ErrorCode.CRYPTO_DECRYPT_FAILED,
        'Vaka içeriği çözümlenemedi.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private parseJsonValue(value: string | null): unknown {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
}
