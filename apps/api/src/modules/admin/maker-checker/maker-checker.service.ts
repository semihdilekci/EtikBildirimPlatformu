import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode, Role, type AdminActionCodeValue, type Role as RoleCode } from '@ethics/shared';

import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import { resolveRoleAssignmentActionCode } from './default-action-matrix.js';
import { ActionMatrixConfigService } from './action-matrix-config.service.js';

@Injectable()
export class MakerCheckerService {
  constructor(
    @Inject(ActionMatrixConfigService)
    private readonly actionMatrixConfig: ActionMatrixConfigService,
  ) {}

  resolveRoleAssignmentAction(roleCode: RoleCode): AdminActionCodeValue {
    return resolveRoleAssignmentActionCode(roleCode);
  }

  assertMaker(actor: AuthenticatedUser, actionCode: AdminActionCodeValue): void {
    const { makerRole } = this.actionMatrixConfig.getEntry(actionCode);

    if (actor.roles.includes(makerRole)) {
      return;
    }

    throw new DomainException(
      ErrorCode.AUTHZ_FORBIDDEN,
      'Bu işlem için maker yetkiniz yok.',
      HttpStatus.FORBIDDEN,
    );
  }

  /** Admin veya action matrix maker rolü — clearance/rol talebi başlatma */
  assertMakerOrAdmin(actor: AuthenticatedUser, actionCode: AdminActionCodeValue): void {
    const { makerRole } = this.actionMatrixConfig.getEntry(actionCode);

    if (actor.roles.includes(Role.ADMIN) || actor.roles.includes(makerRole)) {
      return;
    }

    throw new DomainException(
      ErrorCode.AUTHZ_FORBIDDEN,
      'Bu işlem için maker yetkiniz yok.',
      HttpStatus.FORBIDDEN,
    );
  }

  assertChecker(
    checker: AuthenticatedUser,
    makerUserId: string,
    actionCode: AdminActionCodeValue,
  ): void {
    if (checker.id === makerUserId) {
      throw new DomainException(
        ErrorCode.MAKER_CHECKER_SELF,
        'Kendi işleminizi onaylayamazsınız.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const { checkerRole } = this.actionMatrixConfig.getEntry(actionCode);

    if (!checker.roles.includes(checkerRole)) {
      throw new DomainException(
        ErrorCode.MAKER_CHECKER_FORBIDDEN,
        'Bu işlem için checker yetkiniz yok.',
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
