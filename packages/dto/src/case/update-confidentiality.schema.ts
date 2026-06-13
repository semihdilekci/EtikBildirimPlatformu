import { CLEARANCE_LEVEL_VALUES } from '@ethics/shared';
import { z } from 'zod';

export const updateCaseConfidentialityBodySchema = z.object({
  confidentialityLevel: z.enum(CLEARANCE_LEVEL_VALUES as [string, ...string[]]),
  reason: z
    .string()
    .trim()
    .min(1, 'Gizlilik seviyesi değişikliği için gerekçe zorunludur.')
    .max(2000),
  idempotencyKey: z.string().uuid('Idempotency key UUID v4 formatında olmalıdır.'),
});

export type UpdateCaseConfidentialityBody = z.infer<typeof updateCaseConfidentialityBodySchema>;

export const updateCaseConfidentialityResponseSchema = z.object({
  caseId: z.string(),
  previousLevel: z.enum(CLEARANCE_LEVEL_VALUES as [string, ...string[]]),
  confidentialityLevel: z.enum(CLEARANCE_LEVEL_VALUES as [string, ...string[]]),
  updatedAt: z.string().datetime(),
  idempotentReplay: z.boolean(),
});

export type UpdateCaseConfidentialityResponse = z.infer<
  typeof updateCaseConfidentialityResponseSchema
>;
