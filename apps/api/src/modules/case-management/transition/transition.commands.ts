import { CaseState, Role, WorkflowCommand } from '@ethics/shared';
import type { CaseStateCode, WorkflowCommandCode } from '@ethics/shared';

import type { TransitionDefinition, TransitionMap } from './transition.types.js';

/**
 * Explicit allowed-transitions map — map dışı geçiş → CASE_INVALID_TRANSITION.
 * OPEN_CASE vaka açılış kaydıdır; state machine geçişi değildir.
 */
export const TRANSITION_MAP: TransitionMap = {
  [CaseState.REPORT_SUBMITTED]: {
    [WorkflowCommand.ACKNOWLEDGE_REPORT]: {
      toState: CaseState.SECRETARIAT_REVIEW,
      requiredRoles: [Role.COUNCIL_SECRETARY],
    },
  },
  [CaseState.SECRETARIAT_REVIEW]: {
    [WorkflowCommand.START_PRE_RESEARCH]: {
      toState: CaseState.PRE_RESEARCH,
      requiredRoles: [Role.COUNCIL_SECRETARY],
    },
  },
  [CaseState.PRE_RESEARCH]: {
    [WorkflowCommand.SUBMIT_TO_CHAIR_GATE]: {
      toState: CaseState.CHAIR_GATE,
      requiredRoles: [Role.COUNCIL_SECRETARY],
    },
  },
  [CaseState.CHAIR_GATE]: {
    [WorkflowCommand.APPROVE_AGENDA]: {
      toState: CaseState.AGENDA_READY,
      requiredRoles: [Role.COUNCIL_CHAIR],
    },
    [WorkflowCommand.CLOSE_NOT_ON_AGENDA]: {
      toState: CaseState.NOT_ON_AGENDA_CLOSED,
      requiredRoles: [Role.COUNCIL_CHAIR],
      requiresReason: true,
      closesCase: true,
    },
  },
  [CaseState.AGENDA_READY]: {
    [WorkflowCommand.ASSIGN_RAPPORTEUR]: {
      toState: CaseState.RAPPORTEUR_ASSIGNED,
      requiredRoles: [Role.COUNCIL_SECRETARY],
    },
    [WorkflowCommand.SUBMIT_TO_MEMBER_APPROVAL]: {
      toState: CaseState.MEMBER_APPROVAL,
      requiredRoles: [Role.COUNCIL_SECRETARY],
    },
    [WorkflowCommand.SUBMIT_FOLLOW_UP_REVIEW]: {
      toState: CaseState.FOLLOW_UP_DECISION,
      requiredRoles: [Role.COUNCIL_SECRETARY],
    },
  },
  [CaseState.RAPPORTEUR_ASSIGNED]: {
    [WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT]: {
      toState: CaseState.RAPPORTEUR_REPORT_SUBMITTED,
      requiresAssignment: 'rapporteur',
    },
  },
  [CaseState.RAPPORTEUR_REPORT_SUBMITTED]: {
    [WorkflowCommand.RETURN_TO_AGENDA]: {
      toState: CaseState.AGENDA_READY,
      requiredRoles: [Role.COUNCIL_SECRETARY],
    },
  },
  [CaseState.MEMBER_APPROVAL]: {
    [WorkflowCommand.CREATE_DECISION_DRAFT]: {
      toState: CaseState.DECISION_DRAFT,
      requiredRoles: [Role.COUNCIL_SECRETARY],
    },
    [WorkflowCommand.MEMBER_OBJECTION]: {
      toState: CaseState.MEMBER_APPROVAL,
      requiredRoles: [Role.COUNCIL_MEMBER],
    },
  },
  [CaseState.DECISION_DRAFT]: {
    [WorkflowCommand.SUBMIT_TO_BOARD_REVIEW]: {
      toState: CaseState.BOARD_CHAIR_REVIEW,
      requiredRoles: [Role.COUNCIL_SECRETARY],
    },
  },
  [CaseState.BOARD_CHAIR_REVIEW]: {
    [WorkflowCommand.BOARD_APPROVE]: {
      toState: CaseState.BOARD_APPROVED,
      requiredRoles: [Role.BOARD_CHAIR],
    },
    [WorkflowCommand.BOARD_VETO]: {
      toState: CaseState.AGENDA_READY,
      requiredRoles: [Role.BOARD_CHAIR],
      requiresReason: true,
    },
  },
  [CaseState.BOARD_APPROVED]: {
    [WorkflowCommand.PREPARE_IMPLEMENTATION_LETTER]: {
      toState: CaseState.IMPLEMENTATION_LETTER_PREPARED,
      requiredRoles: [Role.COUNCIL_SECRETARY],
    },
  },
  [CaseState.IMPLEMENTATION_LETTER_PREPARED]: {
    [WorkflowCommand.ASSIGN_ACTION]: {
      toState: CaseState.ACTION_ASSIGNED,
      requiredRoles: [Role.COUNCIL_SECRETARY],
    },
  },
  [CaseState.ACTION_ASSIGNED]: {
    [WorkflowCommand.BEGIN_ACTION_RESPONSE]: {
      toState: CaseState.ACTION_RESPONSE_PENDING,
      isSystemCommand: true,
    },
  },
  [CaseState.ACTION_RESPONSE_PENDING]: {
    [WorkflowCommand.SUBMIT_ACTION_RESPONSE]: {
      toState: CaseState.AGENDA_READY,
      requiresAssignment: 'action_owner',
    },
  },
  [CaseState.FOLLOW_UP_DECISION]: {
    [WorkflowCommand.FOLLOW_UP_CLOSE]: {
      toState: CaseState.CLOSED_ARCHIVED,
      requiredRoles: [Role.COUNCIL_SECRETARY],
      closesCase: true,
    },
    [WorkflowCommand.FOLLOW_UP_REASSIGN]: {
      toState: CaseState.ACTION_ASSIGNED,
      requiredRoles: [Role.COUNCIL_SECRETARY],
    },
  },
};

export function resolveTransition(
  fromState: CaseStateCode,
  command: WorkflowCommandCode,
): TransitionDefinition | undefined {
  return TRANSITION_MAP[fromState]?.[command];
}

export function isValidTransition(fromState: CaseStateCode, command: WorkflowCommandCode): boolean {
  return resolveTransition(fromState, command) !== undefined;
}

export function listTransitionsFromState(fromState: CaseStateCode): WorkflowCommandCode[] {
  const commands = TRANSITION_MAP[fromState];
  if (!commands) {
    return [];
  }

  return Object.keys(commands) as WorkflowCommandCode[];
}

export function collectAllMappedTransitions(): Array<{
  fromState: CaseStateCode;
  command: WorkflowCommandCode;
  definition: TransitionDefinition;
}> {
  const entries: Array<{
    fromState: CaseStateCode;
    command: WorkflowCommandCode;
    definition: TransitionDefinition;
  }> = [];

  for (const fromState of Object.keys(TRANSITION_MAP) as CaseStateCode[]) {
    const stateCommands = TRANSITION_MAP[fromState];
    if (stateCommands === undefined) {
      continue;
    }

    for (const command of Object.keys(stateCommands) as WorkflowCommandCode[]) {
      const definition = stateCommands[command];
      if (definition === undefined) {
        continue;
      }

      entries.push({
        fromState,
        command,
        definition,
      });
    }
  }

  return entries;
}
