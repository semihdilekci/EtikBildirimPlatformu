import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module.js';
import { SlaReminderHandler } from '../modules/task/sla/sla-reminder.handler.js';
import type { SlaReminderProcessResult } from '../modules/task/sla/sla-reminder.handler.js';

export async function runSlaReminderOnce(): Promise<SlaReminderProcessResult> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const handler = app.get(SlaReminderHandler);
    return await handler.processPendingBatch();
  } finally {
    await app.close();
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('sla-reminder.runner.ts') ||
    process.argv[1].endsWith('sla-reminder.runner.js'));

if (isDirectExecution) {
  runSlaReminderOnce()
    .then((result) => {
      console.warn(JSON.stringify({ worker: 'sla-reminder', mode: 'once', result }));
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error(
        JSON.stringify({
          worker: 'sla-reminder',
          level: 'error',
          err: error instanceof Error ? error.message : String(error),
        }),
      );
      process.exit(1);
    });
}
