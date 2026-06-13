import type { CaseListItem, CaseDetail } from '@ethics/dto';
import {
  getCaseStateLabel,
  type CaseStateCode,
  type ClearanceLevel,
  type WorkflowCommandCode,
} from '@ethics/shared';

import type { MaskableCaseData } from '../../authorization/field-masking.types.js';
import type { DecryptedReportFields } from './case-report-decrypt.service.js';

type CaseCompanyRow = {
  id: string;
  reportId: string;
  currentState: string;
  workflowVersion: string;
  confidentialityLevel: string;
  companyId: string;
  assignedRapporteurId: string | null;
  assignedActionOwnerId: string | null;
  openedAt: Date;
  updatedAt: Date;
  createdAt: Date;
};

type ReportSummaryRow = {
  id: string;
  categoryGroup: string;
  categories: string[];
  incidentDateStart: Date | null;
  urgentRiskFlag: boolean;
  lastActivityAt: Date | null;
};

type ReportDetailRow = ReportSummaryRow & {
  incidentCountry: string;
  incidentCity: string;
  incidentLocationDetail: string | null;
  isAnonymous: boolean;
};

type CompanyRow = {
  id: string;
  name: string;
};

function maskString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

export function buildCaseListMaskableData(
  caseEntity: CaseCompanyRow,
  report: ReportSummaryRow,
  company: CompanyRow,
): MaskableCaseData {
  const currentState = caseEntity.currentState as CaseStateCode;

  return {
    id: caseEntity.id,
    case_number: caseEntity.id,
    created_at: caseEntity.openedAt.toISOString(),
    updated_at: caseEntity.updatedAt.toISOString(),
    company_id: company.id,
    company_name: company.name,
    category: report.categoryGroup,
    status: currentState,
    workflow_state: currentState,
    confidentiality_level: caseEntity.confidentialityLevel as ClearanceLevel,
    report_id: report.id,
    current_state: currentState,
    current_state_label: getCaseStateLabel(currentState),
    category_group: report.categoryGroup,
    opened_at: caseEntity.openedAt.toISOString(),
    last_activity_at: (report.lastActivityAt ?? caseEntity.updatedAt).toISOString(),
  };
}

export function buildCaseDetailMaskableData(
  caseEntity: CaseCompanyRow,
  report: ReportDetailRow,
  company: CompanyRow,
  decrypted: DecryptedReportFields,
): MaskableCaseData {
  const reporterIdentity =
    report.isAnonymous && !decrypted.reporterIdentityName
      ? null
      : {
          name: decrypted.reporterIdentityName,
          title: decrypted.reporterIdentityTitle,
          relation: decrypted.reporterIdentityRelation,
        };

  const reporterContact =
    decrypted.reporterContactEmail || decrypted.reporterContactPhone
      ? {
          email: decrypted.reporterContactEmail,
          phone: decrypted.reporterContactPhone,
        }
      : null;

  return {
    ...buildCaseListMaskableData(caseEntity, report, company),
    workflow_version: caseEntity.workflowVersion,
    categories: report.categories,
    report_text: decrypted.incidentDescription,
    incident_description: decrypted.incidentDescription,
    reporter_identity: reporterIdentity,
    reporter_contact: reporterContact,
    incident_date: report.incidentDateStart
      ? report.incidentDateStart.toISOString().slice(0, 10)
      : null,
    incident_location: {
      country: report.incidentCountry,
      city: report.incidentCity,
      detail: report.incidentLocationDetail,
    },
    involved_persons: decrypted.involvedPersons,
    witnesses: decrypted.witnesses,
    reporter_identity_name: decrypted.reporterIdentityName,
    urgent_risk_flag: report.urgentRiskFlag,
    assigned_rapporteur_id: caseEntity.assignedRapporteurId,
    assigned_action_owner_id: caseEntity.assignedActionOwnerId,
  };
}

export function toCaseListItemApi(masked: MaskableCaseData): CaseListItem {
  return {
    id: maskString(masked.id),
    reportId: maskString(masked.report_id),
    currentState: maskString(masked.current_state ?? masked.workflow_state ?? masked.status),
    currentStateLabel: maskString(masked.current_state_label),
    confidentialityLevel: masked.confidentiality_level as ClearanceLevel,
    companyId: maskString(masked.company_id),
    companyName: maskString(masked.company_name),
    categoryGroup: maskString(masked.category_group ?? masked.category),
    openedAt: maskString(masked.opened_at ?? masked.created_at),
    lastActivityAt: maskString(masked.last_activity_at ?? masked.updated_at ?? masked.created_at),
  };
}

export function toCaseDetailApi(
  masked: MaskableCaseData,
  availableActions: WorkflowCommandCode[],
): CaseDetail {
  const detail: CaseDetail = {
    id: maskString(masked.id),
    reportId: maskString(masked.report_id),
    currentState: maskString(masked.current_state ?? masked.workflow_state ?? masked.status),
    currentStateLabel: maskString(masked.current_state_label),
    workflowVersion: maskString(masked.workflow_version),
    confidentialityLevel: masked.confidentiality_level as ClearanceLevel,
    companyId: maskString(masked.company_id),
    companyName: maskString(masked.company_name),
    categoryGroup: maskString(masked.category_group ?? masked.category),
    categories: Array.isArray(masked.categories) ? (masked.categories as string[]) : [],
    urgentRiskFlag: Boolean(masked.urgent_risk_flag),
    openedAt: maskString(masked.opened_at ?? masked.created_at),
    availableActions,
  };

  if (typeof masked.incident_description === 'string') {
    detail.incidentDescription = masked.incident_description;
  }

  if (typeof masked.incident_date === 'string') {
    detail.incidentDateStart = masked.incident_date;
  }

  if (masked.involved_persons !== undefined) {
    detail.involvedPersons = masked.involved_persons;
  }

  if (masked.witnesses !== undefined) {
    detail.witnesses = masked.witnesses;
  }

  if (masked.reporter_identity_name !== undefined) {
    detail.reporterIdentityName =
      masked.reporter_identity_name === null ? null : maskString(masked.reporter_identity_name);
  }

  if (masked.assigned_rapporteur_id !== undefined) {
    detail.assignedRapporteurId =
      masked.assigned_rapporteur_id === null ? null : maskString(masked.assigned_rapporteur_id);
  }

  return detail;
}

export function collectVisibleFieldNames(masked: MaskableCaseData): string[] {
  return Object.keys(masked).filter(
    (key) => !['assigned_rapporteur_id', 'assigned_action_owner_id'].includes(key),
  );
}
