import { describe, expect, it, vi } from 'vitest';

import { SLA_REMINDER_CRON_INTERVAL_MS, SlaReminderJob } from '../sla-reminder.job.js';

describe('SlaReminderJob (placeholder)', () => {
  it('cron periyodu dolmadan tekrar çalışmaz', async () => {
    const handler = vi.fn().mockResolvedValue({
      tasksScanned: 0,
      warningsCreated: 0,
    });
    const job = new SlaReminderJob(handler, SLA_REMINDER_CRON_INTERVAL_MS);

    const first = await job.runIfDue(1_000);
    const second = await job.runIfDue(1_000 + SLA_REMINDER_CRON_INTERVAL_MS - 1);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
