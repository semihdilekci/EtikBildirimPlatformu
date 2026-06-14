import { Inject, Injectable } from '@nestjs/common';
import type { AdminSystemHealthResponse } from '@ethics/dto';

import { PrismaService } from '../../../prisma/prisma.service.js';

const FAILED_DISPATCH_STATUSES = ['FAILED', 'PERMANENTLY_FAILED'] as const;

@Injectable()
export class SystemHealthAdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSystemHealth(): Promise<AdminSystemHealthResponse> {
    const checkedAt = new Date();

    const [
      databaseStatus,
      auditPending,
      auditFailed,
      notificationPending,
      notificationFailed,
      pendingScanCount,
      auditLastProcessed,
      notificationLastSent,
    ] = await Promise.all([
      this.checkDatabase(),
      this.prisma.auditOutbox.count({ where: { dispatchStatus: 'PENDING' } }),
      this.prisma.auditOutbox.count({
        where: { dispatchStatus: { in: [...FAILED_DISPATCH_STATUSES] } },
      }),
      this.prisma.notificationEvent.count({ where: { dispatchStatus: 'PENDING' } }),
      this.prisma.notificationEvent.count({
        where: { dispatchStatus: { in: [...FAILED_DISPATCH_STATUSES] } },
      }),
      this.prisma.documentVersion.count({ where: { malwareScanStatus: 'PENDING' } }),
      this.prisma.auditOutbox.findFirst({
        where: { processedAt: { not: null } },
        orderBy: { processedAt: 'desc' },
        select: { processedAt: true },
      }),
      this.prisma.notificationEvent.findFirst({
        where: { sentAt: { not: null } },
        orderBy: { sentAt: 'desc' },
        select: { sentAt: true },
      }),
    ]);

    const workers = [
      this.buildWorkerStatus(
        'outbox_processor',
        auditPending,
        auditFailed,
        auditLastProcessed?.processedAt ?? null,
      ),
      this.buildWorkerStatus(
        'notification_dispatcher',
        notificationPending,
        notificationFailed,
        notificationLastSent?.sentAt ?? null,
      ),
      this.buildWorkerStatus('malware_scanner', pendingScanCount, 0, null),
      this.buildWorkerStatus('sla_checker', 0, 0, null),
      this.buildWorkerStatus('silent_acceptance', 0, 0, null),
      this.buildWorkerStatus('retention_worker', 0, 0, null),
      this.buildWorkerStatus('hr_sync_worker', 0, 0, null),
    ];

    return {
      checkedAt: checkedAt.toISOString(),
      components: [
        { name: 'database', status: databaseStatus },
        { name: 'object_storage', status: 'UNKNOWN' },
        { name: 'smtp', status: 'UNKNOWN' },
      ],
      workers,
      syncStatus: {
        hrSapLastSync: null,
        hrSapStatus: 'UNKNOWN',
      },
      outboxDepth: {
        auditPending,
        auditFailed,
        notificationPending,
        notificationFailed,
      },
    };
  }

  private async checkDatabase(): Promise<'UP' | 'DOWN'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'UP';
    } catch {
      return 'DOWN';
    }
  }

  private buildWorkerStatus(
    name: string,
    pendingCount: number,
    failedCount: number,
    lastRunAt: Date | null,
  ): AdminSystemHealthResponse['workers'][number] {
    let status: 'RUNNING' | 'STOPPED' | 'ERROR' | 'UNKNOWN' = 'UNKNOWN';

    if (failedCount > 0) {
      status = 'ERROR';
    } else if (pendingCount > 0) {
      status = lastRunAt ? 'RUNNING' : 'STOPPED';
    } else if (lastRunAt) {
      status = 'RUNNING';
    } else {
      status = 'STOPPED';
    }

    return {
      name,
      status,
      lastRunAt: lastRunAt?.toISOString() ?? null,
      pendingCount,
      failedCount,
    };
  }
}
