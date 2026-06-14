import { MASTER_DATA_TYPE_VALUES } from '@ethics/shared';
import { z } from 'zod';

const masterDataCodeSchema = z.string().trim().min(1).max(20);
const masterDataNameSchema = z.string().trim().min(1).max(200);

export const masterDataTypeParamSchema = z.enum(MASTER_DATA_TYPE_VALUES as [string, ...string[]]);

export type MasterDataTypeParam = z.infer<typeof masterDataTypeParamSchema>;

export const listAdminMasterDataQuerySchema = z.object({
  companyId: z.string().min(1).optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? false : value === 'true')),
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().min(1).optional(),
});

export type ListAdminMasterDataQuery = z.infer<typeof listAdminMasterDataQuerySchema>;

export const createCompanyMasterDataBodySchema = z.object({
  name: masterDataNameSchema,
  code: masterDataCodeSchema,
  isActive: z.boolean().optional().default(true),
});

export const createScopedMasterDataBodySchema = z.object({
  companyId: z.string().min(1),
  name: masterDataNameSchema,
  code: masterDataCodeSchema,
  isActive: z.boolean().optional().default(true),
});

export type CreateCompanyMasterDataBody = z.infer<typeof createCompanyMasterDataBodySchema>;
export type CreateScopedMasterDataBody = z.infer<typeof createScopedMasterDataBodySchema>;

export const updateCompanyMasterDataBodySchema = z
  .object({
    name: masterDataNameSchema.optional(),
    code: masterDataCodeSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'En az bir alan güncellenmelidir.',
  });

export const updateScopedMasterDataBodySchema = z
  .object({
    companyId: z.string().min(1).optional(),
    name: masterDataNameSchema.optional(),
    code: masterDataCodeSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'En az bir alan güncellenmelidir.',
  });

export type UpdateCompanyMasterDataBody = z.infer<typeof updateCompanyMasterDataBodySchema>;
export type UpdateScopedMasterDataBody = z.infer<typeof updateScopedMasterDataBodySchema>;

export const adminMasterDataItemSchema = z.object({
  id: z.string(),
  type: masterDataTypeParamSchema,
  name: z.string(),
  code: z.string(),
  companyId: z.string().nullable(),
  companyName: z.string().nullable(),
  sourceSystem: z.string().nullable(),
  sourceRecordId: z.string().nullable(),
  sourceUpdatedAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AdminMasterDataItem = z.infer<typeof adminMasterDataItemSchema>;

export const adminMasterDataPaginationSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type AdminMasterDataPagination = z.infer<typeof adminMasterDataPaginationSchema>;

export const listAdminMasterDataResponseSchema = z.object({
  data: z.array(adminMasterDataItemSchema),
  pagination: adminMasterDataPaginationSchema,
});

export type ListAdminMasterDataResponse = z.infer<typeof listAdminMasterDataResponseSchema>;

export const adminMasterDataDetailResponseSchema = z.object({
  data: adminMasterDataItemSchema,
});

export type AdminMasterDataDetailResponse = z.infer<typeof adminMasterDataDetailResponseSchema>;

export const adminMasterDataSyncRunStatusSchema = z.enum(['COMPLETED', 'FAILED', 'RUNNING']);

export const adminMasterDataSyncRunSchema = z.object({
  id: z.string(),
  integrationName: z.string(),
  status: adminMasterDataSyncRunStatusSchema,
  recordCount: z.number().int().nonnegative(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  errorCount: z.number().int().nonnegative(),
  errorDetailMasked: z.string().nullable(),
});

export type AdminMasterDataSyncRun = z.infer<typeof adminMasterDataSyncRunSchema>;

export const listAdminMasterDataSyncRunsResponseSchema = z.object({
  data: z.array(adminMasterDataSyncRunSchema),
});

export type ListAdminMasterDataSyncRunsResponse = z.infer<
  typeof listAdminMasterDataSyncRunsResponseSchema
>;
