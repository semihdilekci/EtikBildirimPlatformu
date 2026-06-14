import type {
  ActionMatrixListItem,
  ApproveActionMatrixBatchBody,
  ApproveActionMatrixBatchResponse,
  ApproveFieldVisibilityBatchBody,
  ApproveFieldVisibilityBatchResponse,
  ApproveSystemSettingBatchBody,
  ApproveSystemSettingBatchResponse,
  FieldVisibilityMatrixResponse,
  SystemSettingChangeProposal,
  SystemSettingListItem,
  UpdateActionMatrixBody,
  UpdateFieldVisibilityBody,
  UpdateSystemSettingBody,
} from '@ethics/dto';

import { apiClient } from '@/api/client';
import type { ApiSuccessEnvelope } from '@/types/api.types';

export async function fetchSystemSettings(): Promise<SystemSettingListItem[]> {
  const response =
    await apiClient.get<ApiSuccessEnvelope<SystemSettingListItem[]>>('/admin/system-settings');
  return response.data.data;
}

export async function updateSystemSetting(
  key: string,
  body: UpdateSystemSettingBody,
): Promise<SystemSettingChangeProposal> {
  const response = await apiClient.patch<ApiSuccessEnvelope<SystemSettingChangeProposal>>(
    `/admin/system-settings/${encodeURIComponent(key)}`,
    body,
  );
  return response.data.data;
}

export async function approveSystemSettingBatch(
  batchId: string,
  body: ApproveSystemSettingBatchBody,
): Promise<ApproveSystemSettingBatchResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<ApproveSystemSettingBatchResponse>>(
    `/admin/system-settings/batches/${batchId}/approve`,
    body,
  );
  return response.data.data;
}

export async function fetchFieldVisibilityMatrix(): Promise<FieldVisibilityMatrixResponse> {
  const response =
    await apiClient.get<ApiSuccessEnvelope<FieldVisibilityMatrixResponse>>(
      '/admin/field-visibility',
    );
  return response.data.data;
}

export async function updateFieldVisibility(
  body: UpdateFieldVisibilityBody,
): Promise<{ batchId: string; status: string }> {
  const response = await apiClient.patch<ApiSuccessEnvelope<{ batchId: string; status: string }>>(
    '/admin/field-visibility',
    body,
  );
  return response.data.data;
}

export async function approveFieldVisibilityBatch(
  batchId: string,
  body: ApproveFieldVisibilityBatchBody,
): Promise<ApproveFieldVisibilityBatchResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<ApproveFieldVisibilityBatchResponse>>(
    `/admin/field-visibility/batches/${batchId}/approve`,
    body,
  );
  return response.data.data;
}

export async function fetchActionMatrix(): Promise<ActionMatrixListItem[]> {
  const response =
    await apiClient.get<ApiSuccessEnvelope<ActionMatrixListItem[]>>('/admin/action-matrix');
  return response.data.data;
}

export async function updateActionMatrixRow(
  actionId: string,
  body: UpdateActionMatrixBody,
): Promise<{ batchId: string; status: string }> {
  const response = await apiClient.patch<ApiSuccessEnvelope<{ batchId: string; status: string }>>(
    `/admin/action-matrix/${encodeURIComponent(actionId)}`,
    body,
  );
  return response.data.data;
}

export async function approveActionMatrixBatch(
  batchId: string,
  body: ApproveActionMatrixBatchBody,
): Promise<ApproveActionMatrixBatchResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<ApproveActionMatrixBatchResponse>>(
    `/admin/action-matrix/batches/${batchId}/approve`,
    body,
  );
  return response.data.data;
}
