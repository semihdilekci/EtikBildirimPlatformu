import { CaseField, FieldVisibility } from '@ethics/policy';
import { ErrorCode, Role, type Role as RoleCode } from '@ethics/shared';
import { HttpStatus } from '@nestjs/common';

import { DomainException } from '../../../common/exceptions/domain.exception.js';
import type { FieldVisibilityLevel } from '@ethics/dto';

const ADMIN_CONTENT_FIELDS = new Set<string>(
  Object.values(CaseField).filter((field) => field !== CaseField.CASE_METADATA),
);

export function assertAdminFieldVisibilityAllowed(
  roleCode: RoleCode,
  fieldName: string,
  visibility: FieldVisibilityLevel,
): void {
  if (roleCode !== Role.ADMIN) {
    return;
  }

  if (fieldName === CaseField.CASE_METADATA) {
    if (visibility === FieldVisibility.VISIBLE || visibility === FieldVisibility.OWN_ONLY) {
      throw new DomainException(
        ErrorCode.ADMIN_FIELD_VISIBILITY_ADMIN_PROTECTED,
        'Admin rolü case_metadata alanında yalnızca metadata_only veya hidden olabilir.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return;
  }

  if (ADMIN_CONTENT_FIELDS.has(fieldName) && visibility !== FieldVisibility.HIDDEN) {
    throw new DomainException(
      ErrorCode.ADMIN_FIELD_VISIBILITY_ADMIN_PROTECTED,
      'Admin rolü içerik alanlarını göremez — yalnızca hidden olabilir.',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export function isVisibilityVisible(visibility: FieldVisibilityLevel): boolean {
  return visibility === FieldVisibility.VISIBLE || visibility === FieldVisibility.METADATA_ONLY;
}
