import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { Button, CircularProgress } from '@mui/material';
import { useState } from 'react';

import { useDocumentDownloadMutation } from '@/features/documents/hooks/useDocuments';
import { getDocumentErrorMessage } from '@/features/documents/utils/document-error.util';

type FileViewerProps = {
  documentId: string;
  documentTitle: string;
  canDownload: boolean;
  onError?: (message: string) => void;
};

export function FileViewer({ documentId, documentTitle, canDownload, onError }: FileViewerProps) {
  const downloadMutation = useDocumentDownloadMutation();
  const [isOpening, setIsOpening] = useState(false);

  if (!canDownload) {
    return null;
  }

  const handleDownload = async () => {
    setIsOpening(true);

    try {
      const result = await downloadMutation.mutateAsync(documentId);
      const anchor = document.createElement('a');
      anchor.href = result.downloadUrl;
      anchor.download = result.filename;
      anchor.rel = 'noopener noreferrer';
      anchor.target = '_blank';
      anchor.click();
    } catch (error) {
      onError?.(getDocumentErrorMessage(error, 'Doküman indirilemedi.'));
    } finally {
      setIsOpening(false);
    }
  };

  const isLoading = isOpening || downloadMutation.isPending;

  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={
        isLoading ? <CircularProgress size={16} color="inherit" /> : <DownloadOutlinedIcon />
      }
      disabled={isLoading}
      onClick={() => {
        void handleDownload();
      }}
      aria-label={`${documentTitle} dokümanını indir`}
    >
      İndir
    </Button>
  );
}
