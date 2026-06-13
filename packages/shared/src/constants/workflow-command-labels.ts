import { WorkflowCommand } from '../enums/workflow-command.enum.js';
import type { WorkflowCommandCode } from '../enums/workflow-command.enum.js';

/** UI etiketleri — Docs/06_SCREEN_CATALOG S-CASE-DETAIL CaseActionBar */
export const WORKFLOW_COMMAND_LABELS: Readonly<Record<WorkflowCommandCode, string>> = {
  [WorkflowCommand.OPEN_CASE]: 'Vaka Aç',
  [WorkflowCommand.ACKNOWLEDGE_REPORT]: 'Bildirimi Kabul Et',
  [WorkflowCommand.START_PRE_RESEARCH]: 'Ön Araştırmaya Başla',
  [WorkflowCommand.SUBMIT_TO_CHAIR_GATE]: 'Kurul Başkanına Sun',
  [WorkflowCommand.APPROVE_AGENDA]: 'Gündeme Al',
  [WorkflowCommand.CLOSE_NOT_ON_AGENDA]: 'Gündeme Almadan Kapat',
  [WorkflowCommand.ASSIGN_RAPPORTEUR]: 'Raportör Ata',
  [WorkflowCommand.SUBMIT_RAPPORTEUR_REPORT]: 'Raportör Raporunu Tamamla',
  [WorkflowCommand.RETURN_TO_AGENDA]: 'Gündeme Geri Dön',
  [WorkflowCommand.SUBMIT_TO_MEMBER_APPROVAL]: 'Üye Onayına Sun',
  [WorkflowCommand.MEMBER_OBJECTION]: 'Üye İtirazı',
  [WorkflowCommand.CREATE_DECISION_DRAFT]: 'Karar Taslağı Oluştur',
  [WorkflowCommand.SUBMIT_TO_BOARD_REVIEW]: 'HYKB Onayına Sun',
  [WorkflowCommand.BOARD_APPROVE]: 'HYKB Onayla',
  [WorkflowCommand.BOARD_VETO]: 'HYKB Veto',
  [WorkflowCommand.PREPARE_IMPLEMENTATION_LETTER]: 'Uygulama Yazısı Hazırla',
  [WorkflowCommand.ASSIGN_ACTION]: 'Aksiyon Ata',
  [WorkflowCommand.BEGIN_ACTION_RESPONSE]: 'Aksiyon Dönüşünü Başlat',
  [WorkflowCommand.SUBMIT_ACTION_RESPONSE]: 'Aksiyon Dönüşünü Gönder',
  [WorkflowCommand.SUBMIT_FOLLOW_UP_REVIEW]: 'Takip İncelemesine Sun',
  [WorkflowCommand.FOLLOW_UP_CLOSE]: 'Vakayı Kapat',
  [WorkflowCommand.FOLLOW_UP_REASSIGN]: 'Aksiyonu Yeniden Ata',
};

export function getWorkflowCommandLabel(command: WorkflowCommandCode): string {
  return WORKFLOW_COMMAND_LABELS[command];
}

/** Gerekçe zorunlu komutlar — backend TRANSITION_MAP ile uyumlu */
export const REASON_REQUIRED_COMMANDS: ReadonlySet<WorkflowCommandCode> = new Set([
  WorkflowCommand.CLOSE_NOT_ON_AGENDA,
  WorkflowCommand.BOARD_VETO,
]);
