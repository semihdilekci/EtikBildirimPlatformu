/** SLA penceresinde kalan süre bu oranın altına düşünce WARNING — FE ile aynı mantık. */
export const SLA_WARNING_REMAINING_RATIO = 0.2;

export type SlaWindowPhase = 'ON_TRACK' | 'WARNING' | 'OVERDUE';

export interface SlaWindowInput {
  dueAt: Date;
  createdAt: Date;
}

export function resolveSlaWindowPhase(
  input: SlaWindowInput,
  nowMs: number = Date.now(),
): SlaWindowPhase {
  const dueMs = input.dueAt.getTime();
  const createdMs = input.createdAt.getTime();

  if (Number.isNaN(dueMs) || Number.isNaN(createdMs)) {
    return 'ON_TRACK';
  }

  if (nowMs > dueMs) {
    return 'OVERDUE';
  }

  const totalWindowMs = dueMs - createdMs;
  if (totalWindowMs <= 0) {
    return 'ON_TRACK';
  }

  const remainingMs = dueMs - nowMs;
  const remainingRatio = remainingMs / totalWindowMs;

  if (remainingRatio <= SLA_WARNING_REMAINING_RATIO) {
    return 'WARNING';
  }

  return 'ON_TRACK';
}
