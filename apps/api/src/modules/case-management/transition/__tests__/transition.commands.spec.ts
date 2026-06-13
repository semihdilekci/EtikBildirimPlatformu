import { CASE_STATE_VALUES, CaseState, WorkflowCommand } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import {
  collectAllMappedTransitions,
  isValidTransition,
  listTransitionsFromState,
  resolveTransition,
  TRANSITION_MAP,
} from '../transition.commands.js';

describe('TRANSITION_MAP', () => {
  it('tüm map girişleri geçerli CaseState hedef state kullanır', () => {
    const stateSet = new Set<string>(CASE_STATE_VALUES);

    for (const entry of collectAllMappedTransitions()) {
      expect(stateSet.has(entry.fromState)).toBe(true);
      expect(stateSet.has(entry.definition.toState)).toBe(true);
      expect(entry.fromState).not.toBe(CaseState.NOT_ON_AGENDA_CLOSED);
      expect(entry.fromState).not.toBe(CaseState.CLOSED_ARCHIVED);
    }
  });

  it('17 state × 20+ geçiş — minimum geçiş sayısı karşılanır', () => {
    const entries = collectAllMappedTransitions();
    expect(entries.length).toBeGreaterThanOrEqual(20);
  });

  it('terminal statelerden cikis gecisi tanimli degil', () => {
    expect(TRANSITION_MAP[CaseState.NOT_ON_AGENDA_CLOSED]).toBeUndefined();
    expect(TRANSITION_MAP[CaseState.CLOSED_ARCHIVED]).toBeUndefined();
  });

  it('asama 1 gecisleri mapte mevcut', () => {
    expect(
      resolveTransition(CaseState.REPORT_SUBMITTED, WorkflowCommand.ACKNOWLEDGE_REPORT)?.toState,
    ).toBe(CaseState.SECRETARIAT_REVIEW);
    expect(
      resolveTransition(CaseState.SECRETARIAT_REVIEW, WorkflowCommand.START_PRE_RESEARCH)?.toState,
    ).toBe(CaseState.PRE_RESEARCH);
    expect(
      resolveTransition(CaseState.PRE_RESEARCH, WorkflowCommand.SUBMIT_TO_CHAIR_GATE)?.toState,
    ).toBe(CaseState.CHAIR_GATE);
    expect(resolveTransition(CaseState.CHAIR_GATE, WorkflowCommand.APPROVE_AGENDA)?.toState).toBe(
      CaseState.AGENDA_READY,
    );
    expect(
      resolveTransition(CaseState.CHAIR_GATE, WorkflowCommand.CLOSE_NOT_ON_AGENDA)?.toState,
    ).toBe(CaseState.NOT_ON_AGENDA_CLOSED);
  });

  it('chair_gate state inde iki farkli komut desteklenir', () => {
    const commands = listTransitionsFromState(CaseState.CHAIR_GATE);
    expect(commands).toContain(WorkflowCommand.APPROVE_AGENDA);
    expect(commands).toContain(WorkflowCommand.CLOSE_NOT_ON_AGENDA);
    expect(commands).toHaveLength(2);
  });

  it('OPEN_CASE workflow gecis mapinde yer almaz', () => {
    for (const entry of collectAllMappedTransitions()) {
      expect(entry.command).not.toBe(WorkflowCommand.OPEN_CASE);
    }
  });

  it('isValidTransition map dışı komutu reddeder', () => {
    expect(isValidTransition(CaseState.REPORT_SUBMITTED, WorkflowCommand.BOARD_APPROVE)).toBe(
      false,
    );
    expect(isValidTransition(CaseState.CLOSED_ARCHIVED, WorkflowCommand.ACKNOWLEDGE_REPORT)).toBe(
      false,
    );
  });

  it('resolveTransition bilinmeyen kombinasyon için undefined döner', () => {
    expect(resolveTransition(CaseState.AGENDA_READY, WorkflowCommand.BOARD_VETO)).toBeUndefined();
  });

  it('asama 2 gecisleri mapte mevcut', () => {
    expect(
      resolveTransition(CaseState.AGENDA_READY, WorkflowCommand.ASSIGN_RAPPORTEUR)?.toState,
    ).toBe(CaseState.RAPPORTEUR_ASSIGNED);
    expect(
      resolveTransition(CaseState.AGENDA_READY, WorkflowCommand.SUBMIT_TO_MEMBER_APPROVAL)?.toState,
    ).toBe(CaseState.MEMBER_APPROVAL);
    expect(
      resolveTransition(CaseState.RAPPORTEUR_ASSIGNED, WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT)
        ?.toState,
    ).toBe(CaseState.RAPPORTEUR_REPORT_SUBMITTED);
    expect(
      resolveTransition(CaseState.RAPPORTEUR_REPORT_SUBMITTED, WorkflowCommand.RETURN_TO_AGENDA)
        ?.toState,
    ).toBe(CaseState.AGENDA_READY);
    expect(
      resolveTransition(CaseState.MEMBER_APPROVAL, WorkflowCommand.MEMBER_OBJECTION)?.toState,
    ).toBe(CaseState.MEMBER_APPROVAL);
  });

  it('asama 3 gecisleri mapte mevcut', () => {
    expect(
      resolveTransition(CaseState.MEMBER_APPROVAL, WorkflowCommand.CREATE_DECISION_DRAFT)?.toState,
    ).toBe(CaseState.DECISION_DRAFT);
    expect(
      resolveTransition(CaseState.DECISION_DRAFT, WorkflowCommand.SUBMIT_TO_BOARD_REVIEW)?.toState,
    ).toBe(CaseState.BOARD_CHAIR_REVIEW);
    expect(
      resolveTransition(CaseState.BOARD_CHAIR_REVIEW, WorkflowCommand.BOARD_APPROVE)?.toState,
    ).toBe(CaseState.BOARD_APPROVED);
    expect(
      resolveTransition(CaseState.BOARD_CHAIR_REVIEW, WorkflowCommand.BOARD_VETO)?.toState,
    ).toBe(CaseState.AGENDA_READY);
  });

  it('asama 4 gecisleri mapte mevcut', () => {
    expect(
      resolveTransition(CaseState.BOARD_APPROVED, WorkflowCommand.PREPARE_IMPLEMENTATION_LETTER)
        ?.toState,
    ).toBe(CaseState.IMPLEMENTATION_LETTER_PREPARED);
    expect(
      resolveTransition(CaseState.IMPLEMENTATION_LETTER_PREPARED, WorkflowCommand.ASSIGN_ACTION)
        ?.toState,
    ).toBe(CaseState.ACTION_ASSIGNED);
    expect(
      resolveTransition(CaseState.ACTION_ASSIGNED, WorkflowCommand.BEGIN_ACTION_RESPONSE)?.toState,
    ).toBe(CaseState.ACTION_RESPONSE_PENDING);
    expect(
      resolveTransition(CaseState.ACTION_RESPONSE_PENDING, WorkflowCommand.SUBMIT_ACTION_RESPONSE)
        ?.toState,
    ).toBe(CaseState.AGENDA_READY);
    expect(
      resolveTransition(CaseState.AGENDA_READY, WorkflowCommand.SUBMIT_FOLLOW_UP_REVIEW)?.toState,
    ).toBe(CaseState.FOLLOW_UP_DECISION);
    expect(
      resolveTransition(CaseState.FOLLOW_UP_DECISION, WorkflowCommand.FOLLOW_UP_CLOSE)?.toState,
    ).toBe(CaseState.CLOSED_ARCHIVED);
    expect(
      resolveTransition(CaseState.FOLLOW_UP_DECISION, WorkflowCommand.FOLLOW_UP_REASSIGN)?.toState,
    ).toBe(CaseState.ACTION_ASSIGNED);
  });

  it('board_veto ve follow_up_close gerekce zorunlu', () => {
    expect(
      resolveTransition(CaseState.BOARD_CHAIR_REVIEW, WorkflowCommand.BOARD_VETO)?.requiresReason,
    ).toBe(true);
    expect(
      resolveTransition(CaseState.FOLLOW_UP_DECISION, WorkflowCommand.FOLLOW_UP_CLOSE)?.closesCase,
    ).toBe(true);
  });
});
