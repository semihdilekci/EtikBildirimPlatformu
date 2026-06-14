/** Admin async export job tipleri */
export const AdminExportType = {
  AUDIT_EVENTS_CSV: 'AUDIT_EVENTS_CSV',
} as const;

export type AdminExportTypeCode = (typeof AdminExportType)[keyof typeof AdminExportType];

export const ADMIN_EXPORT_TYPE_VALUES = Object.values(AdminExportType);

export const AdminExportJobStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type AdminExportJobStatusCode =
  (typeof AdminExportJobStatus)[keyof typeof AdminExportJobStatus];

/** CSV export presigned URL TTL — 1 saat */
export const ADMIN_AUDIT_EXPORT_PRESIGNED_TTL_SECONDS = 3600;

/** Bu eşiğin üzerinde kayıt sayısı async job zorunlu (sync export yapılmaz) */
export const ADMIN_AUDIT_EXPORT_ASYNC_THRESHOLD = 10_000;

/** Tek export batch boyutu */
export const ADMIN_AUDIT_EXPORT_BATCH_SIZE = 500;
