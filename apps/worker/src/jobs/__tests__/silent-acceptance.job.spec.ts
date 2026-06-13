import { describe, expect, it, vi } from 'vitest';

import {
  SILENT_ACCEPTANCE_CRON_INTERVAL_MS,
  SilentAcceptanceJob,
} from '../silent-acceptance.job.js';

describe('SilentAcceptanceJob', () => {
  it('cron periyodu dolmadan tekrar çalışmaz', async () => {
    const handler = vi.fn().mockResolvedValue({
      casesScanned: 1,
      silentVotesCreated: 0,
      casesAdvanced: 0,
    });
    const job = new SilentAcceptanceJob(handler, SILENT_ACCEPTANCE_CRON_INTERVAL_MS);

    const first = await job.runIfDue(1_000);
    const second = await job.runIfDue(1_000 + SILENT_ACCEPTANCE_CRON_INTERVAL_MS - 1);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('cron periyodu dolduğunda handler tekrar çalışır', async () => {
    const handler = vi.fn().mockResolvedValue({
      casesScanned: 0,
      silentVotesCreated: 0,
      casesAdvanced: 0,
    });
    const job = new SilentAcceptanceJob(handler, 100);

    await job.runIfDue(0);
    await job.runIfDue(100);

    expect(handler).toHaveBeenCalledTimes(2);
  });
});
