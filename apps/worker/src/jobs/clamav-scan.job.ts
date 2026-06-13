import { createHash } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { MalwareScanStatus } from '@ethics/shared';

import type { MalwareScannerPort } from '../malware/malware-scanner.port.js';
import type { ObjectStoragePort } from '../storage/object-storage.port.js';

const CLAMAV_SCAN_ADVISORY_LOCK_KEY = 8_739_283;
const DEFAULT_BATCH_SIZE = 20;

export interface ClamAvScanItemResult {
  attachmentId: string;
  status: 'clean' | 'rejected' | 'skipped' | 'failed';
  errorCode?: string;
}

export interface ClamAvScanResult {
  processed: number;
  clean: number;
  rejected: number;
  skipped: number;
  failed: number;
  items: ClamAvScanItemResult[];
}

export interface ClamAvScanJobOptions {
  batchSize?: number;
}

export class ClamAvScanJob {
  private readonly batchSize: number;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly objectStorage: ObjectStoragePort,
    private readonly malwareScanner: MalwareScannerPort,
    options: ClamAvScanJobOptions = {},
  ) {
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  }

  async processPendingBatch(): Promise<ClamAvScanResult> {
    const pending = await this.prisma.reportAttachment.findMany({
      where: { malwareScanStatus: MalwareScanStatus.PENDING },
      orderBy: { uploadedAt: 'asc' },
      take: this.batchSize,
      select: {
        id: true,
        storageKey: true,
        contentSha256: true,
      },
    });

    const items: ClamAvScanItemResult[] = [];
    let clean = 0;
    let rejected = 0;
    let skipped = 0;
    let failed = 0;

    for (const attachment of pending) {
      try {
        const item = await this.scanSingle(
          attachment.id,
          attachment.storageKey,
          attachment.contentSha256,
        );
        items.push(item);

        if (item.status === 'clean') {
          clean += 1;
        } else if (item.status === 'rejected') {
          rejected += 1;
        } else if (item.status === 'skipped') {
          skipped += 1;
        } else {
          failed += 1;
        }
      } catch (error) {
        const errorCode =
          error instanceof Error ? error.message.slice(0, 120) : 'CLAMAV_SCAN_FAILED';
        items.push({ attachmentId: attachment.id, status: 'failed', errorCode });
        failed += 1;
      }
    }

    return {
      processed: pending.length,
      clean,
      rejected,
      skipped,
      failed,
      items,
    };
  }

  private async scanSingle(
    attachmentId: string,
    storageKey: string,
    expectedSha256: string,
  ): Promise<ClamAvScanItemResult> {
    let content: Buffer;

    try {
      content = await this.objectStorage.getObjectBuffer(storageKey);
    } catch {
      return { attachmentId, status: 'skipped' };
    }

    const computedSha256 = createHash('sha256').update(content).digest('hex');
    if (computedSha256 !== expectedSha256.toLowerCase()) {
      await this.prisma.reportAttachment.update({
        where: { id: attachmentId },
        data: { malwareScanStatus: MalwareScanStatus.REJECTED },
      });
      return { attachmentId, status: 'rejected', errorCode: 'SHA256_MISMATCH' };
    }

    const scanResult = await this.malwareScanner.scanBuffer(content);
    const nextStatus =
      scanResult === 'INFECTED' ? MalwareScanStatus.REJECTED : MalwareScanStatus.CLEAN;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CLAMAV_SCAN_ADVISORY_LOCK_KEY})`;

      const current = await tx.reportAttachment.findUnique({
        where: { id: attachmentId },
        select: { malwareScanStatus: true },
      });

      if (!current || current.malwareScanStatus !== MalwareScanStatus.PENDING) {
        return;
      }

      await tx.reportAttachment.update({
        where: { id: attachmentId },
        data: { malwareScanStatus: nextStatus },
      });
    });

    return {
      attachmentId,
      status: scanResult === 'INFECTED' ? 'rejected' : 'clean',
    };
  }
}
