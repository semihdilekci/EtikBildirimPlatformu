/** Cron periyodu — Docs/04 §silent_acceptance (5 dk) */
export const SILENT_ACCEPTANCE_CRON_INTERVAL_MS = 5 * 60 * 1000;

export interface SilentAcceptanceProcessResult {
  casesScanned: number;
  silentVotesCreated: number;
  casesAdvanced: number;
}

export type SilentAcceptanceJobResult = SilentAcceptanceProcessResult;

/**
 * Worker cron job — periyodik sessiz kabul kontrolü.
 * Handler API runner üzerinden enjekte edilir; setInterval yasak (main poll döngüsü).
 */
export class SilentAcceptanceJob {
  private lastRunAt = 0;

  constructor(
    private readonly runHandler: () => Promise<SilentAcceptanceProcessResult>,
    private readonly intervalMs: number = SILENT_ACCEPTANCE_CRON_INTERVAL_MS,
  ) {}

  async runIfDue(nowMs: number = Date.now()): Promise<SilentAcceptanceJobResult | null> {
    if (this.lastRunAt > 0 && nowMs - this.lastRunAt < this.intervalMs) {
      return null;
    }

    this.lastRunAt = nowMs;
    return this.runHandler();
  }
}
