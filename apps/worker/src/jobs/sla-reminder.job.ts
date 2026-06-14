/** Cron periyodu — @ethics/shared worker-cron.constants */
export { SLA_REMINDER_CRON_INTERVAL_MS } from '@ethics/shared';

export interface SlaReminderProcessResult {
  tasksScanned: number;
  warningsCreated: number;
  breachesCreated: number;
}

export type SlaReminderJobResult = SlaReminderProcessResult;

/**
 * Worker cron job — SLA ≤%20 kalan görevler için SLA_WARNING; aşımda SLA_BREACH.
 * setInterval yasak; main poll döngüsünde runIfDue çağrılır.
 */
export class SlaReminderJob {
  private lastRunAt = 0;

  constructor(
    private readonly runHandler: () => Promise<SlaReminderProcessResult>,
    private readonly intervalMs: number,
  ) {}

  async runIfDue(nowMs: number = Date.now()): Promise<SlaReminderJobResult | null> {
    if (this.lastRunAt > 0 && nowMs - this.lastRunAt < this.intervalMs) {
      return null;
    }

    this.lastRunAt = nowMs;
    return this.runHandler();
  }
}
