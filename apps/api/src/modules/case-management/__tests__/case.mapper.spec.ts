import { CaseState, ClearanceLevel, WorkflowCommand } from '@ethics/shared';
import { describe, expect, it } from 'vitest';

import {
  buildCaseDetailMaskableData,
  buildCaseListMaskableData,
  collectVisibleFieldNames,
  toCaseDetailApi,
  toCaseListItemApi,
} from '../case.mapper.js';

const openedAt = new Date('2026-06-13T10:00:00.000Z');
const updatedAt = new Date('2026-06-13T11:00:00.000Z');

const caseEntity = {
  id: 'case-mapper-1',
  reportId: 'report-mapper-1',
  currentState: CaseState.AGENDA_READY,
  workflowVersion: '1.0',
  confidentialityLevel: ClearanceLevel.SENSITIVE,
  companyId: 'company-1',
  assignedRapporteurId: null,
  assignedActionOwnerId: null,
  openedAt,
  updatedAt,
  createdAt: openedAt,
};

const reportSummary = {
  id: 'report-mapper-1',
  categoryGroup: 'employee_human',
  categories: ['workplace_violence'],
  incidentDateStart: null,
  urgentRiskFlag: false,
  lastActivityAt: updatedAt,
};

const reportDetail = {
  ...reportSummary,
  incidentCountry: 'TUR',
  incidentCity: 'Ankara',
  incidentLocationDetail: null,
  isAnonymous: true,
};

const company = {
  id: 'company-1',
  name: 'Seed Company',
};

describe('case.mapper', () => {
  it('buildCaseListMaskableData temel alanları eşler', () => {
    const masked = buildCaseListMaskableData(caseEntity, reportSummary, company);

    expect(masked).toMatchObject({
      id: caseEntity.id,
      current_state: CaseState.AGENDA_READY,
      confidentiality_level: ClearanceLevel.SENSITIVE,
      company_name: company.name,
      category_group: reportSummary.categoryGroup,
    });
  });

  it('buildCaseDetailMaskableData şifresi çözülmüş alanları birleştirir', () => {
    const masked = buildCaseDetailMaskableData(caseEntity, reportDetail, company, {
      incidentDescription: 'Test açıklaması.',
      reporterIdentityName: null,
      reporterIdentityTitle: null,
      reporterIdentityRelation: null,
      reporterContactEmail: null,
      reporterContactPhone: null,
      urgentRiskDescription: null,
      involvedPersons: null,
      witnesses: null,
      categorySpecificData: null,
    });

    expect(masked.report_text).toBe('Test açıklaması.');
    expect(masked.reporter_identity).toBeNull();
  });

  it('toCaseListItemApi DTO alanlarını döner', () => {
    const masked = buildCaseListMaskableData(caseEntity, reportSummary, company);
    const item = toCaseListItemApi(masked);

    expect(item).toMatchObject({
      id: caseEntity.id,
      reportId: reportSummary.id,
      currentState: CaseState.AGENDA_READY,
      companyName: company.name,
    });
  });

  it('toCaseDetailApi availableActions ile birleşir', () => {
    const masked = buildCaseDetailMaskableData(caseEntity, reportDetail, company, {
      incidentDescription: 'Detay metni.',
      reporterIdentityName: null,
      reporterIdentityTitle: null,
      reporterIdentityRelation: null,
      reporterContactEmail: null,
      reporterContactPhone: null,
      urgentRiskDescription: null,
      involvedPersons: null,
      witnesses: null,
      categorySpecificData: null,
    });

    const detail = toCaseDetailApi(masked, [WorkflowCommand.ASSIGN_RAPPORTEUR]);

    expect(detail.availableActions).toEqual([WorkflowCommand.ASSIGN_RAPPORTEUR]);
    expect(detail.incidentDescription).toBe('Detay metni.');
  });

  it('collectVisibleFieldNames atama alanlarını filtreler', () => {
    const masked = buildCaseDetailMaskableData(caseEntity, reportDetail, company, {
      incidentDescription: 'Detay.',
      reporterIdentityName: null,
      reporterIdentityTitle: null,
      reporterIdentityRelation: null,
      reporterContactEmail: null,
      reporterContactPhone: null,
      urgentRiskDescription: null,
      involvedPersons: null,
      witnesses: null,
      categorySpecificData: null,
    });

    const fields = collectVisibleFieldNames(masked);

    expect(fields).not.toContain('assigned_rapporteur_id');
    expect(fields).not.toContain('assigned_action_owner_id');
    expect(fields).toContain('report_text');
  });
});
