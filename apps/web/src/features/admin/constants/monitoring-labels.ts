import { MalwareScanStatus } from '@ethics/shared';

export const MALWARE_SCAN_STATUS_LABELS: Record<string, string> = {
  [MalwareScanStatus.PENDING]: 'Bekliyor',
  [MalwareScanStatus.CLEAN]: 'Temiz',
  [MalwareScanStatus.QUARANTINED]: 'Karantina',
  [MalwareScanStatus.REJECTED]: 'Reddedildi',
};

export function getMalwareScanStatusLabel(status: string): string {
  return MALWARE_SCAN_STATUS_LABELS[status] ?? status;
}

export function getMalwareScanStatusColor(
  status: string,
): 'default' | 'success' | 'warning' | 'error' {
  switch (status) {
    case MalwareScanStatus.CLEAN:
      return 'success';
    case MalwareScanStatus.QUARANTINED:
      return 'warning';
    case MalwareScanStatus.REJECTED:
      return 'error';
    case MalwareScanStatus.PENDING:
    default:
      return 'default';
  }
}

export const SYSTEM_HEALTH_COMPONENT_LABELS: Record<string, string> = {
  database: 'Veritabanı',
  object_storage: 'Nesne Depolama',
  smtp: 'SMTP',
};

export const SYSTEM_HEALTH_WORKER_LABELS: Record<string, string> = {
  outbox_processor: 'Outbox İşleyici',
  notification_dispatcher: 'Bildirim Dağıtıcı',
  malware_scanner: 'Malware Tarayıcı',
  sla_checker: 'SLA Kontrol',
  silent_acceptance: 'Sessiz Kabul',
  retention_worker: 'Saklama Worker',
  hr_sync_worker: 'HR/SAP Senkron',
};

export function getWorkerStatusColor(status: string): 'default' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'RUNNING':
      return 'success';
    case 'ERROR':
      return 'error';
    case 'STOPPED':
      return 'warning';
    default:
      return 'default';
  }
}

export function getComponentStatusColor(
  status: string,
): 'success' | 'error' | 'warning' | 'default' {
  switch (status) {
    case 'UP':
      return 'success';
    case 'DOWN':
      return 'error';
    case 'DEGRADED':
      return 'warning';
    default:
      return 'default';
  }
}

export function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${String(sizeBytes)} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
