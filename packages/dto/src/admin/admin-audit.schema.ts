import { z } from 'zod';

import { AUDIT_EVENT_TYPE_VALUES } from '@ethics/shared';

const auditEventTypeSchema = z.enum(AUDIT_EVENT_TYPE_VALUES as [string, ...string[]]);

export const listAdminAuditEventsQuerySchema = z.object({
  eventType: auditEventTypeSchema.optional(),
  actorUserId: z.string().min(1).optional(),
  resourceType: z.string().min(1).max(50).optional(),
  resourceId: z.string().min(1).max(100).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional(),
});

export const adminAuditEventItemSchema = z.object({
  id: z.string(),
  occurredAt: z.string(),
  recordedAt: z.string(),
  eventType: z.string(),
  eventCategory: z.string(),
  severity: z.string(),
  actorType: z.string(),
  actorId: z.string().nullable(),
  action: z.string(),
  outcome: z.string(),
  correlationId: z.string().nullable(),
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
});

export const listAdminAuditEventsResponseSchema = z.object({
  items: z.array(adminAuditEventItemSchema),
  nextCursor: z.string().nullable(),
});

export const requestAdminAuditExportBodySchema = listAdminAuditEventsQuerySchema
  .omit({ limit: true, cursor: true })
  .extend({
    reason: z.string().trim().min(3).max(500),
  });

export const adminAuditExportJobSchema = z.object({
  id: z.string(),
  status: z.string(),
  exportType: z.string(),
  rowCount: z.number().nullable(),
  downloadUrl: z.string().nullable(),
  downloadUrlExpiresAt: z.string().nullable(),
  errorCode: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

export const adminAuditChainVerifyResponseSchema = z.object({
  valid: z.boolean(),
  eventCount: z.number(),
  brokenAtEventId: z.string().optional(),
  verifiedAt: z.string(),
});

export type ListAdminAuditEventsQuery = z.infer<typeof listAdminAuditEventsQuerySchema>;
export type AdminAuditEventItem = z.infer<typeof adminAuditEventItemSchema>;
export type ListAdminAuditEventsResponse = z.infer<typeof listAdminAuditEventsResponseSchema>;
export type RequestAdminAuditExportBody = z.infer<typeof requestAdminAuditExportBodySchema>;
export type AdminAuditExportJob = z.infer<typeof adminAuditExportJobSchema>;
export type AdminAuditChainVerifyResponse = z.infer<typeof adminAuditChainVerifyResponseSchema>;
