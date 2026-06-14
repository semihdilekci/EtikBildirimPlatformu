import { CaseState, NotificationEventType, TaskType, WorkflowCommand } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import {
  resolveTaskAssignedEventType,
  resolveTransitionSupplementalEvents,
} from '../notification-transition-events.util.js';

describe('notification transition events util', () => {
  it('SUBMIT_TO_MEMBER_APPROVAL → MEMBER_APPROVAL_REQUESTED', () => {
    expect(
      resolveTransitionSupplementalEvents({
        id: 't1',
        command: WorkflowCommand.SUBMIT_TO_MEMBER_APPROVAL,
        fromState: CaseState.AGENDA_READY,
        toState: CaseState.MEMBER_APPROVAL,
        transitionedAt: new Date(),
      }),
    ).toEqual([NotificationEventType.MEMBER_APPROVAL_REQUESTED]);
  });

  it('BOARD_VETO → BOARD_VETO', () => {
    expect(
      resolveTransitionSupplementalEvents({
        id: 't2',
        command: WorkflowCommand.BOARD_VETO,
        fromState: CaseState.BOARD_CHAIR_REVIEW,
        toState: CaseState.AGENDA_READY,
        transitionedAt: new Date(),
      }),
    ).toEqual([NotificationEventType.BOARD_VETO]);
  });

  it('member approval task → DECISION_VOTE_REQUESTED event type', () => {
    expect(resolveTaskAssignedEventType(TaskType.MEMBER_APPROVAL_TASK)).toBe(
      NotificationEventType.DECISION_VOTE_REQUESTED,
    );
  });
});
