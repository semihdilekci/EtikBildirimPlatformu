import { disconnectPrismaClient, getPrismaClient } from './prisma/create-prisma-client.js';
import { createMalwareScannerFromEnv } from './malware/clamav-scanner.adapter.js';
import { ClamAvScanJob } from './jobs/clamav-scan.job.js';
import { AuditChainVerifyJob } from './jobs/audit-chain-verify.job.js';
import { AuditOutboxDispatchJob } from './jobs/audit-outbox-dispatch.job.js';
import { createObjectStorageFromEnv } from './storage/local-object-storage.adapter.js';

const DEFAULT_POLL_INTERVAL_MS = 5_000;

export interface WorkerRunResult {
  dispatch: Awaited<ReturnType<AuditOutboxDispatchJob['processPendingBatch']>>;
  chainVerify: Awaited<ReturnType<AuditChainVerifyJob['run']>>;
  clamAvScan: Awaited<ReturnType<ClamAvScanJob['processPendingBatch']>>;
}

export async function runWorkerJobsOnce(): Promise<WorkerRunResult> {
  const prisma = getPrismaClient();
  const dispatchJob = new AuditOutboxDispatchJob(prisma);
  const chainVerifyJob = new AuditChainVerifyJob(prisma);
  const clamAvScanJob = new ClamAvScanJob(
    prisma,
    createObjectStorageFromEnv(),
    createMalwareScannerFromEnv(),
  );

  const dispatch = await dispatchJob.processPendingBatch();
  const chainVerify = await chainVerifyJob.run();
  const clamAvScan = await clamAvScanJob.processPendingBatch();

  return { dispatch, chainVerify, clamAvScan };
}

export async function main(): Promise<void> {
  const runOnce = process.argv.includes('--once');

  if (runOnce) {
    const result = await runWorkerJobsOnce();
    console.warn(JSON.stringify({ worker: 'audit-jobs', mode: 'once', result }));
    await disconnectPrismaClient();
    return;
  }

  console.warn(
    JSON.stringify({
      worker: 'audit-jobs',
      mode: 'poll',
      pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
      msg: 'Worker started — audit outbox dispatch + chain verify + clamav scan',
    }),
  );

  const tick = async (): Promise<void> => {
    try {
      const result = await runWorkerJobsOnce();
      if (
        result.dispatch.processed > 0 ||
        !result.chainVerify.valid ||
        result.clamAvScan.processed > 0
      ) {
        console.warn(JSON.stringify({ worker: 'audit-jobs', result }));
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          worker: 'audit-jobs',
          level: 'error',
          err: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  };

  await tick();

  const interval = setInterval(() => {
    void tick();
  }, DEFAULT_POLL_INTERVAL_MS);

  const shutdown = async (): Promise<void> => {
    clearInterval(interval);
    await disconnectPrismaClient();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

void main();
