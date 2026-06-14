/** notification_events.dispatch_status — Docs/02 §notification_events */
export const NOTIFICATION_DISPATCH_PENDING = 'PENDING' as const;
export const NOTIFICATION_DISPATCH_SENT = 'SENT' as const;
export const NOTIFICATION_DISPATCH_FAILED = 'FAILED' as const;
export const NOTIFICATION_DISPATCH_RETRYING = 'RETRYING' as const;
export const NOTIFICATION_DISPATCH_PERMANENTLY_FAILED = 'PERMANENTLY_FAILED' as const;

export const NOTIFICATION_DISPATCH_STATUSES = [
  NOTIFICATION_DISPATCH_PENDING,
  NOTIFICATION_DISPATCH_SENT,
  NOTIFICATION_DISPATCH_FAILED,
  NOTIFICATION_DISPATCH_RETRYING,
  NOTIFICATION_DISPATCH_PERMANENTLY_FAILED,
] as const;

/** PostgreSQL advisory lock — notification outbox dispatch job tekil çalıştırma */
export const NOTIFICATION_DISPATCH_ADVISORY_LOCK_KEY = 9_128_473;

/** Exponential backoff: 30s → 60s → 120s (Docs/04 §Retry/backoff) */
export const NOTIFICATION_DISPATCH_RETRY_BACKOFF_MS = [30_000, 60_000, 120_000] as const;

export const NOTIFICATION_DISPATCH_DEFAULT_MAX_RETRY_COUNT = 3;

export function getNotificationRetryBackoffMs(retryCount: number): number {
  if (retryCount <= 0) {
    return 0;
  }

  const index = Math.min(retryCount - 1, NOTIFICATION_DISPATCH_RETRY_BACKOFF_MS.length - 1);
  return NOTIFICATION_DISPATCH_RETRY_BACKOFF_MS[index] ?? 120_000;
}
