import { TaskType, type TaskTypeCode } from '../enums/task-type.enum.js';

export const TASK_TYPE_LABELS: Readonly<Record<TaskTypeCode, string>> = {
  [TaskType.SECRETARIAT_REVIEW_TASK]: 'Ön Değerlendirme',
  [TaskType.PRE_RESEARCH_TASK]: 'Ön Araştırma',
  [TaskType.CHAIR_GATE_TASK]: 'Gündeme Alma',
  [TaskType.RAPPORTEUR_ASSIGN_TASK]: 'Raportör Atama',
  [TaskType.RAPPORTEUR_REPORT_TASK]: 'Raportör Raporu',
  [TaskType.MEMBER_APPROVAL_TASK]: 'Üye Onayı',
  [TaskType.DECISION_DRAFT_TASK]: 'Karar Yazısı',
  [TaskType.BOARD_REVIEW_TASK]: 'HYKB Onayı',
  [TaskType.IMPLEMENTATION_LETTER_TASK]: 'Uygulama Yazısı',
  [TaskType.ACTION_RESPONSE_TASK]: 'Aksiyon Dönüşü',
  [TaskType.FOLLOW_UP_REVIEW_TASK]: 'Takip Kararı',
};

export function getTaskTypeLabel(taskType: TaskTypeCode): string {
  return TASK_TYPE_LABELS[taskType];
}
