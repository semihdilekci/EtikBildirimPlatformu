import type { EncryptedFieldResult } from '../../crypto/crypto.types.js';

export interface FieldEncryptionMetadataEntry {
  encryptedDek: string;
  kmsKeyId: string;
  algorithm: string;
}

export type ReportEncryptionMetadata = Record<string, FieldEncryptionMetadataEntry>;

export interface EncryptedReportFields {
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
  encryptionMetadata: ReportEncryptionMetadata;
}

export function buildEncryptionMetadataEntry(
  encrypted: EncryptedFieldResult,
): FieldEncryptionMetadataEntry {
  return {
    encryptedDek: encrypted.encryptedDek,
    kmsKeyId: encrypted.kmsKeyId,
    algorithm: encrypted.algorithm,
  };
}

export function mergeEncryptionMetadata(
  metadata: ReportEncryptionMetadata,
  fieldName: string,
  encrypted: EncryptedFieldResult,
): ReportEncryptionMetadata {
  return {
    ...metadata,
    [fieldName]: buildEncryptionMetadataEntry(encrypted),
  };
}
