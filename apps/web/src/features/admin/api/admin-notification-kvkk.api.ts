import type {
  ApproveKvkkTextBatchBody,
  ApproveKvkkTextBatchResponse,
  ApproveNotificationTemplateBatchBody,
  ApproveNotificationTemplateBatchResponse,
  CreateKvkkTextBody,
  KvkkTextListItem,
  NotificationTemplateListItem,
  PreviewNotificationTemplateBody,
  PreviewNotificationTemplateResponse,
  SendTestNotificationTemplateBody,
  SendTestNotificationTemplateResponse,
  UpdateNotificationTemplateBody,
} from '@ethics/dto';

import { apiClient } from '@/api/client';
import type { ApiSuccessEnvelope } from '@/types/api.types';

export async function fetchNotificationTemplates(): Promise<NotificationTemplateListItem[]> {
  const response = await apiClient.get<ApiSuccessEnvelope<NotificationTemplateListItem[]>>(
    '/admin/notification-templates',
  );
  return response.data.data;
}

export async function updateNotificationTemplate(
  templateCode: string,
  body: UpdateNotificationTemplateBody,
): Promise<{ batchId: string; status: string }> {
  const response = await apiClient.patch<ApiSuccessEnvelope<{ batchId: string; status: string }>>(
    `/admin/notification-templates/${encodeURIComponent(templateCode)}`,
    body,
  );
  return response.data.data;
}

export async function approveNotificationTemplateBatch(
  batchId: string,
  body: ApproveNotificationTemplateBatchBody,
): Promise<ApproveNotificationTemplateBatchResponse> {
  const response = await apiClient.post<
    ApiSuccessEnvelope<ApproveNotificationTemplateBatchResponse>
  >(`/admin/notification-templates/batches/${batchId}/approve`, body);
  return response.data.data;
}

export async function previewNotificationTemplate(
  templateCode: string,
  body: PreviewNotificationTemplateBody,
): Promise<PreviewNotificationTemplateResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<PreviewNotificationTemplateResponse>>(
    `/admin/notification-templates/preview/${encodeURIComponent(templateCode)}`,
    body,
  );
  return response.data.data;
}

export async function sendTestNotificationTemplate(
  templateCode: string,
  body: SendTestNotificationTemplateBody,
): Promise<SendTestNotificationTemplateResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<SendTestNotificationTemplateResponse>>(
    `/admin/notification-templates/send-test/${encodeURIComponent(templateCode)}`,
    body,
  );
  return response.data.data;
}

export async function fetchKvkkTexts(): Promise<KvkkTextListItem[]> {
  const response = await apiClient.get<ApiSuccessEnvelope<KvkkTextListItem[]>>('/admin/kvkk-texts');
  return response.data.data;
}

export async function createKvkkText(
  body: CreateKvkkTextBody,
): Promise<{ batchId: string; status: string }> {
  const response = await apiClient.post<ApiSuccessEnvelope<{ batchId: string; status: string }>>(
    '/admin/kvkk-texts',
    body,
  );
  return response.data.data;
}

export async function approveKvkkTextBatch(
  batchId: string,
  body: ApproveKvkkTextBatchBody,
): Promise<ApproveKvkkTextBatchResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<ApproveKvkkTextBatchResponse>>(
    `/admin/kvkk-texts/batches/${batchId}/approve`,
    body,
  );
  return response.data.data;
}
