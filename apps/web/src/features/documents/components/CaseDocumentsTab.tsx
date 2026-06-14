import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import {
  Alert,
  Box,
  Button,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { PermissionCode } from '@ethics/policy';
import type { CaseDocumentListItem } from '@ethics/dto';
import type {
  DocumentCategoryCode,
  DocumentStatusCode,
  MalwareScanStatusCode,
} from '@ethics/shared';
import { useState } from 'react';

import { PermissionGate } from '@/features/auth/components/PermissionGate';
import { formatCaseDateTime } from '@/features/cases/utils/case-format.util';
import { DocumentStatusBadge } from '@/features/documents/components/DocumentStatusBadge';
import { DocumentUploadDialog } from '@/features/documents/components/DocumentUploadDialog';
import { FileViewer } from '@/features/documents/components/FileViewer';
import { getDocumentCategoryLabel } from '@/features/documents/constants/document-category-labels';
import {
  isDocumentRowMuted,
  resolveDocumentDisplayStatus,
} from '@/features/documents/constants/document-status-config';
import { useCaseDocumentsQuery } from '@/features/documents/hooks/useDocuments';

type CaseDocumentsTabProps = {
  caseId: string;
  onToast: (message: string, severity: 'success' | 'error') => void;
};

export function CaseDocumentsTab({ caseId, onToast }: CaseDocumentsTabProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const documentsQuery = useCaseDocumentsQuery(caseId);

  if (documentsQuery.isPending) {
    return (
      <Stack spacing={2}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} variant="rounded" height={56} />
        ))}
      </Stack>
    );
  }

  if (documentsQuery.isError) {
    return (
      <Alert
        severity="error"
        action={
          <Typography
            component="button"
            variant="body2"
            onClick={() => {
              void documentsQuery.refetch();
            }}
            sx={{ border: 0, background: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Tekrar Dene
          </Typography>
        }
      >
        Doküman listesi yüklenemedi.
      </Alert>
    );
  }

  const documents = documentsQuery.data;

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        <Typography variant="h6" component="h2">
          Vaka Dokümanları
        </Typography>

        <PermissionGate permission={PermissionCode.DOCUMENT_UPLOAD}>
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            onClick={() => {
              setUploadDialogOpen(true);
            }}
          >
            Doküman Yükle
          </Button>
        </PermissionGate>
      </Stack>

      {documents.length === 0 ? (
        <Alert severity="info" role="status">
          Bu vakaya ait doküman bulunmuyor.
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Vaka dokümanları">
            <TableHead>
              <TableRow>
                <TableCell scope="col">Doküman Adı</TableCell>
                <TableCell scope="col">Kategori</TableCell>
                <TableCell scope="col">Versiyon</TableCell>
                <TableCell scope="col">Durum</TableCell>
                <TableCell scope="col">Yüklenme</TableCell>
                <TableCell scope="col">Yükleyen</TableCell>
                <TableCell scope="col" align="right">
                  İşlem
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  onDownloadError={(message) => {
                    onToast(message, 'error');
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <DocumentUploadDialog
        caseId={caseId}
        open={uploadDialogOpen}
        onClose={() => {
          setUploadDialogOpen(false);
        }}
        onSuccess={(message) => {
          onToast(message, 'success');
        }}
        onError={(message) => {
          onToast(message, 'error');
        }}
      />
    </Stack>
  );
}

type DocumentRowProps = {
  document: CaseDocumentListItem;
  onDownloadError: (message: string) => void;
};

function DocumentRow({ document, onDownloadError }: DocumentRowProps) {
  const displayStatus = resolveDocumentDisplayStatus(
    document.status as DocumentStatusCode,
    document.malwareScanStatus as MalwareScanStatusCode,
  );
  const isMuted = isDocumentRowMuted(displayStatus);

  return (
    <TableRow
      sx={{
        opacity: isMuted ? 0.72 : 1,
        bgcolor: isMuted ? 'action.hover' : 'inherit',
      }}
    >
      <TableCell>
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {document.title}
          </Typography>
        </Box>
      </TableCell>
      <TableCell>
        {getDocumentCategoryLabel(document.documentCategory as DocumentCategoryCode)}
      </TableCell>
      <TableCell>v{document.currentVersionNo}</TableCell>
      <TableCell>
        <DocumentStatusBadge
          status={document.status as DocumentStatusCode}
          malwareScanStatus={document.malwareScanStatus as MalwareScanStatusCode}
        />
      </TableCell>
      <TableCell>{formatCaseDateTime(document.uploadedAt)}</TableCell>
      <TableCell>{document.uploadedByDisplayName ?? '—'}</TableCell>
      <TableCell align="right">
        <FileViewer
          documentId={document.id}
          documentTitle={document.title}
          canDownload={document.canDownload}
          onError={onDownloadError}
        />
      </TableCell>
    </TableRow>
  );
}
