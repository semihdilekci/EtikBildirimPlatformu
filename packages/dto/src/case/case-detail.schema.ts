import { CASE_STATE_VALUES, CLEARANCE_LEVEL_VALUES, WORKFLOW_COMMAND_VALUES } from '@ethics/shared';
import { z } from 'zod';

export const caseDetailSchema = z.object({
  id: z.string(),
  reportId: z.string(),
  currentState: z.enum(CASE_STATE_VALUES as [string, ...string[]]),
  currentStateLabel: z.string(),
  workflowVersion: z.string(),
  confidentialityLevel: z.enum(CLEARANCE_LEVEL_VALUES as [string, ...string[]]),
  companyId: z.string(),
  companyName: z.string(),
  categoryGroup: z.string(),
  categories: z.array(z.string()),
  incidentDescription: z.string().optional(),
  incidentDateStart: z.string().optional(),
  involvedPersons: z.unknown().optional(),
  witnesses: z.unknown().optional(),
  reporterIdentityName: z.string().nullable().optional(),
  urgentRiskFlag: z.boolean(),
  assignedRapporteurId: z.string().nullable().optional(),
  openedAt: z.string().datetime(),
  availableActions: z.array(z.enum(WORKFLOW_COMMAND_VALUES as [string, ...string[]])),
});

export type CaseDetail = z.infer<typeof caseDetailSchema>;
