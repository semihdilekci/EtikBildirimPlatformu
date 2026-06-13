import type { ClearanceLevel } from '@ethics/shared';
import { ErrorCode } from '@ethics/shared';
import { isClearanceSufficient, rolesHavePermission, type PermissionCode } from '@ethics/policy';
import { HttpStatus, Injectable } from '@nestjs/common';

import { DomainException } from '../common/exceptions/domain.exception.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type.js';

export type PolicyEvaluationContext = {
  /** Kaynak gizlilik seviyesi — clearance hierarchy kontrolü (Faz 2 RBAC+ clearance) */
  resourceClearanceLevel?: ClearanceLevel;
  /** Bilgi sızıntısı riski: kaynak var ama erişim yok → 404 */
  maskAsNotFound?: boolean;
};

export type PolicyEvaluationResult =
  | { allowed: true }
  | { allowed: false; reason: 'rbac_denied' | 'clearance_denied' };

@Injectable()
export class PolicyGuardService {
  evaluate(
    user: AuthenticatedUser,
    permission: PermissionCode,
    context: PolicyEvaluationContext = {},
  ): PolicyEvaluationResult {
    if (user.roles.length === 0 || !rolesHavePermission(user.roles, permission)) {
      return { allowed: false, reason: 'rbac_denied' };
    }

    if (
      context.resourceClearanceLevel !== undefined &&
      !isClearanceSufficient(user.clearanceLevel, context.resourceClearanceLevel)
    ) {
      return { allowed: false, reason: 'clearance_denied' };
    }

    return { allowed: true };
  }

  assertAllowed(
    user: AuthenticatedUser,
    permission: PermissionCode,
    context: PolicyEvaluationContext = {},
  ): void {
    const result = this.evaluate(user, permission, context);

    if (result.allowed) {
      return;
    }

    if (context.maskAsNotFound) {
      throw new DomainException(
        ErrorCode.AUTHZ_NOT_FOUND,
        'Kaynak bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    throw new DomainException(
      ErrorCode.AUTHZ_FORBIDDEN,
      'Bu işlem için yetkiniz yok.',
      HttpStatus.FORBIDDEN,
    );
  }
}
