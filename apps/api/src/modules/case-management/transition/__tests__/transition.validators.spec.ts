import { HttpStatus } from '@nestjs/common';
import {
  AuditActorType,
  CaseState,
  ClearanceLevel,
  ErrorCode,
  Role,
  WorkflowCommand,
} from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import { DomainException } from '../../../../common/exceptions/domain.exception.js';
import { resolveTransition } from '../transition.commands.js';
import { TransitionValidators } from '../transition.validators.js';

const validators = new TransitionValidators();

const baseCase = {
  id: 'case-validator-001',
  reportId: 'report-001',
  currentState: CaseState.CHAIR_GATE,
  workflowVersion: '1.0',
  confidentialityLevel: ClearanceLevel.SENSITIVE,
  companyId: 'company-001',
  assignedRapporteurId: 'rapporteur-001',
  assignedActionOwnerId: 'owner-001',
  openedAt: new Date(),
  closedAt: null,
  optimisticLockVersion: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'creator-001',
};

describe('TransitionValidators', () => {
  it('gerekli rol yoksa AUTHZ_FORBIDDEN', () => {
    const definition = resolveTransition(CaseState.CHAIR_GATE, WorkflowCommand.APPROVE_AGENDA);

    if (!definition) {
      throw new Error('Expected transition definition');
    }

    expect(() =>
      validators.validate({
        caseEntity: baseCase,
        command: WorkflowCommand.APPROVE_AGENDA,
        definition,
        actor: {
          type: AuditActorType.USER,
          userId: 'user-1',
          roles: [Role.COUNCIL_SECRETARY],
          clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        },
      }),
    ).toThrow(DomainException);

    try {
      validators.validate({
        caseEntity: baseCase,
        command: WorkflowCommand.APPROVE_AGENDA,
        definition,
        actor: {
          type: AuditActorType.USER,
          userId: 'user-1',
          roles: [Role.COUNCIL_SECRETARY],
          clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        },
      });
      expect.unreachable('Expected DomainException');
    } catch (error) {
      expect((error as DomainException).code).toBe(ErrorCode.AUTHZ_FORBIDDEN);
      expect((error as DomainException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('rapporteur atamasi disi kullanici submit_rapporteur_report reddedilir', () => {
    const definition = resolveTransition(
      CaseState.RAPPORTEUR_ASSIGNED,
      WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT,
    );

    if (!definition) {
      throw new Error('Expected transition definition');
    }

    expect(() =>
      validators.validate({
        caseEntity: {
          ...baseCase,
          currentState: CaseState.RAPPORTEUR_ASSIGNED,
        },
        command: WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT,
        definition,
        actor: {
          type: AuditActorType.USER,
          userId: 'other-user',
          roles: [Role.RAPPORTEUR],
          clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        },
      }),
    ).toThrow(DomainException);
  });

  it('requiresReason komutunda gerekce yoksa VALIDATION_FAILED', () => {
    const definition = resolveTransition(CaseState.CHAIR_GATE, WorkflowCommand.CLOSE_NOT_ON_AGENDA);

    if (!definition) {
      throw new Error('Expected transition definition');
    }

    expect(definition.requiresReason).toBe(true);

    expect(() =>
      validators.validate({
        caseEntity: baseCase,
        command: WorkflowCommand.CLOSE_NOT_ON_AGENDA,
        definition,
        actor: {
          type: AuditActorType.USER,
          userId: 'chair-1',
          roles: [Role.COUNCIL_CHAIR],
          clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        },
      }),
    ).toThrow(DomainException);
  });

  it('assign_rapporteur metadata.rapporteurUserId zorunlu', () => {
    const definition = resolveTransition(CaseState.AGENDA_READY, WorkflowCommand.ASSIGN_RAPPORTEUR);

    if (!definition) {
      throw new Error('Expected transition definition');
    }

    expect(() =>
      validators.validate({
        caseEntity: { ...baseCase, currentState: CaseState.AGENDA_READY },
        command: WorkflowCommand.ASSIGN_RAPPORTEUR,
        definition,
        actor: {
          type: AuditActorType.USER,
          userId: 'secretary-1',
          roles: [Role.COUNCIL_SECRETARY],
          clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        },
        metadata: {},
      }),
    ).toThrow(DomainException);
  });

  it('submit_rapporteur_report metadata.rapporteurReportDocumentId zorunlu', () => {
    const definition = resolveTransition(
      CaseState.RAPPORTEUR_ASSIGNED,
      WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT,
    );

    if (!definition) {
      throw new Error('Expected transition definition');
    }

    expect(() =>
      validators.validate({
        caseEntity: {
          ...baseCase,
          currentState: CaseState.RAPPORTEUR_ASSIGNED,
        },
        command: WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT,
        definition,
        actor: {
          type: AuditActorType.USER,
          userId: 'rapporteur-001',
          roles: [Role.RAPPORTEUR],
          clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        },
        metadata: {},
      }),
    ).toThrow(DomainException);
  });

  it('create_decision_draft memberVotesComplete stub zorunlu', () => {
    const definition = resolveTransition(
      CaseState.MEMBER_APPROVAL,
      WorkflowCommand.CREATE_DECISION_DRAFT,
    );

    if (!definition) {
      throw new Error('Expected transition definition');
    }

    expect(() =>
      validators.validate({
        caseEntity: { ...baseCase, currentState: CaseState.MEMBER_APPROVAL },
        command: WorkflowCommand.CREATE_DECISION_DRAFT,
        definition,
        actor: {
          type: AuditActorType.USER,
          userId: 'secretary-1',
          roles: [Role.COUNCIL_SECRETARY],
          clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        },
        metadata: {},
      }),
    ).toThrow(DomainException);
  });

  it('submit_to_board_review decisionDocumentId zorunlu', () => {
    const definition = resolveTransition(
      CaseState.DECISION_DRAFT,
      WorkflowCommand.SUBMIT_TO_BOARD_REVIEW,
    );

    if (!definition) {
      throw new Error('Expected transition definition');
    }

    expect(() =>
      validators.validate({
        caseEntity: { ...baseCase, currentState: CaseState.DECISION_DRAFT },
        command: WorkflowCommand.SUBMIT_TO_BOARD_REVIEW,
        definition,
        actor: {
          type: AuditActorType.USER,
          userId: 'secretary-1',
          roles: [Role.COUNCIL_SECRETARY],
          clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        },
        metadata: {},
      }),
    ).toThrow(DomainException);
  });

  it('board_veto gerekce zorunlu', () => {
    const definition = resolveTransition(CaseState.BOARD_CHAIR_REVIEW, WorkflowCommand.BOARD_VETO);

    if (!definition) {
      throw new Error('Expected transition definition');
    }

    expect(() =>
      validators.validate({
        caseEntity: { ...baseCase, currentState: CaseState.BOARD_CHAIR_REVIEW },
        command: WorkflowCommand.BOARD_VETO,
        definition,
        actor: {
          type: AuditActorType.USER,
          userId: 'board-chair-1',
          roles: [Role.BOARD_CHAIR],
          clearanceLevel: ClearanceLevel.STRICTLY_CONFIDENTIAL,
        },
      }),
    ).toThrow(DomainException);
  });
});
