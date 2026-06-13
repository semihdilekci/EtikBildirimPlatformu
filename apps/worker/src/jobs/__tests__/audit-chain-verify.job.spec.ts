import { describe, expect, it, vi } from 'vitest';

import { AuditChainVerifyJob } from '../audit-chain-verify.job.js';

describe('AuditChainVerifyJob', () => {
  it('geçerli zincir için alarm üretmez', async () => {
    const logger = {
      warn: vi.fn(),
      info: vi.fn(),
    };

    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 'e1', prev_hash: null, event_hash: 'hash-1' },
        { id: 'e2', prev_hash: 'hash-1', event_hash: 'hash-2' },
      ]),
    };

    const job = new AuditChainVerifyJob(prisma as never, logger);
    const result = await job.run();

    expect(result.valid).toBe(true);
    expect(result.alarmRaised).toBe(false);
    expect(logger.info).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('bozuk zincir için alarm log üretir', async () => {
    const logger = {
      warn: vi.fn(),
      info: vi.fn(),
    };

    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 'e1', prev_hash: null, event_hash: 'hash-1' },
        { id: 'e2', prev_hash: 'wrong-prev', event_hash: 'hash-2' },
      ]),
    };

    const job = new AuditChainVerifyJob(prisma as never, logger);
    const result = await job.run();

    expect(result.valid).toBe(false);
    expect(result.alarmRaised).toBe(true);
    expect(result.brokenAtEventId).toBe('e2');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ alarm: 'AUDIT_CHAIN_INTEGRITY_FAILURE' }),
      'Audit chain verification failed',
    );
  });
});
