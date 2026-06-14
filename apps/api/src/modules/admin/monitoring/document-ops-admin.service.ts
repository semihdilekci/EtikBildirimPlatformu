import { Inject, Injectable } from '@nestjs/common';
import type {
  AdminDocumentOperationItem,
  AdminDocumentOperationsSummary,
  ListAdminDocumentOperationsQuery,
} from '@ethics/dto';
import { MalwareScanStatus } from '@ethics/shared';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service.js';

type DocumentOpsRow = {
  id: string;
  caseId: string;
  documentCategory: string;
  status: string;
  uploadedAt: Date;
  currentVersionNo: number;
  versions: Array<{
    versionNo: number;
    sizeBytes: bigint;
    mimeType: string;
    contentSha256: string;
    malwareScanStatus: string;
    scannedAt: Date | null;
  }>;
};

@Injectable()
export class DocumentOpsAdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listDocumentOperations(query: ListAdminDocumentOperationsQuery): Promise<{
    summary: AdminDocumentOperationsSummary;
    items: AdminDocumentOperationItem[];
    nextCursor: string | null;
  }> {
    const limit = query.limit;
    const where = this.buildWhere(query);

    const rows = (await this.prisma.document.findMany({
      where,
      orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        caseId: true,
        documentCategory: true,
        status: true,
        uploadedAt: true,
        currentVersionNo: true,
        versions: {
          select: {
            versionNo: true,
            sizeBytes: true,
            mimeType: true,
            contentSha256: true,
            malwareScanStatus: true,
            scannedAt: true,
          },
        },
      },
    })) as DocumentOpsRow[];

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const summary = await this.buildSummary();

    return {
      summary,
      items: pageRows.map((row) => this.mapDocumentRow(row, query.scanStatus)),
      nextCursor: hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null,
    };
  }

  private buildWhere(query: ListAdminDocumentOperationsQuery): Prisma.DocumentWhereInput {
    const where: Prisma.DocumentWhereInput = {};

    if (query.mimeType) {
      where.versions = {
        some: {
          mimeType: query.mimeType,
        },
      };
    }

    if (query.dateFrom || query.dateTo) {
      where.uploadedAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    if (query.scanStatus) {
      where.versions = {
        some: {
          malwareScanStatus: query.scanStatus,
        },
      };
    }

    return where;
  }

  private async buildSummary(): Promise<AdminDocumentOperationsSummary> {
    const [totalDocuments, pendingScanCount, quarantinedCount, rejectedCount, cleanCount] =
      await Promise.all([
        this.prisma.document.count(),
        this.prisma.documentVersion.count({
          where: { malwareScanStatus: MalwareScanStatus.PENDING },
        }),
        this.prisma.documentVersion.count({
          where: { malwareScanStatus: MalwareScanStatus.QUARANTINED },
        }),
        this.prisma.documentVersion.count({
          where: { malwareScanStatus: MalwareScanStatus.REJECTED },
        }),
        this.prisma.documentVersion.count({
          where: { malwareScanStatus: MalwareScanStatus.CLEAN },
        }),
      ]);

    return {
      totalDocuments,
      pendingScanCount,
      quarantinedCount,
      rejectedCount,
      cleanCount,
    };
  }

  private mapDocumentRow(
    row: DocumentOpsRow,
    scanStatusFilter?: string,
  ): AdminDocumentOperationItem {
    const currentVersion =
      row.versions.find((version) => version.versionNo === row.currentVersionNo) ??
      row.versions[row.versions.length - 1];

    const malwareScanStatus = currentVersion?.malwareScanStatus ?? MalwareScanStatus.PENDING;

    if (scanStatusFilter && malwareScanStatus !== scanStatusFilter) {
      // Filtre uygulandığında satır zaten where ile gelir; fallback tutarlılık
    }

    return {
      documentId: row.id,
      caseId: row.caseId,
      documentCategory: row.documentCategory,
      documentStatus: row.status,
      sizeBytes: currentVersion ? Number(currentVersion.sizeBytes) : 0,
      mimeType: currentVersion?.mimeType ?? 'application/octet-stream',
      malwareScanStatus,
      contentSha256Prefix: currentVersion?.contentSha256.slice(0, 12) ?? '',
      uploadedAt: row.uploadedAt.toISOString(),
      scannedAt: currentVersion?.scannedAt?.toISOString() ?? null,
    };
  }
}
