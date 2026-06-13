import { CASE_STATE_VALUES, CLEARANCE_LEVEL_VALUES } from '@ethics/shared';
import { z } from 'zod';

const caseSortByValues = ['openedAt', 'lastActivityAt', 'currentState'] as const;

export const listCasesQuerySchema = z
  .object({
    status: z
      .string()
      .optional()
      .transform((value) =>
        value
          ?.split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      ),
    companyId: z.string().min(1).optional(),
    confidentialityLevel: z.enum(CLEARANCE_LEVEL_VALUES as [string, ...string[]]).optional(),
    dateFrom: z.string().datetime({ offset: true }).optional(),
    dateTo: z.string().datetime({ offset: true }).optional(),
    assignedToMe: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }
        if (typeof value === 'boolean') {
          return value;
        }
        return value === 'true';
      }),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    cursor: z.string().min(1).optional(),
    sortBy: z.enum(caseSortByValues).optional().default('openedAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .superRefine((value, ctx) => {
    if (value.status?.length) {
      for (const state of value.status) {
        if (!CASE_STATE_VALUES.includes(state as (typeof CASE_STATE_VALUES)[number])) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Geçersiz vaka durumu: ${state}`,
            path: ['status'],
          });
        }
      }
    }
  });

export type ListCasesQuery = z.infer<typeof listCasesQuerySchema>;

export const caseListItemSchema = z.object({
  id: z.string(),
  reportId: z.string(),
  currentState: z.enum(CASE_STATE_VALUES as [string, ...string[]]),
  currentStateLabel: z.string(),
  confidentialityLevel: z.enum(CLEARANCE_LEVEL_VALUES as [string, ...string[]]),
  companyId: z.string(),
  companyName: z.string(),
  categoryGroup: z.string(),
  openedAt: z.string().datetime(),
  lastActivityAt: z.string().datetime(),
});

export type CaseListItem = z.infer<typeof caseListItemSchema>;

export const casePaginationSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  total: z.null(),
});

export type CasePagination = z.infer<typeof casePaginationSchema>;

export const listCasesResponseSchema = z.object({
  data: z.array(caseListItemSchema),
  pagination: casePaginationSchema,
});

export type ListCasesResponse = z.infer<typeof listCasesResponseSchema>;
