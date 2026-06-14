import type {
  CaseDocumentListItem,
  CompleteCaseDocumentUploadResponse,
  DocumentDownloadResponse,
  InitiateCaseDocumentBody,
  InitiateCaseDocumentResponse,
} from '@ethics/dto';

import { apiClient } from '@/api/client';
import { uploadToPresignedUrlWithProgress } from '@/api/upload.util';
import type { ApiSuccessEnvelope } from '@/types/api.types';

export async function fetchCaseDocuments(caseId: string): Promise<CaseDocumentListItem[]> {
  const response = await apiClient.get<ApiSuccessEnvelope<CaseDocumentListItem[]>>(
    `/cases/${encodeURIComponent(caseId)}/documents`,
  );
  return response.data.data;
}

export async function initiateCaseDocumentUpload(
  caseId: string,
  body: InitiateCaseDocumentBody,
): Promise<InitiateCaseDocumentResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<InitiateCaseDocumentResponse>>(
    `/cases/${encodeURIComponent(caseId)}/documents`,
    body,
  );
  return response.data.data;
}

export async function completeCaseDocumentUpload(
  caseId: string,
  documentId: string,
): Promise<CompleteCaseDocumentUploadResponse> {
  const response = await apiClient.post<ApiSuccessEnvelope<CompleteCaseDocumentUploadResponse>>(
    `/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(documentId)}/complete-upload`,
  );
  return response.data.data;
}

export async function fetchDocumentDownloadUrl(
  documentId: string,
): Promise<DocumentDownloadResponse> {
  const response = await apiClient.get<ApiSuccessEnvelope<DocumentDownloadResponse>>(
    `/documents/${encodeURIComponent(documentId)}/download`,
  );
  return response.data.data;
}

export async function uploadCaseDocumentWithProgress(
  caseId: string,
  body: InitiateCaseDocumentBody,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CompleteCaseDocumentUploadResponse> {
  const initiated = await initiateCaseDocumentUpload(caseId, body);
  await uploadToPresignedUrlWithProgress(initiated.uploadUrl, file, body.mimeType, onProgress);
  return completeCaseDocumentUpload(caseId, initiated.id);
}
