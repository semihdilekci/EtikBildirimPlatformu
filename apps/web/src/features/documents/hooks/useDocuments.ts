import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InitiateCaseDocumentBody } from '@ethics/dto';
import { DocumentStatus, MalwareScanStatus } from '@ethics/shared';

import { queryKeys } from '@/api/query-keys';
import {
  fetchCaseDocuments,
  fetchDocumentDownloadUrl,
  uploadCaseDocumentWithProgress,
} from '@/features/documents/api/documents.api';

const THIRTY_SECONDS_MS = 30 * 1000;

function hasPendingScanDocuments(
  documents: Awaited<ReturnType<typeof fetchCaseDocuments>> | undefined,
): boolean {
  if (!documents) {
    return false;
  }

  return documents.some(
    (document) =>
      document.status === DocumentStatus.QUARANTINED ||
      document.malwareScanStatus === MalwareScanStatus.PENDING ||
      document.malwareScanStatus === MalwareScanStatus.QUARANTINED,
  );
}

export function useCaseDocumentsQuery(caseId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.cases.documents(caseId),
    queryFn: () => fetchCaseDocuments(caseId),
    enabled: Boolean(caseId) && enabled,
    staleTime: THIRTY_SECONDS_MS,
    refetchInterval: (query) =>
      hasPendingScanDocuments(query.state.data) ? THIRTY_SECONDS_MS : false,
  });
}

export function useUploadCaseDocumentMutation(caseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      body: InitiateCaseDocumentBody;
      file: File;
      onProgress?: (percent: number) => void;
    }) => uploadCaseDocumentWithProgress(caseId, params.body, params.file, params.onProgress),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cases.documents(caseId) });
    },
  });
}

export function useDocumentDownloadMutation() {
  return useMutation({
    mutationFn: (documentId: string) => fetchDocumentDownloadUrl(documentId),
  });
}
