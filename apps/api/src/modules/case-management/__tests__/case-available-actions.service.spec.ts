import { CaseState, ClearanceLevel, Role, WorkflowCommand } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { CaseAvailableActionsService } from '../case-available-actions.service.js';

const service = new CaseAvailableActionsService();

const secretaryUser: AuthenticatedUser = {
  id: 'secretary-1',
  email: 'secretary@ethics.local',
  displayName: 'Secretary',
  roles: [Role.COUNCIL_SECRETARY],
  clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
  companyId: null,
  companyName: null,
  functionId: null,
  locationId: null,
  isGeneralSecretary: false,
};

const chairUser: AuthenticatedUser = {
  ...secretaryUser,
  id: 'chair-1',
  roles: [Role.COUNCIL_CHAIR],
};

const rapporteurUser: AuthenticatedUser = {
  ...secretaryUser,
  id: 'rapporteur-1',
  roles: [Role.RAPPORTEUR],
};

describe('CaseAvailableActionsService', () => {
  it('council_secretary report_submitted için acknowledge_report döner', () => {
    const actions = service.resolve(secretaryUser, {
      currentState: CaseState.REPORT_SUBMITTED,
      confidentialityLevel: ClearanceLevel.SENSITIVE,
      assignedRapporteurId: null,
      assignedActionOwnerId: null,
    });

    expect(actions).toContain(WorkflowCommand.ACKNOWLEDGE_REPORT);
  });

  it('council_chair chair_gate için gündem komutlarını döner', () => {
    const actions = service.resolve(chairUser, {
      currentState: CaseState.CHAIR_GATE,
      confidentialityLevel: ClearanceLevel.SENSITIVE,
      assignedRapporteurId: null,
      assignedActionOwnerId: null,
    });

    expect(actions).toContain(WorkflowCommand.APPROVE_AGENDA);
    expect(actions).toContain(WorkflowCommand.CLOSE_NOT_ON_AGENDA);
  });

  it('clearance yetersiz → boş liste', () => {
    const actions = service.resolve(
      { ...secretaryUser, clearanceLevel: ClearanceLevel.NORMAL },
      {
        currentState: CaseState.REPORT_SUBMITTED,
        confidentialityLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        assignedRapporteurId: null,
        assignedActionOwnerId: null,
      },
    );

    expect(actions).toEqual([]);
  });

  it('atanmamis raportor submit_rapporteur_report görmez', () => {
    const actions = service.resolve(rapporteurUser, {
      currentState: CaseState.RAPPORTEUR_ASSIGNED,
      confidentialityLevel: ClearanceLevel.SENSITIVE,
      assignedRapporteurId: 'other-rapporteur',
      assignedActionOwnerId: null,
    });

    expect(actions).not.toContain(WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT);
  });

  it('atanmis raportor submit_rapporteur_report görür', () => {
    const actions = service.resolve(rapporteurUser, {
      currentState: CaseState.RAPPORTEUR_ASSIGNED,
      confidentialityLevel: ClearanceLevel.SENSITIVE,
      assignedRapporteurId: rapporteurUser.id,
      assignedActionOwnerId: null,
    });

    expect(actions).toContain(WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT);
  });

  it('CASE_TRANSITION izni olmayan rol → boş liste', () => {
    const actions = service.resolve(
      {
        ...secretaryUser,
        roles: [Role.ADMIN],
      },
      {
        currentState: CaseState.REPORT_SUBMITTED,
        confidentialityLevel: ClearanceLevel.SENSITIVE,
        assignedRapporteurId: null,
        assignedActionOwnerId: null,
      },
    );

    expect(actions).toEqual([]);
  });
});
