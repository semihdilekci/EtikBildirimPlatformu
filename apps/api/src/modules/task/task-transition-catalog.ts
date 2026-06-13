import {
  CaseState,
  Role,
  TaskType,
  WorkflowCommand,
  type CaseStateCode,
  type Role as RoleCode,
  type TaskTypeCode,
  type WorkflowCommandCode,
} from '@ethics/shared';
import type { Case } from '@prisma/client';

import type { CreatedTransitionRecord } from '../case-management/transition/transition.types.js';

export interface TaskCreationDefinition {
  taskType: TaskTypeCode;
  assignedRole: RoleCode;
  assignedUserId?: string | null;
  assignedCompanyId?: string | null;
  assignedFunctionId?: string | null;
}

const STATE_TASK_MAP: Partial<Record<CaseStateCode, TaskCreationDefinition>> = {
  [CaseState.SECRETARIAT_REVIEW]: {
    taskType: TaskType.SECRETARIAT_REVIEW_TASK,
    assignedRole: Role.COUNCIL_SECRETARY,
  },
  [CaseState.PRE_RESEARCH]: {
    taskType: TaskType.PRE_RESEARCH_TASK,
    assignedRole: Role.COUNCIL_SECRETARY,
  },
  [CaseState.CHAIR_GATE]: {
    taskType: TaskType.CHAIR_GATE_TASK,
    assignedRole: Role.COUNCIL_CHAIR,
  },
  [CaseState.RAPPORTEUR_ASSIGNED]: {
    taskType: TaskType.RAPPORTEUR_REPORT_TASK,
    assignedRole: Role.RAPPORTEUR,
  },
  [CaseState.MEMBER_APPROVAL]: {
    taskType: TaskType.MEMBER_APPROVAL_TASK,
    assignedRole: Role.COUNCIL_MEMBER,
  },
  [CaseState.DECISION_DRAFT]: {
    taskType: TaskType.DECISION_DRAFT_TASK,
    assignedRole: Role.COUNCIL_SECRETARY,
  },
  [CaseState.BOARD_CHAIR_REVIEW]: {
    taskType: TaskType.BOARD_REVIEW_TASK,
    assignedRole: Role.BOARD_CHAIR,
  },
  [CaseState.BOARD_APPROVED]: {
    taskType: TaskType.IMPLEMENTATION_LETTER_TASK,
    assignedRole: Role.COUNCIL_SECRETARY,
  },
  [CaseState.ACTION_ASSIGNED]: {
    taskType: TaskType.ACTION_RESPONSE_TASK,
    assignedRole: Role.ACTION_OWNER,
  },
  [CaseState.FOLLOW_UP_DECISION]: {
    taskType: TaskType.FOLLOW_UP_REVIEW_TASK,
    assignedRole: Role.COUNCIL_SECRETARY,
  },
};

function enrichAssignment(
  definition: TaskCreationDefinition,
  caseEntity: Case,
): TaskCreationDefinition {
  if (definition.taskType === TaskType.RAPPORTEUR_REPORT_TASK) {
    return {
      ...definition,
      assignedUserId: caseEntity.assignedRapporteurId,
    };
  }

  if (definition.taskType === TaskType.ACTION_RESPONSE_TASK) {
    return {
      ...definition,
      assignedUserId: caseEntity.assignedActionOwnerId,
      assignedCompanyId: caseEntity.companyId,
    };
  }

  return definition;
}

export function resolveTasksForTransition(
  caseEntity: Case,
  transition: CreatedTransitionRecord,
): TaskCreationDefinition[] {
  const toState = transition.toState as CaseStateCode;
  const command = transition.command as WorkflowCommandCode;

  if (toState === CaseState.AGENDA_READY) {
    if (command === WorkflowCommand.RETURN_TO_AGENDA || command === WorkflowCommand.BOARD_VETO) {
      return [
        {
          taskType: TaskType.RAPPORTEUR_ASSIGN_TASK,
          assignedRole: Role.COUNCIL_SECRETARY,
        },
      ];
    }

    return [];
  }

  const baseDefinition = STATE_TASK_MAP[toState];
  if (!baseDefinition) {
    return [];
  }

  return [enrichAssignment(baseDefinition, caseEntity)];
}
