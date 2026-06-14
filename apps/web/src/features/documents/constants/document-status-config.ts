import {
  DocumentStatus,
  MalwareScanStatus,
  type DocumentStatusCode,
  type MalwareScanStatusCode,
} from '@ethics/shared';

export type DocumentDisplayStatus = DocumentStatusCode | 'SCANNING';

export function resolveDocumentDisplayStatus(
  status: DocumentStatusCode,
  malwareScanStatus: MalwareScanStatusCode,
): DocumentDisplayStatus {
  if (status === DocumentStatus.REJECTED || malwareScanStatus === MalwareScanStatus.REJECTED) {
    return DocumentStatus.REJECTED;
  }

  if (
    status === DocumentStatus.QUARANTINED ||
    malwareScanStatus === MalwareScanStatus.PENDING ||
    malwareScanStatus === MalwareScanStatus.QUARANTINED
  ) {
    return 'SCANNING';
  }

  return status;
}

export function getDocumentStatusLabel(displayStatus: DocumentDisplayStatus): string {
  switch (displayStatus) {
    case DocumentStatus.AVAILABLE:
      return 'Kullanılabilir';
    case DocumentStatus.REJECTED:
      return 'Reddedildi — zararlı içerik tespit edildi';
    case 'SCANNING':
      return 'Taranıyor';
    case DocumentStatus.UPLOADED:
      return 'Yükleniyor';
    case DocumentStatus.QUARANTINED:
      return 'Taranıyor';
    default:
      return displayStatus;
  }
}

export function getDocumentStatusChipColor(
  displayStatus: DocumentDisplayStatus,
): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  switch (displayStatus) {
    case DocumentStatus.AVAILABLE:
      return 'success';
    case DocumentStatus.REJECTED:
      return 'error';
    case 'SCANNING':
    case DocumentStatus.QUARANTINED:
    case DocumentStatus.UPLOADED:
      return 'warning';
    default:
      return 'default';
  }
}

export function isDocumentRowMuted(displayStatus: DocumentDisplayStatus): boolean {
  return displayStatus === 'SCANNING' || displayStatus === DocumentStatus.REJECTED;
}
