import type { ClearanceLevel } from '@ethics/shared';

/**
 * Vaka yanıtı maskeleme girdisi — Faz 5 CaseService decrypt sonrası bu şekle dönüştürülür.
 * `assigned_*` alanları yalnızca OWN_ONLY çözümlemesi için kullanılır; yanıta dahil edilmez.
 */
export type MaskableCaseData = {
  id: string;
  case_number: string;
  created_at: string;
  updated_at?: string;
  company_id?: string | null;
  company_name?: string | null;
  category?: string;
  status?: string;
  workflow_state?: string;
  confidentiality_level?: ClearanceLevel;

  report_text?: string;
  incident_description?: string;
  reporter_identity?: unknown;
  reporter_contact?: unknown;
  incident_date?: unknown;
  incident_location?: unknown;
  involved_persons?: unknown;
  witnesses?: unknown;
  attachments?: unknown;
  pre_research_notes?: unknown;
  rapporteur_report?: unknown;
  council_decision_draft?: unknown;
  council_decision_final?: unknown;
  action_letter?: unknown;
  action_response?: unknown;
  secure_messages?: unknown;

  assigned_rapporteur_id?: string | null;
  assigned_action_owner_id?: string | null;

  /** Maskeleme dışı bırakılan ek alanlar (ör. availableActions) */
  [key: string]: unknown;
};

export type MaskableCaseContext = Pick<
  MaskableCaseData,
  'assigned_rapporteur_id' | 'assigned_action_owner_id'
>;
