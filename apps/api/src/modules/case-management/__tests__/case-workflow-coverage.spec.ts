import {
  CaseState,
  ClearanceLevel,
  Role,
  WorkflowCommand,
  type CaseStateCode,
} from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { CaseAvailableActionsService } from '../case-available-actions.service.js';
import { listTransitionsFromState } from '../transition/transition.commands.js';

const service = new CaseAvailableActionsService();

const baseUser = (roles: Role[], id = 'user-1'): AuthenticatedUser => ({
  id,
  email: 'user@ethics.local',
  displayName: 'User',
  roles,
  clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
  companyId: null,
  companyName: null,
  functionId: null,
  locationId: null,
  isGeneralSecretary: false,
});

describe('CaseAvailableActionsService — ek senaryolar', () => {
  it('board_chair board_chair_review için onay/veto komutlarını döner', () => {
    const actions = service.resolve(baseUser([Role.BOARD_CHAIR], 'board-chair-1'), {
      currentState: CaseState.BOARD_CHAIR_REVIEW,
      confidentialityLevel: ClearanceLevel.SENSITIVE,
      assignedRapporteurId: null,
      assignedActionOwnerId: null,
    });

    expect(actions).toContain(WorkflowCommand.BOARD_APPROVE);
    expect(actions).toContain(WorkflowCommand.BOARD_VETO);
  });

  it('action_owner atanmis vakada submit_action_response döner', () => {
    const ownerId = 'owner-actions-1';
    const actions = service.resolve(baseUser([Role.ACTION_OWNER], ownerId), {
      currentState: CaseState.ACTION_RESPONSE_PENDING,
      confidentialityLevel: ClearanceLevel.SENSITIVE,
      assignedRapporteurId: null,
      assignedActionOwnerId: ownerId,
    });

    expect(actions).toContain(WorkflowCommand.SUBMIT_ACTION_RESPONSE);
  });

  it('system komutları availableActions listesine dahil edilmez', () => {
    const actions = service.resolve(baseUser([Role.COUNCIL_SECRETARY]), {
      currentState: CaseState.ACTION_ASSIGNED,
      confidentialityLevel: ClearanceLevel.SENSITIVE,
      assignedRapporteurId: null,
      assignedActionOwnerId: null,
    });

    expect(actions).not.toContain(WorkflowCommand.BEGIN_ACTION_RESPONSE);
  });
});

describe('transition.commands — yardımcılar', () => {
  it('listTransitionsFromState terminal state için boş dizi döner', () => {
    expect(listTransitionsFromState(CaseState.CLOSED_ARCHIVED)).toEqual([]);
    expect(listTransitionsFromState(CaseState.NOT_ON_AGENDA_CLOSED)).toEqual([]);
  });

  it('listTransitionsFromState bilinmeyen state için boş dizi döner', () => {
    expect(listTransitionsFromState('invalid_state' as CaseStateCode)).toEqual([]);
  });
});
