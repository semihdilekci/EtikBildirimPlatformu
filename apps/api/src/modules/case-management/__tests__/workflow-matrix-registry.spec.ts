import { CaseState, WorkflowCommand } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import { collectAllMappedTransitions } from '../transition/transition.commands.js';

/**
 * Pozitif integration testleri stage dosyalarında doğrulanır.
 * Registry, map ile test kapsamı arasında drift olmaması için tutulur.
 */
export const WORKFLOW_POSITIVE_TRANSITION_COVERAGE: ReadonlyArray<{
  fromState: string;
  command: string;
}> = [
  { fromState: CaseState.REPORT_SUBMITTED, command: WorkflowCommand.ACKNOWLEDGE_REPORT },
  { fromState: CaseState.SECRETARIAT_REVIEW, command: WorkflowCommand.START_PRE_RESEARCH },
  { fromState: CaseState.PRE_RESEARCH, command: WorkflowCommand.SUBMIT_TO_CHAIR_GATE },
  { fromState: CaseState.CHAIR_GATE, command: WorkflowCommand.APPROVE_AGENDA },
  { fromState: CaseState.CHAIR_GATE, command: WorkflowCommand.CLOSE_NOT_ON_AGENDA },
  { fromState: CaseState.AGENDA_READY, command: WorkflowCommand.ASSIGN_RAPPORTEUR },
  { fromState: CaseState.AGENDA_READY, command: WorkflowCommand.SUBMIT_TO_MEMBER_APPROVAL },
  { fromState: CaseState.AGENDA_READY, command: WorkflowCommand.SUBMIT_FOLLOW_UP_REVIEW },
  { fromState: CaseState.RAPPORTEUR_ASSIGNED, command: WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT },
  { fromState: CaseState.RAPPORTEUR_REPORT_SUBMITTED, command: WorkflowCommand.RETURN_TO_AGENDA },
  { fromState: CaseState.MEMBER_APPROVAL, command: WorkflowCommand.MEMBER_OBJECTION },
  { fromState: CaseState.MEMBER_APPROVAL, command: WorkflowCommand.CREATE_DECISION_DRAFT },
  { fromState: CaseState.DECISION_DRAFT, command: WorkflowCommand.SUBMIT_TO_BOARD_REVIEW },
  { fromState: CaseState.BOARD_CHAIR_REVIEW, command: WorkflowCommand.BOARD_APPROVE },
  { fromState: CaseState.BOARD_CHAIR_REVIEW, command: WorkflowCommand.BOARD_VETO },
  { fromState: CaseState.BOARD_APPROVED, command: WorkflowCommand.PREPARE_IMPLEMENTATION_LETTER },
  { fromState: CaseState.IMPLEMENTATION_LETTER_PREPARED, command: WorkflowCommand.ASSIGN_ACTION },
  { fromState: CaseState.ACTION_ASSIGNED, command: WorkflowCommand.BEGIN_ACTION_RESPONSE },
  { fromState: CaseState.ACTION_RESPONSE_PENDING, command: WorkflowCommand.SUBMIT_ACTION_RESPONSE },
  { fromState: CaseState.FOLLOW_UP_DECISION, command: WorkflowCommand.FOLLOW_UP_CLOSE },
  { fromState: CaseState.FOLLOW_UP_DECISION, command: WorkflowCommand.FOLLOW_UP_REASSIGN },
];

/** Docs/08 §4 — her geçiş matrisi için minimum 8 senaryo tipi */
export const WORKFLOW_MATRIX_SCENARIO_TYPES = [
  'positive',
  'wrongRole',
  'wrongState',
  'clearance',
  'assignment',
  'idempotency',
  'sideEffect',
  'precondition',
] as const;

describe('Workflow transition matrix registry', () => {
  it('TRANSITION_MAP tüm pozitif registry girişlerini kapsar', () => {
    const mapped = collectAllMappedTransitions();
    const mappedKeys = new Set(mapped.map((entry) => `${entry.fromState}:${entry.command}`));

    for (const covered of WORKFLOW_POSITIVE_TRANSITION_COVERAGE) {
      expect(mappedKeys.has(`${covered.fromState}:${covered.command}`)).toBe(true);
    }
  });

  it('registry eksik pozitif geçiş bırakmaz', () => {
    const mapped = collectAllMappedTransitions().filter(
      (entry) => entry.command !== WorkflowCommand.OPEN_CASE,
    );
    const coveredKeys = new Set(
      WORKFLOW_POSITIVE_TRANSITION_COVERAGE.map((entry) => `${entry.fromState}:${entry.command}`),
    );

    const missing = mapped.filter(
      (entry) => !coveredKeys.has(`${entry.fromState}:${entry.command}`),
    );

    expect(missing).toEqual([]);
  });

  it('matrix senaryo tipleri Docs/08 §4 ile uyumlu (8 tip)', () => {
    expect(WORKFLOW_MATRIX_SCENARIO_TYPES).toHaveLength(8);
    expect(WORKFLOW_MATRIX_SCENARIO_TYPES).toEqual([
      'positive',
      'wrongRole',
      'wrongState',
      'clearance',
      'assignment',
      'idempotency',
      'sideEffect',
      'precondition',
    ]);
  });

  it('17 state × 20+ geçiş — map boyutu hedefi', () => {
    expect(collectAllMappedTransitions().length).toBeGreaterThanOrEqual(20);
  });
});
