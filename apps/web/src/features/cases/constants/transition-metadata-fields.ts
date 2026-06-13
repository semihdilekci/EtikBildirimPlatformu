import { WorkflowCommand, type WorkflowCommandCode } from '@ethics/shared';

export type TransitionMetadataField = {
  key: string;
  label: string;
  helperText?: string;
  type: 'text' | 'boolean';
};

export const TRANSITION_METADATA_FIELDS: Partial<
  Record<WorkflowCommandCode, readonly TransitionMetadataField[]>
> = {
  [WorkflowCommand.ASSIGN_RAPPORTEUR]: [
    {
      key: 'rapporteurUserId',
      label: 'Raportör Kullanıcı ID',
      helperText: 'Atanacak raportörün sistem kullanıcı kimliği',
      type: 'text',
    },
  ],
  [WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT]: [
    {
      key: 'rapporteurReportDocumentId',
      label: 'Raportör Raporu Doküman ID',
      type: 'text',
    },
  ],
  [WorkflowCommand.ASSIGN_ACTION]: [
    {
      key: 'actionOwnerUserId',
      label: 'Aksiyon Sahibi Kullanıcı ID',
      type: 'text',
    },
  ],
  [WorkflowCommand.FOLLOW_UP_REASSIGN]: [
    {
      key: 'actionOwnerUserId',
      label: 'Yeni Aksiyon Sahibi Kullanıcı ID',
      type: 'text',
    },
  ],
  [WorkflowCommand.MEMBER_OBJECTION]: [
    {
      key: 'objectionSummary',
      label: 'İtiraz Özeti',
      type: 'text',
    },
  ],
  [WorkflowCommand.CREATE_DECISION_DRAFT]: [
    {
      key: 'memberVotesComplete',
      label: 'Üye oyları tamamlandı',
      type: 'boolean',
    },
  ],
  [WorkflowCommand.SUBMIT_TO_BOARD_REVIEW]: [
    {
      key: 'decisionDocumentId',
      label: 'Karar Doküman ID',
      type: 'text',
    },
  ],
};
