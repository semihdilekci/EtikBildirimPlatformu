import { NOTIFICATION_TEMPLATE_CODE_VALUES } from '@ethics/shared';
import { z } from 'zod';

export const notificationTemplateConfigSnapshotSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subjectTemplate: z.string().trim().max(200).nullable(),
  bodyTemplate: z.string().trim().min(1).max(10_000),
  isActive: z.boolean(),
});

export type NotificationTemplateConfigSnapshot = z.infer<
  typeof notificationTemplateConfigSnapshotSchema
>;

export const notificationTemplateCodeParamSchema = z.enum(
  NOTIFICATION_TEMPLATE_CODE_VALUES as [string, ...string[]],
);

export type NotificationTemplateCodeParam = z.infer<typeof notificationTemplateCodeParamSchema>;

export const updateNotificationTemplateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    subjectTemplate: z.string().trim().max(200).nullable().optional(),
    bodyTemplate: z.string().trim().min(1).max(10_000).optional(),
    isActive: z.boolean().optional(),
    reason: z.string().trim().min(3).max(500),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.subjectTemplate !== undefined ||
      body.bodyTemplate !== undefined ||
      body.isActive !== undefined,
    { message: 'En az bir şablon alanı güncellenmelidir.' },
  );

export type UpdateNotificationTemplateBody = z.infer<typeof updateNotificationTemplateBodySchema>;

export const approveNotificationTemplateBatchBodySchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

export type ApproveNotificationTemplateBatchBody = z.infer<
  typeof approveNotificationTemplateBatchBodySchema
>;

export const previewNotificationTemplateBodySchema = z.object({
  subjectTemplate: z.string().trim().max(200).nullable().optional(),
  bodyTemplate: z.string().trim().min(1).max(10_000),
});

export type PreviewNotificationTemplateBody = z.infer<typeof previewNotificationTemplateBodySchema>;

export const sendTestNotificationTemplateBodySchema = previewNotificationTemplateBodySchema.extend({
  recipientEmail: z.string().trim().email().max(254),
});

export type SendTestNotificationTemplateBody = z.infer<
  typeof sendTestNotificationTemplateBodySchema
>;

export const notificationTemplateListItemSchema = z.object({
  templateCode: z.enum(NOTIFICATION_TEMPLATE_CODE_VALUES as [string, ...string[]]),
  name: z.string(),
  channel: z.string(),
  subjectTemplate: z.string().nullable(),
  bodyTemplate: z.string(),
  isActive: z.boolean(),
  versionNo: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  pendingBatchId: z.string().nullable(),
});

export type NotificationTemplateListItem = z.infer<typeof notificationTemplateListItemSchema>;

export const notificationTemplateChangeProposalSchema = z.object({
  batchId: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  reason: z.string(),
  requestedBy: z.string(),
  requestedAt: z.string().datetime(),
  items: z.array(
    z.object({
      templateCode: z.enum(NOTIFICATION_TEMPLATE_CODE_VALUES as [string, ...string[]]),
      currentConfig: notificationTemplateConfigSnapshotSchema,
      proposedConfig: notificationTemplateConfigSnapshotSchema,
    }),
  ),
});

export type NotificationTemplateChangeProposal = z.infer<
  typeof notificationTemplateChangeProposalSchema
>;

export const approveNotificationTemplateBatchResponseSchema = z.object({
  batchId: z.string(),
  status: z.enum(['APPROVED', 'REJECTED']),
  appliedTemplateCodes: z.array(z.enum(NOTIFICATION_TEMPLATE_CODE_VALUES as [string, ...string[]])),
});

export type ApproveNotificationTemplateBatchResponse = z.infer<
  typeof approveNotificationTemplateBatchResponseSchema
>;

export const previewNotificationTemplateResponseSchema = z.object({
  subject: z.string(),
  textBody: z.string(),
  htmlBody: z.string(),
});

export type PreviewNotificationTemplateResponse = z.infer<
  typeof previewNotificationTemplateResponseSchema
>;

export const sendTestNotificationTemplateResponseSchema = z.object({
  messageId: z.string(),
  recipientEmail: z.string().email(),
});

export type SendTestNotificationTemplateResponse = z.infer<
  typeof sendTestNotificationTemplateResponseSchema
>;
