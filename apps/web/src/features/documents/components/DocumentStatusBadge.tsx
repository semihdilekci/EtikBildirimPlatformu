import { Chip } from '@mui/material';
import type { DocumentStatusCode, MalwareScanStatusCode } from '@ethics/shared';

import {
  getDocumentStatusChipColor,
  getDocumentStatusLabel,
  resolveDocumentDisplayStatus,
} from '@/features/documents/constants/document-status-config';

type DocumentStatusBadgeProps = {
  status: DocumentStatusCode;
  malwareScanStatus: MalwareScanStatusCode;
};

export function DocumentStatusBadge({ status, malwareScanStatus }: DocumentStatusBadgeProps) {
  const displayStatus = resolveDocumentDisplayStatus(status, malwareScanStatus);
  const label = getDocumentStatusLabel(displayStatus);

  return (
    <Chip
      size="small"
      color={getDocumentStatusChipColor(displayStatus)}
      label={label}
      aria-label={`Doküman durumu: ${label}`}
    />
  );
}
