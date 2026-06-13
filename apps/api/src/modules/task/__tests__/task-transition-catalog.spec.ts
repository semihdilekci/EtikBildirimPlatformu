import { CaseState, Role, TaskType, WorkflowCommand } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import { resolveTasksForTransition } from '../task-transition-catalog.js';

describe('resolveTasksForTransition', () => {
  const baseCase = {
    id: 'case-1',
    companyId: 'company-1',
    assignedRapporteurId: 'rapporteur-1',
    assignedActionOwnerId: 'owner-1',
  };

  it('secretariat_review geçişinde secretariat_review_task üretir', () => {
    const tasks = resolveTasksForTransition(baseCase as never, {
      id: 'tr-1',
      fromState: CaseState.REPORT_SUBMITTED,
      toState: CaseState.SECRETARIAT_REVIEW,
      command: WorkflowCommand.ACKNOWLEDGE_REPORT,
      transitionedAt: new Date(),
    });

    expect(tasks).toEqual([
      {
        taskType: TaskType.SECRETARIAT_REVIEW_TASK,
        assignedRole: Role.COUNCIL_SECRETARY,
      },
    ]);
  });

  it('rapporteur_assigned geçişinde atanan raportörü bağlar', () => {
    const tasks = resolveTasksForTransition(baseCase as never, {
      id: 'tr-2',
      fromState: CaseState.AGENDA_READY,
      toState: CaseState.RAPPORTEUR_ASSIGNED,
      command: WorkflowCommand.ASSIGN_RAPPORTEUR,
      transitionedAt: new Date(),
    });

    expect(tasks).toEqual([
      {
        taskType: TaskType.RAPPORTEUR_REPORT_TASK,
        assignedRole: Role.RAPPORTEUR,
        assignedUserId: 'rapporteur-1',
      },
    ]);
  });

  it('approve_agenda sonrası agenda_ready için görev oluşturmaz', () => {
    const tasks = resolveTasksForTransition(baseCase as never, {
      id: 'tr-3',
      fromState: CaseState.CHAIR_GATE,
      toState: CaseState.AGENDA_READY,
      command: WorkflowCommand.APPROVE_AGENDA,
      transitionedAt: new Date(),
    });

    expect(tasks).toEqual([]);
  });

  it('board_veto sonrası agenda_ready için rapporteur_assign_task üretir', () => {
    const tasks = resolveTasksForTransition(baseCase as never, {
      id: 'tr-4',
      fromState: CaseState.BOARD_CHAIR_REVIEW,
      toState: CaseState.AGENDA_READY,
      command: WorkflowCommand.BOARD_VETO,
      transitionedAt: new Date(),
    });

    expect(tasks).toEqual([
      {
        taskType: TaskType.RAPPORTEUR_ASSIGN_TASK,
        assignedRole: Role.COUNCIL_SECRETARY,
      },
    ]);
  });
});
