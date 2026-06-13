import { ErrorCode } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import { ApiError } from '@/types/api.types';
import {
  getCaseErrorMessage,
  isCaseForbiddenError,
  isCaseInvalidTransitionError,
  isCaseOptimisticLockError,
} from '@/features/cases/utils/case-error.util';

describe('case-error.util', () => {
  it('maps CASE_INVALID_TRANSITION to Turkish message', () => {
    const error = new ApiError({
      code: ErrorCode.CASE_INVALID_TRANSITION,
      message: 'raw',
      requestId: 'req-1',
      status: 409,
    });

    expect(getCaseErrorMessage(error)).toBe('Bu işlem vakanın mevcut durumunda yapılamaz.');
    expect(isCaseInvalidTransitionError(error)).toBe(true);
  });

  it('detects optimistic lock errors', () => {
    const error = new ApiError({
      code: ErrorCode.CASE_OPTIMISTIC_LOCK,
      message: 'raw',
      requestId: 'req-2',
      status: 409,
    });

    expect(isCaseOptimisticLockError(error)).toBe(true);
  });

  it('detects forbidden errors', () => {
    const error = new ApiError({
      code: ErrorCode.AUTHZ_FORBIDDEN,
      message: 'raw',
      requestId: 'req-3',
      status: 403,
    });

    expect(isCaseForbiddenError(error)).toBe(true);
  });
});
