import type { PrismaClient } from '@prisma/client';

export interface AuditChainRow {
  id: string;
  prevHash: string | null;
  eventHash: string | null;
}

export interface AuditChainVerificationResult {
  valid: boolean;
  eventCount: number;
  brokenAtEventId?: string;
}

export interface AuditChainQueryPort {
  fetchOrderedChainRows(): Promise<AuditChainRow[]>;
}

/**
 * Chain hash doğrulama — hash yeniden hesaplanmaz (DB trigger tek kaynak).
 * API AuditSealService ile aynı mantık; worker NestJS bağımlılığı taşımaz.
 */
export class AuditChainVerifier {
  async verify(chainQuery: AuditChainQueryPort): Promise<AuditChainVerificationResult> {
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
