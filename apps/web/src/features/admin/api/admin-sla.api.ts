import type {
  ApproveSlaPolicyBatchBody,
  ApproveSlaPolicyBatchResponse,
  BusinessCalendarEntryDto,
  CreateBusinessCalendarEntryBody,
  DeleteBusinessCalendarEntryBody,
  ListBusinessCalendarQuery,
  SlaPolicyListItem,
  UpdateSlaPolicyBody,
} from '@ethics/dto';

import { apiClient } from '@/api/client';
import type { ApiSuccessEnvelope } from '@/types/api.types';

export async function fetchSlaPolicies(): Promise<SlaPolicyListItem[]> {
  const response =
    await apiClient.get<ApiSuccessEnvelope<SlaPolicyListItem[]>>('/admin/sla-policies');
  return response.data.data;
}

export async function updateSlaPolicy(
  taskType: string,
  body: UpdateSlaPolicyBody,
): Promise<{ batchId: string; status: string }> {
  const response = await apiClient.patch<ApiSuccessEnvelope<{ batchId: string; status: string }>>(
    `/admin/sla-policies/${encodeURIComponent(taskType)}`,
    body,
  );
  return response.data.data;
}

export async function approveSlaPolicyBatch(
  batchId: string,
  body: ApproveSlaPolicyBatchBody,
): Promise<ApproveSlaPolicyBatchResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<ApproveSlaPolicyBatchResponse>>(
    `/admin/sla-policies/batches/${batchId}/approve`,
    body,
  );
  return response.data.data;
}

export async function fetchBusinessCalendar(
  query: ListBusinessCalendarQuery = {},
): Promise<BusinessCalendarEntryDto[]> {
  const response = await apiClient.get<ApiSuccessEnvelope<BusinessCalendarEntryDto[]>>(
    '/admin/business-calendar',
    { params: query },
  );
  return response.data.data;
}

export async function createBusinessCalendarEntry(
  body: CreateBusinessCalendarEntryBody,
): Promise<BusinessCalendarEntryDto> {
  const response = await apiClient.post<ApiSuccessEnvelope<BusinessCalendarEntryDto>>(
    '/admin/business-calendar',
    body,
  );
  return response.data.data;
}

export async function deleteBusinessCalendarEntry(
  entryId: string,
  body: DeleteBusinessCalendarEntryBody,
): Promise<void> {
  await apiClient.delete(`/admin/business-calendar/${entryId}`, { data: body });
}
