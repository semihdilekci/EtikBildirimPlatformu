import { HttpStatus } from '@nestjs/common';
import {
  ALLOWED_UPLOAD_RULES,
  ErrorCode,
  MAX_SINGLE_FILE_BYTES,
  MAX_TOTAL_REPORT_ATTACHMENT_BYTES,
} from '@ethics/shared';
import type { InitiateAttachmentBody } from '@ethics/dto';

import { DomainException } from '../../common/exceptions/domain.exception.js';

export function extractFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === filename.length - 1) {
    return '';
  }

  return filename.slice(lastDot + 1).toLowerCase();
}

export function assertAllowedUploadMetadata(body: InitiateAttachmentBody): void {
  const extension = extractFileExtension(body.originalFilename);
  const rule = ALLOWED_UPLOAD_RULES.find((candidate) => candidate.extension === extension);

  if (!rule) {
    throw new DomainException(
      ErrorCode.DOCUMENT_TYPE_NOT_ALLOWED,
      'İzin verilmeyen dosya tipi.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  const normalizedMime = body.mimeType.toLowerCase();
  if (!rule.mimeTypes.some((mime) => mime.toLowerCase() === normalizedMime)) {
    throw new DomainException(
      ErrorCode.DOCUMENT_TYPE_NOT_ALLOWED,
      'Dosya uzantısı ile MIME tipi eşleşmiyor.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  if (body.sizeBytes > MAX_SINGLE_FILE_BYTES) {
    throw new DomainException(
      ErrorCode.DOCUMENT_SIZE_EXCEEDED,
      'Dosya boyutu limiti aşıldı.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export function assertTotalAttachmentSize(
  existingTotalBytes: bigint,
  incomingSizeBytes: number,
): void {
  const nextTotal = existingTotalBytes + BigInt(incomingSizeBytes);
  if (nextTotal > BigInt(MAX_TOTAL_REPORT_ATTACHMENT_BYTES)) {
    throw new DomainException(
      ErrorCode.DOCUMENT_SIZE_EXCEEDED,
      'Toplam yükleme boyutu limiti aşıldı.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export function buildQuarantineStorageKey(reportId: string, attachmentId: string): string {
  return `quarantine/reports/${reportId}/${attachmentId}`;
}
