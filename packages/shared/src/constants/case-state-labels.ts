import { CaseState } from '../enums/case-state.enum.js';
import type { CaseStateCode } from '../enums/case-state.enum.js';

/** UI etiketleri — Docs/06_SCREEN_CATALOG S-CASE-LIST */
export const CASE_STATE_LABELS: Readonly<Record<CaseStateCode, string>> = {
  [CaseState.REPORT_SUBMITTED]: 'Bildirim Alındı',
  [CaseState.SECRETARIAT_REVIEW]: 'Sekreterya İncelemesi',
  [CaseState.PRE_RESEARCH]: 'Ön Araştırma',
  [CaseState.CHAIR_GATE]: 'Kurul Başkanı Kapısı',
  [CaseState.NOT_ON_AGENDA_CLOSED]: 'Gündeme Alınmadı — Kapalı',
  [CaseState.AGENDA_READY]: 'Kurul Gündeminde',
  [CaseState.RAPPORTEUR_ASSIGNED]: 'Raportör Atandı',
  [CaseState.RAPPORTEUR_REPORT_SUBMITTED]: 'Raportör Raporu Tamamlandı',
  [CaseState.MEMBER_APPROVAL]: 'Üye Onayı Bekleniyor',
  [CaseState.DECISION_DRAFT]: 'Karar Taslağı',
  [CaseState.BOARD_CHAIR_REVIEW]: 'HYKB İncelemesi',
  [CaseState.BOARD_APPROVED]: 'HYKB Onayladı',
  [CaseState.IMPLEMENTATION_LETTER_PREPARED]: 'Uygulama Yazısı Hazır',
  [CaseState.ACTION_ASSIGNED]: 'Aksiyon Atandı',
  [CaseState.ACTION_RESPONSE_PENDING]: 'Aksiyon Dönüşü Bekleniyor',
  [CaseState.FOLLOW_UP_DECISION]: 'Takip Kararı',
  [CaseState.CLOSED_ARCHIVED]: 'Kapatıldı — Arşiv',
};

export function getCaseStateLabel(state: CaseStateCode): string {
  return CASE_STATE_LABELS[state];
}
