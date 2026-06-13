export const MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024;

export const MAX_TOTAL_REPORT_ATTACHMENT_BYTES = 200 * 1024 * 1024;

export const PRESIGNED_UPLOAD_TTL_SECONDS = 300;

export type AllowedUploadRule = {
  readonly extension: string;
  readonly mimeTypes: readonly string[];
};

/** MIME + uzantı eşleşmesi zorunlu — Docs/07 §5.2 */
export const ALLOWED_UPLOAD_RULES: readonly AllowedUploadRule[] = [
  { extension: 'pdf', mimeTypes: ['application/pdf'] },
  {
    extension: 'docx',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
  {
    extension: 'xlsx',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  },
  { extension: 'jpg', mimeTypes: ['image/jpeg'] },
  { extension: 'jpeg', mimeTypes: ['image/jpeg'] },
  { extension: 'png', mimeTypes: ['image/png'] },
  { extension: 'mp4', mimeTypes: ['video/mp4'] },
  { extension: 'mov', mimeTypes: ['video/quicktime'] },
  { extension: 'zip', mimeTypes: ['application/zip', 'application/x-zip-compressed'] },
  { extension: 'txt', mimeTypes: ['text/plain'] },
] as const;
