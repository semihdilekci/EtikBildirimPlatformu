import { z } from 'zod';

export const adminSystemHealthWorkerSchema = z.object({
  name: z.string(),
  status: z.enum(['RUNNING', 'STOPPED', 'ERROR', 'UNKNOWN']),
  lastRunAt: z.string().nullable(),
  pendingCount: z.number(),
  failedCount: z.number(),
});

export const adminSystemHealthSyncStatusSchema = z.object({
  hrSapLastSync: z.string().nullable(),
  hrSapStatus: z.enum(['COMPLETED', 'FAILED', 'RUNNING', 'UNKNOWN']),
});

export const adminSystemHealthComponentSchema = z.object({
  name: z.string(),
  status: z.enum(['UP', 'DOWN', 'DEGRADED', 'UNKNOWN']),
});

export const adminSystemHealthResponseSchema = z.object({
  components: z.array(adminSystemHealthComponentSchema),
  workers: z.array(adminSystemHealthWorkerSchema),
  syncStatus: adminSystemHealthSyncStatusSchema,
  outboxDepth: z.object({
    auditPending: z.number(),
    auditFailed: z.number(),
    notificationPending: z.number(),
    notificationFailed: z.number(),
  }),
  checkedAt: z.string(),
});

export type AdminSystemHealthWorker = z.infer<typeof adminSystemHealthWorkerSchema>;
export type AdminSystemHealthSyncStatus = z.infer<typeof adminSystemHealthSyncStatusSchema>;
export type AdminSystemHealthComponent = z.infer<typeof adminSystemHealthComponentSchema>;
export type AdminSystemHealthResponse = z.infer<typeof adminSystemHealthResponseSchema>;
