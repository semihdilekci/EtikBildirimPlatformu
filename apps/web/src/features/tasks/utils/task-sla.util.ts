export type SlaDisplayStatus = 'ON_TRACK' | 'WARNING' | 'OVERDUE';

export interface SlaTimingInput {
  dueAt: string | null;
  createdAt: string;
  slaStatus?: SlaDisplayStatus | null;
}

const WARNING_REMAINING_RATIO = 0.2;

export function resolveSlaDisplayStatus(
  input: SlaTimingInput,
  nowMs = Date.now(),
): SlaDisplayStatus | null {
  if (!input.dueAt) {
    return null;
  }

  const dueMs = new Date(input.dueAt).getTime();
  const createdMs = new Date(input.createdAt).getTime();

  if (Number.isNaN(dueMs) || Number.isNaN(createdMs)) {
    return input.slaStatus ?? null;
  }

  if (nowMs > dueMs) {
    return 'OVERDUE';
  }

  const totalWindowMs = dueMs - createdMs;
  if (totalWindowMs <= 0) {
    return input.slaStatus ?? 'ON_TRACK';
  }

  const remainingMs = dueMs - nowMs;
  const remainingRatio = remainingMs / totalWindowMs;

  if (remainingRatio <= WARNING_REMAINING_RATIO) {
    return 'WARNING';
  }

  return 'ON_TRACK';
}

export function formatSlaRemainingText(input: SlaTimingInput, nowMs = Date.now()): string | null {
  if (!input.dueAt) {
    return null;
  }

  const dueMs = new Date(input.dueAt).getTime();
  if (Number.isNaN(dueMs)) {
    return null;
  }

  const diffMs = dueMs - nowMs;
  const absMs = Math.abs(diffMs);
  const isOverdue = diffMs < 0;

  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;

  if (absMs >= dayMs) {
    const days = Math.ceil(absMs / dayMs);
    return isOverdue ? `${String(days)} gün aşım` : `${String(days)} gün kaldı`;
  }

  if (absMs >= hourMs) {
    const hours = Math.ceil(absMs / hourMs);
    return isOverdue ? `${String(hours)} saat aşım` : `${String(hours)} saat kaldı`;
  }

  const minutes = Math.max(1, Math.ceil(absMs / (60 * 1000)));
  return isOverdue ? `${String(minutes)} dk aşım` : `${String(minutes)} dk kaldı`;
}

export function getSlaChipColor(
  status: SlaDisplayStatus | null,
): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'ON_TRACK':
      return 'success';
    case 'WARNING':
      return 'warning';
    case 'OVERDUE':
      return 'error';
    default:
      return 'default';
  }
}

export function getSlaStatusLabel(status: SlaDisplayStatus | null): string {
  switch (status) {
    case 'ON_TRACK':
      return 'Zamanında';
    case 'WARNING':
      return 'Uyarı';
    case 'OVERDUE':
      return 'Aşım';
    default:
      return '—';
  }
}
