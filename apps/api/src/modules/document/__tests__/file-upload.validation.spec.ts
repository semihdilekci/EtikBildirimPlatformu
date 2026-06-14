import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import { DomainException } from '../../../common/exceptions/domain.exception.js';
import {
  assertTotalCaseDocumentSize,
  buildCaseDocumentStorageKey,
} from '../file-upload.validation.js';

describe('buildCaseDocumentStorageKey', () => {
  it('quarantine path formatını üretir', () => {
    expect(buildCaseDocumentStorageKey('case-1', 'doc-1', 2)).toBe(
      'quarantine/cases/case-1/doc-1/v2',
    );
  });
});

describe('assertTotalCaseDocumentSize', () => {
  it('toplam limit aşıldığında DOCUMENT_SIZE_EXCEEDED fırlatır', () => {
    expect(() => assertTotalCaseDocumentSize(BigInt(200 * 1024 * 1024 - 10), 20)).toThrow(
      DomainException,
    );

    try {
      assertTotalCaseDocumentSize(BigInt(200 * 1024 * 1024 - 10), 20);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainException);
      expect((error as DomainException).code).toBe(ErrorCode.DOCUMENT_SIZE_EXCEEDED);
      expect((error as DomainException).getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    }
  });
});
