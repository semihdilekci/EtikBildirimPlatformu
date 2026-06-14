import type {
  CreateReportBody,
  CreateReportResponse,
  InitiateAttachmentBody,
  InitiateAttachmentResponse,
  IntakeCompanyListItem,
  IntakeKvkkTextResponse,
} from '@ethics/dto';
import type { ReportCategoryCatalogEntry } from '@ethics/shared';

import { apiClient } from '@/api/client';
import { uploadToPresignedUrl as uploadFileToPresignedUrl } from '@/api/upload.util';
import type { ApiSuccessEnvelope } from '@/types/api.types';

export async function fetchIntakeCategories(): Promise<ReportCategoryCatalogEntry[]> {
  const response =
    await apiClient.get<ApiSuccessEnvelope<ReportCategoryCatalogEntry[]>>('/intake/categories');
  return response.data.data;
}

export async function fetchIntakeCompanies(): Promise<IntakeCompanyListItem[]> {
  const response =
    await apiClient.get<ApiSuccessEnvelope<IntakeCompanyListItem[]>>('/intake/companies');
  return response.data.data;
}

export async function fetchIntakeKvkkText(): Promise<IntakeKvkkTextResponse> {
  const response =
    await apiClient.get<ApiSuccessEnvelope<IntakeKvkkTextResponse>>('/intake/kvkk-text');
  return response.data.data;
}

export async function createIntakeReport(body: CreateReportBody): Promise<CreateReportResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<CreateReportResponse>>(
    '/intake/reports',
    body,
  );
  return response.data.data;
}

export async function initiateReportAttachment(
  trackingCode: string,
  body: InitiateAttachmentBody,
): Promise<InitiateAttachmentResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<InitiateAttachmentResponse>>(
    `/intake/reports/${encodeURIComponent(trackingCode)}/attachments`,
    body,
  );
  return response.data.data;
}

export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
  mimeType: string,
): Promise<void> {
  await uploadFileToPresignedUrl(uploadUrl, file, mimeType);
}
