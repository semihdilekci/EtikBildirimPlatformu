import { HttpStatus } from '@nestjs/common';
import { ErrorCode, MAX_TOTAL_CASE_DOCUMENT_BYTES } from '@ethics/shared';

import { DomainException } from '../../common/exceptions/domain.exception.js';

export function buildCaseDocumentStorageKey(
  caseId: string,
  documentId: string,
  versionNo: number,
): string {
  return `quarantine/cases/${caseId}/${documentId}/v${String(versionNo)}`;
}

export function assertTotalCaseDocumentSize(
  existingTotalBytes: bigint,
  incomingSizeBytes: number,
): void {
  const nextTotal = existingTotalBytes + BigInt(incomingSizeBytes);
  if (nextTotal > BigInt(MAX_TOTAL_CASE_DOCUMENT_BYTES)) {
    throw new DomainException(
      ErrorCode.DOCUMENT_SIZE_EXCEEDED,
      'Toplam yükleme boyutu limiti aşıldı.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
