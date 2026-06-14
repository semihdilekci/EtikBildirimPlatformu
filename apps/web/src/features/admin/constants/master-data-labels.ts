import type { AdminMasterDataSyncRun } from '@ethics/dto';

export const MASTER_DATA_SYNC_STATUS_LABELS: Record<AdminMasterDataSyncRun['status'], string> = {
  COMPLETED: 'Tamamlandı',
  FAILED: 'Başarısız',
  RUNNING: 'Çalışıyor',
};

export function getMasterDataSyncStatusColor(
  status: AdminMasterDataSyncRun['status'],
): 'success' | 'error' | 'warning' | 'default' {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
      return 'error';
    case 'RUNNING':
      return 'warning';
    default:
      return 'default';
  }
}

export function formatSyncDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) {
    return '—';
  }

  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (durationMs < 0) {
    return '—';
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${String(seconds)} sn`;
  }

  return `${String(minutes)} dk ${String(seconds)} sn`;
}
