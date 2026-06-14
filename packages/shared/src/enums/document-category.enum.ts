/** Vaka doküman kategorileri — Docs/01_DOMAIN_MODEL.md §Document */
export const DocumentCategory = {
  INCOMING_REPORT_ATTACHMENT: 'incoming_report_attachment',
  PRE_RESEARCH_NOTE: 'pre_research_note',
  COMPANY_EVIDENCE: 'company_evidence',
  DISCIPLINARY_DOCUMENT: 'disciplinary_document',
  RAPPORTEUR_REPORT: 'rapporteur_report',
  COUNCIL_AGENDA_PACK: 'council_agenda_pack',
  DECISION_DRAFT: 'decision_draft',
  MEMBER_APPROVAL_RECORD: 'member_approval_record',
  BOARD_CHAIR_APPROVAL: 'board_chair_approval',
  IMPLEMENTATION_LETTER: 'implementation_letter',
  ACTION_RESPONSE: 'action_response',
  FOLLOW_UP_DECISION: 'follow_up_decision',
  CLOSURE_NOTE: 'closure_note',
} as const;

export type DocumentCategoryCode = (typeof DocumentCategory)[keyof typeof DocumentCategory];

export const DOCUMENT_CATEGORY_VALUES = Object.values(
  DocumentCategory,
) as readonly DocumentCategoryCode[];
