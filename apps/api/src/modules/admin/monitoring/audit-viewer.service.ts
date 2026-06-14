import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  AdminAuditChainVerifyResponse,
  AdminAuditExportJob,
  AdminAuditEventItem,
  ListAdminAuditEventsQuery,
  RequestAdminAuditExportBody,
} from '@ethics/dto';
import {
  ADMIN_AUDIT_EXPORT_BATCH_SIZE,
  ADMIN_AUDIT_EXPORT_PRESIGNED_TTL_SECONDS,
  AdminExportJobStatus,
  AdminExportType,
  ErrorCode,
} from '@ethics/shared';
import type { Prisma } from '@prisma/client';

import { AuditSealService } from '../../../audit/audit-seal.service.js';
import { RedactionService } from '../../../audit/redaction.service.js';
import { DomainException } from '../../../common/exceptions/domain.exception.js';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import {
  OBJECT_STORAGE_PORT,
  type ObjectStoragePort,
} from '../../../storage/object-storage.port.js';
import {
  AUDIT_CSV_HEADERS,
  auditExportFilterFromBody,
  buildAuditCsvRow,
  buildAuditEventWhere,
  mapAuditEventRow,
} from './audit-viewer.mapper.js';

@Injectable()
export class AuditViewerService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedactionService) private readonly redactionService: RedactionService,
    @Inject(AuditSealService) private readonly auditSealService: AuditSealService,
    @Inject(OBJECT_STORAGE_PORT) private readonly objectStorage: ObjectStoragePort,
  ) {}

  async listAuditEvents(
    query: ListAdminAuditEventsQuery,
  ): Promise<{ items: AdminAuditEventItem[]; nextCursor: string | null }> {
    const limit = query.limit;
    const where = buildAuditEventWhere(query);

    const rows = await this.prisma.auditEvent.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1,
          }
        : {}),
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const items = pageRows.map((row) => this.mapRedactedEvent(row));

    return {
      items,
      nextCursor: hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null,
    };
  }

  async requestAuditExport(
    user: AuthenticatedUser,
    body: RequestAdminAuditExportBody,
  ): Promise<AdminAuditExportJob> {
    const filters = auditExportFilterFromBody(body);
    const where = buildAuditEventWhere(filters);
    await this.prisma.auditEvent.count({ where });

    const job = await this.prisma.adminExportJob.create({
      data: {
        exportType: AdminExportType.AUDIT_EVENTS_CSV,
        status: AdminExportJobStatus.PENDING,
        requestedByUserId: user.id,
        filterJson: {
          ...filters,
          reason: body.reason,
        },
      },
    });

    void this.processExportJob(job.id).catch(() => undefined);

    return this.toExportJobDto(job);
  }

  async getAuditExportJob(user: AuthenticatedUser, jobId: string): Promise<AdminAuditExportJob> {
    const job = await this.prisma.adminExportJob.findUnique({
      where: { id: jobId },
    });

    if (!job || job.requestedByUserId !== user.id) {
      throw new DomainException(
        ErrorCode.ADMIN_AUDIT_EXPORT_NOT_FOUND,
        'Audit export job bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toExportJobDto(job, await this.resolveDownloadUrl(job));
  }

  async processExportJob(jobId: string): Promise<void> {
    const job = await this.prisma.adminExportJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== AdminExportJobStatus.PENDING) {
      return;
    }

    await this.prisma.adminExportJob.update({
      where: { id: jobId },
      data: { status: AdminExportJobStatus.PROCESSING },
    });

    try {
      const filterJson = job.filterJson as Record<string, unknown>;
      const filters = {
        eventType: typeof filterJson.eventType === 'string' ? filterJson.eventType : undefined,
        actorUserId:
          typeof filterJson.actorUserId === 'string' ? filterJson.actorUserId : undefined,
        resourceType:
          typeof filterJson.resourceType === 'string' ? filterJson.resourceType : undefined,
        resourceId: typeof filterJson.resourceId === 'string' ? filterJson.resourceId : undefined,
        dateFrom: typeof filterJson.dateFrom === 'string' ? filterJson.dateFrom : undefined,
        dateTo: typeof filterJson.dateTo === 'string' ? filterJson.dateTo : undefined,
      };

      const where = buildAuditEventWhere(filters);
      const csvLines = [buildAuditCsvRow(AUDIT_CSV_HEADERS)];
      let rowCount = 0;
      let cursor: string | undefined;

      for (;;) {
        const batch = await this.prisma.auditEvent.findMany({
          where,
          orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
          take: ADMIN_AUDIT_EXPORT_BATCH_SIZE,
          ...(cursor
            ? {
                cursor: { id: cursor },
                skip: 1,
              }
            : {}),
        });

        if (batch.length === 0) {
          break;
        }

        for (const row of batch) {
          const mapped = this.mapRedactedEvent(row);
          csvLines.push(
            buildAuditCsvRow([
              mapped.id,
              mapped.occurredAt,
              mapped.eventType,
              mapped.eventCategory,
              mapped.severity,
              mapped.actorType,
              mapped.actorId,
              mapped.action,
              mapped.outcome,
              mapped.correlationId,
              mapped.resourceType,
              mapped.resourceId,
            ]),
          );
          rowCount += 1;
        }

        const lastRow = batch[batch.length - 1];
        if (!lastRow) {
          break;
        }
        cursor = lastRow.id;

        if (batch.length < ADMIN_AUDIT_EXPORT_BATCH_SIZE) {
          break;
        }
      }

      const storageKey = `admin/exports/audit/${jobId}.csv`;
      await this.objectStorage.putObject({
        storageKey,
        content: Buffer.from(csvLines.join('\n'), 'utf8'),
        contentType: 'text/csv; charset=utf-8',
      });

      const expiresAt = new Date(Date.now() + ADMIN_AUDIT_EXPORT_PRESIGNED_TTL_SECONDS * 1000);

      await this.prisma.adminExportJob.update({
        where: { id: jobId },
        data: {
          status: AdminExportJobStatus.COMPLETED,
          storageKey,
          rowCount,
          completedAt: new Date(),
          expiresAt,
          errorCode: null,
        },
      });
    } catch {
      await this.prisma.adminExportJob.update({
        where: { id: jobId },
        data: {
          status: AdminExportJobStatus.FAILED,
          errorCode: ErrorCode.ADMIN_AUDIT_EXPORT_FAILED,
        },
      });
    }
  }

  async verifyChainIntegrity(): Promise<AdminAuditChainVerifyResponse> {
    const chainQuery = this.auditSealService.createPrismaChainQuery(this.prisma);
    const result = await this.auditSealService.verifyChainIntegrity(chainQuery);

    return {
      ...result,
      verifiedAt: new Date().toISOString(),
    };
  }

  private mapRedactedEvent(row: {
    id: string;
    occurredAt: Date;
    recordedAt: Date;
    eventType: string;
    eventCategory: string;
    severity: string;
    actorType: string;
    actorId: string | null;
    action: string;
    outcome: string;
    correlationId: string | null;
    metadataJson: Prisma.JsonValue | null;
  }): AdminAuditEventItem {
    const mapped = mapAuditEventRow(row);
    const redactedMetadata = mapped.metadata
      ? (this.redactionService.redactAuditSnapshot(mapped.metadata) as Record<string, unknown>)
      : null;

    return {
      ...mapped,
      metadata: redactedMetadata,
    };
  }

  private async resolveDownloadUrl(job: {
    status: string;
    storageKey: string | null;
    expiresAt: Date | null;
  }): Promise<{ downloadUrl: string | null; downloadUrlExpiresAt: string | null }> {
    if (
      job.status !== AdminExportJobStatus.COMPLETED ||
      !job.storageKey ||
      !job.expiresAt ||
      job.expiresAt.getTime() <= Date.now()
    ) {
      return { downloadUrl: null, downloadUrlExpiresAt: null };
    }

    const presigned = await this.objectStorage.createPresignedGetUrl({
      storageKey: job.storageKey,
      expiresInSeconds: ADMIN_AUDIT_EXPORT_PRESIGNED_TTL_SECONDS,
      downloadFilename: 'audit-events.csv',
      contentType: 'text/csv; charset=utf-8',
    });

    return {
      downloadUrl: presigned.downloadUrl,
      downloadUrlExpiresAt: presigned.expiresAt.toISOString(),
    };
  }

  private async toExportJobDto(
    job: {
      id: string;
      exportType: string;
      status: string;
      rowCount: number | null;
      errorCode: string | null;
      createdAt: Date;
      completedAt: Date | null;
      storageKey: string | null;
      expiresAt: Date | null;
    },
    download?: { downloadUrl: string | null; downloadUrlExpiresAt: string | null },
  ): Promise<AdminAuditExportJob> {
    const resolved = download ?? (await this.resolveDownloadUrl(job));

    return {
      id: job.id,
      exportType: job.exportType,
      status: job.status,
      rowCount: job.rowCount,
      errorCode: job.errorCode,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
      downloadUrl: resolved.downloadUrl,
      downloadUrlExpiresAt: resolved.downloadUrlExpiresAt,
    };
  }
}
