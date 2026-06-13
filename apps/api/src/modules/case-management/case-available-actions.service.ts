import { Injectable } from '@nestjs/common';
import type { CaseStateCode, ClearanceLevel, WorkflowCommandCode } from '@ethics/shared';
import { Role, WorkflowCommand } from '@ethics/shared';
import { isClearanceSufficient, rolesHavePermission, PermissionCode } from '@ethics/policy';

import type { AuthenticatedUser } from '../../common/types/authenticated-user.type.js';
import { listTransitionsFromState, resolveTransition } from './transition/transition.commands.js';

type CaseActionContext = {
  currentState: CaseStateCode;
  confidentialityLevel: ClearanceLevel;
  assignedRapporteurId: string | null;
  assignedActionOwnerId: string | null;
};

@Injectable()
export class CaseAvailableActionsService {
  resolve(user: AuthenticatedUser, caseEntity: CaseActionContext): WorkflowCommandCode[] {
    if (!rolesHavePermission(user.roles, PermissionCode.CASE_TRANSITION)) {
      return [];
    }

    const commands = listTransitionsFromState(caseEntity.currentState);
    const available: WorkflowCommandCode[] = [];

    for (const command of commands) {
      if (command === WorkflowCommand.OPEN_CASE) {
        continue;
      }

      const definition = resolveTransition(caseEntity.currentState, command);
      if (!definition || definition.isSystemCommand) {
        continue;
      }

      if (!isClearanceSufficient(user.clearanceLevel, caseEntity.confidentialityLevel)) {
        continue;
      }

      if (definition.requiredRoles?.length) {
        const hasRole = definition.requiredRoles.some((role) => user.roles.includes(role));
        if (!hasRole) {
          continue;
        }
      }

      if (definition.requiresAssignment === 'rapporteur') {
        if (caseEntity.assignedRapporteurId !== user.id) {
          continue;
        }
      }

      if (definition.requiresAssignment === 'action_owner') {
        if (caseEntity.assignedActionOwnerId !== user.id) {
          continue;
        }
      }

      if (!this.hasCommandPermission(user, command)) {
        continue;
      }

      available.push(command);
    }

    return available;
  }

  private hasCommandPermission(user: AuthenticatedUser, command: WorkflowCommandCode): boolean {
    switch (command) {
      case WorkflowCommand.APPROVE_AGENDA:
      case WorkflowCommand.CLOSE_NOT_ON_AGENDA:
        return (
          rolesHavePermission(user.roles, PermissionCode.CASE_SET_AGENDA) ||
          user.roles.includes(Role.COUNCIL_CHAIR)
        );
      case WorkflowCommand.ASSIGN_RAPPORTEUR:
        return rolesHavePermission(user.roles, PermissionCode.CASE_ASSIGN_RAPPORTEUR);
      case WorkflowCommand.MEMBER_OBJECTION:
        return rolesHavePermission(user.roles, PermissionCode.COUNCIL_VOTE_DECISION);
      case WorkflowCommand.BOARD_APPROVE:
      case WorkflowCommand.BOARD_VETO:
        return rolesHavePermission(user.roles, PermissionCode.BOARD_APPROVE_OR_VETO);
      case WorkflowCommand.SUBMIT_ACTION_RESPONSE:
        return rolesHavePermission(user.roles, PermissionCode.ACTION_RESPOND);
      default:
        return rolesHavePermission(user.roles, PermissionCode.CASE_TRANSITION);
    }
  }
}
