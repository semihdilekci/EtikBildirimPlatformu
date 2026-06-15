import type { InternalReportDetail, PendingReportListItem } from '@ethics/dto';
import { REPORT_CATEGORY_CATALOG, type ClearanceLevel } from '@ethics/shared';

import type { MaskableCaseData } from '../../authorization/field-masking.types.js';
import type { DecryptedReportFields } from '../case-management/case-report-decrypt.service.js';
import { maskTrackingCode } from '../tracking/tracking-code-mask.util.js';

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

type ReportListRow = {
  id: string;
  trackingCode: string;
  status: string;
  confidentialityLevel: string;
  companyId: string;
  categoryGroup: string;
  categories: string[];
  urgentRiskFlag: boolean;
  submittedAt: Date;
  incidentCountry: string;
  incidentCity: string;
  company: {
    name: string;
  };
};

type ReportDetailRow = ReportListRow & {
  isAnonymous: boolean;
  incidentLocationDetail: string | null;
  incidentDateStart: Date | null;
  _count: {
    attachments: number;
  };
};

function resolveCategoryGroupLabel(categoryGroup: string): string {
  const entry = REPORT_CATEGORY_CATALOG.find((item) => item.groupCode === categoryGroup);
  return entry?.groupLabel ?? categoryGroup;
}

export function toPendingReportListItem(row: ReportListRow): PendingReportListItem {
  return {
    id: row.id,
    trackingCodeMasked: maskTrackingCode(row.trackingCode),
    status: row.status,
    confidentialityLevel: row.confidentialityLevel,
    companyId: row.companyId,
    companyName: row.company.name,
    categoryGroup: row.categoryGroup,
    categoryGroupLabel: resolveCategoryGroupLabel(row.categoryGroup),
    categories: row.categories,
    urgentRiskFlag: row.urgentRiskFlag,
    submittedAt: row.submittedAt.toISOString(),
    incidentCountry: row.incidentCountry,
    incidentCity: row.incidentCity,
  };
}

export function buildInternalReportDetailMaskableData(
  row: ReportDetailRow,
  decrypted: DecryptedReportFields,
): MaskableCaseData {
  const reporterIdentity =
    row.isAnonymous && !decrypted.reporterIdentityName
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
    id: row.id,
    case_number: row.id,
    created_at: row.submittedAt.toISOString(),
    company_id: row.companyId,
    company_name: row.company.name,
    category: row.categoryGroup,
    category_group: row.categoryGroup,
    confidentiality_level: row.confidentialityLevel as ClearanceLevel,
    report_text: decrypted.incidentDescription,
    incident_description: decrypted.incidentDescription,
    reporter_identity: reporterIdentity,
    reporter_contact: reporterContact,
    incident_date: row.incidentDateStart ? row.incidentDateStart.toISOString().slice(0, 10) : null,
    incident_location: {
      country: row.incidentCountry,
      city: row.incidentCity,
      detail: row.incidentLocationDetail,
    },
    involved_persons: decrypted.involvedPersons,
    witnesses: decrypted.witnesses,
    reporter_identity_name: decrypted.reporterIdentityName,
    urgent_risk_flag: row.urgentRiskFlag,
    categories: row.categories,
    category_group_label: resolveCategoryGroupLabel(row.categoryGroup),
    tracking_code_masked: maskTrackingCode(row.trackingCode),
    status: row.status,
    is_anonymous: row.isAnonymous,
    submitted_at: row.submittedAt.toISOString(),
    urgent_risk_description: decrypted.urgentRiskDescription,
    category_specific_data: decrypted.categorySpecificData,
    attachment_count: row._count.attachments,
  };
}

export function toInternalReportDetailApi(masked: MaskableCaseData): InternalReportDetail {
  const detail: InternalReportDetail = {
    id: maskString(masked.id),
    trackingCodeMasked: maskString(masked.tracking_code_masked),
    status: maskString(masked.status),
    confidentialityLevel: masked.confidentiality_level as ClearanceLevel,
    companyId: maskString(masked.company_id),
    companyName: maskString(masked.company_name),
    categoryGroup: maskString(masked.category_group ?? masked.category),
    categoryGroupLabel: maskString(masked.category_group_label),
    categories: Array.isArray(masked.categories) ? (masked.categories as string[]) : [],
    isAnonymous: Boolean(masked.is_anonymous),
    urgentRiskFlag: Boolean(masked.urgent_risk_flag),
    submittedAt: maskString(masked.submitted_at ?? masked.created_at),
    incidentCountry: maskString(
      (masked.incident_location as { country?: string } | undefined)?.country,
    ),
    incidentCity: maskString((masked.incident_location as { city?: string } | undefined)?.city),
    attachmentCount: typeof masked.attachment_count === 'number' ? masked.attachment_count : 0,
  };

  const locationDetail = (masked.incident_location as { detail?: string | null } | undefined)
    ?.detail;
  if (locationDetail !== undefined) {
    detail.incidentLocationDetail = locationDetail;
  }

  if (typeof masked.incident_date === 'string') {
    detail.incidentDateStart = masked.incident_date;
  }

  if (typeof masked.incident_description === 'string') {
    detail.incidentDescription = masked.incident_description;
  }

  if (typeof masked.reporter_identity_name === 'string' || masked.reporter_identity_name === null) {
    detail.reporterIdentityName = masked.reporter_identity_name;
  }

  const identity = masked.reporter_identity as
    | { title?: string | null; relation?: string | null }
    | undefined;
  if (identity?.title !== undefined) {
    detail.reporterIdentityTitle = identity.title;
  }
  if (identity?.relation !== undefined) {
    detail.reporterIdentityRelation = identity.relation;
  }

  const contact = masked.reporter_contact as
    | { email?: string | null; phone?: string | null }
    | undefined;
  if (contact?.email !== undefined) {
    detail.reporterContactEmail = contact.email;
  }
  if (contact?.phone !== undefined) {
    detail.reporterContactPhone = contact.phone;
  }

  if (masked.urgent_risk_description !== undefined) {
    detail.urgentRiskDescription =
      typeof masked.urgent_risk_description === 'string' ? masked.urgent_risk_description : null;
  }

  if (masked.involved_persons !== undefined) {
    detail.involvedPersons = masked.involved_persons;
  }

  if (masked.witnesses !== undefined) {
    detail.witnesses = masked.witnesses;
  }

  if (masked.category_specific_data !== undefined) {
    detail.categorySpecificData = masked.category_specific_data;
  }

  return detail;
}
