/** Cron periyodu — Faz 8 notification dispatch ile birlikte aktifleşir (Docs/04 §sla_reminder) */
export const SLA_REMINDER_CRON_INTERVAL_MS = 5 * 60 * 1000;

export interface SlaReminderProcessResult {
  tasksScanned: number;
  warningsCreated: number;
}

export type SlaReminderJobResult = SlaReminderProcessResult;

/**
 * Worker cron job placeholder — Faz 8'de SLA_WARNING bildirim dispatch bağlanır.
 * setInterval yasak; main poll döngüsünde runIfDue çağrılır.
 */
export class SlaReminderJob {
  private lastRunAt = 0;

  constructor(
    private readonly runHandler: () => Promise<SlaReminderProcessResult>,
    private readonly intervalMs: number = SLA_REMINDER_CRON_INTERVAL_MS,
  ) {}

  async runIfDue(nowMs: number = Date.now()): Promise<SlaReminderJobResult | null> {
    if (this.lastRunAt > 0 && nowMs - this.lastRunAt < this.intervalMs) {
      return null;
    }

    this.lastRunAt = nowMs;
    return this.runHandler();
  }
}
