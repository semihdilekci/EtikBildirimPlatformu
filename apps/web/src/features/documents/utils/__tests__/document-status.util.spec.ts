import { DocumentStatus, MalwareScanStatus } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import {
  getDocumentStatusLabel,
  resolveDocumentDisplayStatus,
} from '@/features/documents/constants/document-status-config';
import { getDocumentErrorMessage } from '@/features/documents/utils/document-error.util';
import { ApiError } from '@/types/api.types';

describe('document-status-config', () => {
  it('should mark quarantined pending scan as scanning', () => {
    expect(
      resolveDocumentDisplayStatus(DocumentStatus.QUARANTINED, MalwareScanStatus.PENDING),
    ).toBe('SCANNING');
    expect(getDocumentStatusLabel('SCANNING')).toBe('Taranıyor');
  });

  it('should mark rejected malware as rejected label', () => {
    expect(resolveDocumentDisplayStatus(DocumentStatus.REJECTED, MalwareScanStatus.REJECTED)).toBe(
      DocumentStatus.REJECTED,
    );
    expect(getDocumentStatusLabel(DocumentStatus.REJECTED)).toContain('Reddedildi');
  });
});

describe('document-error.util', () => {
  it('should map document quarantined error to Turkish message', () => {
    const message = getDocumentErrorMessage(
      new ApiError({
        code: 'DOCUMENT_QUARANTINED',
        message: 'raw',
        requestId: 'req-1',
        status: 422,
      }),
    );

    expect(message).toBe('Dosya henüz taranıyor, indirilemez.');
  });
});
