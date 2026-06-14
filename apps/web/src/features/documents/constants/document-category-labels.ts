import { DocumentCategory, type DocumentCategoryCode } from '@ethics/shared';

export const DOCUMENT_CATEGORY_LABELS: Readonly<Record<DocumentCategoryCode, string>> = {
  [DocumentCategory.INCOMING_REPORT_ATTACHMENT]: 'Gelen Bildirim Eki',
  [DocumentCategory.PRE_RESEARCH_NOTE]: 'Ön Araştırma Notu',
  [DocumentCategory.COMPANY_EVIDENCE]: 'Şirket Kanıtı',
  [DocumentCategory.DISCIPLINARY_DOCUMENT]: 'Disiplin Dokümanı',
  [DocumentCategory.RAPPORTEUR_REPORT]: 'Raportör Raporu',
  [DocumentCategory.COUNCIL_AGENDA_PACK]: 'Kurul Gündem Paketi',
  [DocumentCategory.DECISION_DRAFT]: 'Karar Taslağı',
  [DocumentCategory.MEMBER_APPROVAL_RECORD]: 'Üye Onay Kaydı',
  [DocumentCategory.BOARD_CHAIR_APPROVAL]: 'HYKB Onayı',
  [DocumentCategory.IMPLEMENTATION_LETTER]: 'Uygulama Yazısı',
  [DocumentCategory.ACTION_RESPONSE]: 'Aksiyon Yanıtı',
  [DocumentCategory.FOLLOW_UP_DECISION]: 'Takip Kararı',
  [DocumentCategory.CLOSURE_NOTE]: 'Kapanış Notu',
};

export function getDocumentCategoryLabel(category: DocumentCategoryCode): string {
  return DOCUMENT_CATEGORY_LABELS[category];
}
