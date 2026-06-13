import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import type {
  AuditChainQueryPort,
  AuditChainRow,
  AuditChainVerificationResult,
} from './audit.types.js';

export type { AuditChainVerificationResult } from './audit.types.js';

/**
 * Chain hash üretimi DB trigger seviyesindedir (Faz 3 — İterasyon 3).
 * Worker dispatcher ve periyodik doğrulama Faz 3 İterasyon 5'te genişletilecek.
 */
@Injectable()
export class AuditSealService {
  /**
   * Chain hash DB trigger ile üretilir; uygulama katmanında hesaplanmaz.
   */
  isApplicationLayerSealingEnabled(): false {
    return false;
  }

  /**
   * prev_hash zincirini doğrular — hash yeniden hesaplanmaz (DB trigger tek kaynak).
   */
  async verifyChainIntegrity(
    chainQuery: AuditChainQueryPort,
  ): Promise<AuditChainVerificationResult> {
    const rows = await chainQuery.fetchOrderedChainRows();

    if (rows.length === 0) {
      return { valid: true, eventCount: 0 };
    }

    let previousHash: string | null = null;

    for (const row of rows) {
      if (row.prevHash !== previousHash) {
        return {
          valid: false,
          eventCount: rows.length,
          brokenAtEventId: row.id,
        };
      }

      if (!row.eventHash) {
        return {
          valid: false,
          eventCount: rows.length,
          brokenAtEventId: row.id,
        };
      }

      previousHash = row.eventHash;
    }

    return { valid: true, eventCount: rows.length };
  }

  createPrismaChainQuery(prisma: Pick<PrismaClient, '$queryRaw'>): AuditChainQueryPort {
    return {
      fetchOrderedChainRows: async (): Promise<AuditChainRow[]> => {
        const rows = await prisma.$queryRaw<
          Array<{ id: string; prev_hash: string | null; event_hash: string | null }>
        >`
          SELECT id, prev_hash, event_hash
          FROM audit_events
          ORDER BY created_at ASC, id ASC
        `;

        return rows.map((row) => ({
          id: row.id,
          prevHash: row.prev_hash,
          eventHash: row.event_hash,
        }));
      },
    };
  }
}
