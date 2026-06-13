import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module.js';
import { SilentAcceptanceHandler } from '../modules/decision/silent-acceptance.handler.js';
import type { SilentAcceptanceProcessResult } from '../modules/decision/silent-acceptance.handler.js';

export async function runSilentAcceptanceOnce(): Promise<SilentAcceptanceProcessResult> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const handler = app.get(SilentAcceptanceHandler);
    return await handler.processPendingBatch();
  } finally {
    await app.close();
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('silent-acceptance.runner.ts') ||
    process.argv[1].endsWith('silent-acceptance.runner.js'));

if (isDirectExecution) {
  runSilentAcceptanceOnce()
    .then((result) => {
      console.warn(JSON.stringify({ worker: 'silent-acceptance', mode: 'once', result }));
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error(
        JSON.stringify({
          worker: 'silent-acceptance',
          level: 'error',
          err: error instanceof Error ? error.message : String(error),
        }),
      );
      process.exit(1);
    });
}
