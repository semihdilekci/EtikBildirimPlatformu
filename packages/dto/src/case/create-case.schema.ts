import { CASE_STATE_VALUES, CLEARANCE_LEVEL_VALUES } from '@ethics/shared';
import { z } from 'zod';

export const createCaseBodySchema = z.object({
  reportId: z.string().min(1, 'reportId zorunludur.'),
  idempotencyKey: z.string().uuid('Idempotency key UUID v4 formatında olmalıdır.'),
});

export type CreateCaseBody = z.infer<typeof createCaseBodySchema>;

export const createCaseResponseSchema = z.object({
  caseId: z.string(),
  reportId: z.string(),
  currentState: z.enum(CASE_STATE_VALUES as [string, ...string[]]),
  confidentialityLevel: z.enum(CLEARANCE_LEVEL_VALUES as [string, ...string[]]),
  companyId: z.string(),
  openedAt: z.string().datetime(),
  idempotentReplay: z.boolean(),
});

export type CreateCaseResponse = z.infer<typeof createCaseResponseSchema>;
