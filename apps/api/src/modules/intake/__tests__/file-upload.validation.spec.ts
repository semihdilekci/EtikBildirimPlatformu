import { ErrorCode } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import { DomainException } from '../../../common/exceptions/domain.exception.js';
import {
  assertAllowedUploadMetadata,
  assertTotalAttachmentSize,
  extractFileExtension,
} from '../file-upload.validation.js';

function expectDomainCode(fn: () => void, code: string): void {
  try {
    fn();
    expect.unreachable('Expected DomainException');
  } catch (error) {
    expect(error).toBeInstanceOf(DomainException);
    expect((error as DomainException).code).toBe(code);
  }
}

describe('file-upload.validation', () => {
  it('extractFileExtension dosya uzantısını küçük harfe çevirir', () => {
    expect(extractFileExtension('kanit.PDF')).toBe('pdf');
  });

  it('assertAllowedUploadMetadata izinli PDF + MIME kabul eder', () => {
    expect(() =>
      assertAllowedUploadMetadata({
        originalFilename: 'kanit.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        contentSha256: 'a'.repeat(64),
      }),
    ).not.toThrow();
  });

  it('assertAllowedUploadMetadata izin verilmeyen uzantıda DOCUMENT_TYPE_NOT_ALLOWED fırlatır', () => {
    expectDomainCode(
      () =>
        assertAllowedUploadMetadata({
          originalFilename: 'malware.exe',
          mimeType: 'application/octet-stream',
          sizeBytes: 1024,
          contentSha256: 'a'.repeat(64),
        }),
      ErrorCode.DOCUMENT_TYPE_NOT_ALLOWED,
    );
  });

  it('assertTotalAttachmentSize toplam limit aşımında DOCUMENT_SIZE_EXCEEDED fırlatır', () => {
    expectDomainCode(
      () => assertTotalAttachmentSize(199n * 1024n * 1024n, 2 * 1024 * 1024),
      ErrorCode.DOCUMENT_SIZE_EXCEEDED,
    );
  });
});
