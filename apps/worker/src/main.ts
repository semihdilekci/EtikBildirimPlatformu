import { disconnectPrismaClient, getPrismaClient } from './prisma/create-prisma-client.js';
import { createMalwareScannerFromEnv } from './malware/clamav-scanner.adapter.js';
import { createDocumentContentCryptoFromEnv } from './crypto/document-content-crypto.js';
import { ClamAvScanJob } from './jobs/clamav-scan.job.js';
import { AuditChainVerifyJob } from './jobs/audit-chain-verify.job.js';
import { AuditOutboxDispatchJob } from './jobs/audit-outbox-dispatch.job.js';
import { NotificationDispatcherJob } from './jobs/notification-dispatcher.job.js';
import { RetentionPurgeJob } from './jobs/retention-purge.job.js';
import { createEmailRelayFromEnv } from './email/email-relay.adapter.js';
import { MalwareScanJob, type MalwareScanResult } from './jobs/malware-scan.job.js';
import { SLA_REMINDER_CRON_INTERVAL_MS, SILENT_ACCEPTANCE_CRON_INTERVAL_MS } from '@ethics/shared';
import { SlaReminderJob } from './jobs/sla-reminder.job.js';
import { invokeSlaReminderRunner } from './jobs/sla-reminder.runner-invoker.js';
import { SilentAcceptanceJob } from './jobs/silent-acceptance.job.js';
import { invokeSilentAcceptanceRunner } from './jobs/silent-acceptance.runner-invoker.js';
import { createObjectStorageFromEnv } from './storage/local-object-storage.adapter.js';

const DEFAULT_POLL_INTERVAL_MS = 5_000;

const EMPTY_MALWARE_SCAN_RESULT: MalwareScanResult = {
  processed: 0,
  clean: 0,
  rejected: 0,
  skipped: 0,
  failed: 0,
  timedOut: 0,
  items: [],
};

export interface WorkerRunResult {
  dispatch: Awaited<ReturnType<AuditOutboxDispatchJob['processPendingBatch']>>;
  notificationDispatch: Awaited<ReturnType<NotificationDispatcherJob['processPendingBatch']>>;
  chainVerify: Awaited<ReturnType<AuditChainVerifyJob['runIfDue']>>;
  slaReminder: Awaited<ReturnType<SlaReminderJob['runIfDue']>>;
  retentionPurge: Awaited<ReturnType<RetentionPurgeJob['runIfDue']>>;
  clamAvScan: Awaited<ReturnType<ClamAvScanJob['processPendingBatch']>>;
  malwareScan: Awaited<ReturnType<MalwareScanJob['processPendingBatch']>>;
  silentAcceptance: Awaited<ReturnType<SilentAcceptanceJob['runIfDue']>>;
}

let silentAcceptanceJob: SilentAcceptanceJob | null = null;
let slaReminderJob: SlaReminderJob | null = null;
let retentionPurgeJob: RetentionPurgeJob | null = null;

function getSilentAcceptanceJob(): SilentAcceptanceJob {
  if (!silentAcceptanceJob) {
    silentAcceptanceJob = new SilentAcceptanceJob(async () => {
      try {
        return await invokeSilentAcceptanceRunner();
      } catch (error) {
        console.warn(
          JSON.stringify({
            worker: 'silent-acceptance',
            level: 'warn',
            err: error instanceof Error ? error.message : String(error),
          }),
        );
        return { casesScanned: 0, silentVotesCreated: 0, casesAdvanced: 0 };
      }
    }, SILENT_ACCEPTANCE_CRON_INTERVAL_MS);
  }

  return silentAcceptanceJob;
}

function getSlaReminderJob(): SlaReminderJob {
  if (!slaReminderJob) {
    slaReminderJob = new SlaReminderJob(async () => {
      try {
        return await invokeSlaReminderRunner();
      } catch (error) {
        console.warn(
          JSON.stringify({
            worker: 'sla-reminder',
            level: 'warn',
            err: error instanceof Error ? error.message : String(error),
          }),
        );
        return { tasksScanned: 0, warningsCreated: 0, breachesCreated: 0 };
      }
    }, SLA_REMINDER_CRON_INTERVAL_MS);
  }

  return slaReminderJob;
}

function getRetentionPurgeJob(): RetentionPurgeJob {
  if (!retentionPurgeJob) {
    retentionPurgeJob = new RetentionPurgeJob(getPrismaClient());
  }

  return retentionPurgeJob;
}

export async function runWorkerJobsOnce(): Promise<WorkerRunResult> {
  const prisma = getPrismaClient();
  const dispatchJob = new AuditOutboxDispatchJob(prisma);
  const notificationDispatchJob = new NotificationDispatcherJob(prisma, {
    emailRelay: createEmailRelayFromEnv(),
  });
  const chainVerifyJob = new AuditChainVerifyJob(prisma);
  const clamAvScanJob = new ClamAvScanJob(
    prisma,
    createObjectStorageFromEnv(),
    createMalwareScannerFromEnv(),
  );
  const silentAcceptance = await getSilentAcceptanceJob().runIfDue();
  const slaReminder = await getSlaReminderJob().runIfDue();
  const retentionPurge = await getRetentionPurgeJob().runIfDue();

  const dispatch = await dispatchJob.processPendingBatch();
  const notificationDispatch = await notificationDispatchJob.processPendingBatch();
  const chainVerify = await chainVerifyJob.runIfDue();
  const clamAvScan = await clamAvScanJob.processPendingBatch();

  let malwareScan: MalwareScanResult = { ...EMPTY_MALWARE_SCAN_RESULT };
  if (process.env.CRYPTO_LOCAL_KEK_DOCUMENT) {
    const malwareScanJob = new MalwareScanJob(
      prisma,
      createObjectStorageFromEnv(),
      createMalwareScannerFromEnv(),
      createDocumentContentCryptoFromEnv(),
    );
    malwareScan = await malwareScanJob.processPendingBatch();
  }

  return {
    dispatch,
    notificationDispatch,
    chainVerify,
    slaReminder,
    retentionPurge,
    clamAvScan,
    malwareScan,
    silentAcceptance,
  };
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
      msg: 'Worker started — outbox dispatch + notification dispatch + cron jobs (SLA, silent acceptance, chain verify, retention)',
    }),
  );

  const tick = async (): Promise<void> => {
    try {
      const result = await runWorkerJobsOnce();
      if (
        result.dispatch.processed > 0 ||
        result.notificationDispatch.processed > 0 ||
        (result.chainVerify !== null && !result.chainVerify.valid) ||
        (result.slaReminder !== null &&
          (result.slaReminder.warningsCreated > 0 || result.slaReminder.breachesCreated > 0)) ||
        (result.retentionPurge !== null && result.retentionPurge.purgedCount > 0) ||
        result.clamAvScan.processed > 0 ||
        result.malwareScan.processed > 0 ||
        (result.silentAcceptance !== null &&
          (result.silentAcceptance.silentVotesCreated > 0 ||
            result.silentAcceptance.casesAdvanced > 0))
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
