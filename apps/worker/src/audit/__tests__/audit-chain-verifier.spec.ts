import { describe, expect, it } from 'vitest';

import { AuditChainVerifier } from '../audit-chain-verifier.js';

describe('AuditChainVerifier', () => {
  const verifier = new AuditChainVerifier();

  it('boş zincir geçerli kabul edilir', async () => {
    const result = await verifier.verify({
      fetchOrderedChainRows: () => Promise.resolve([]),
    });

    expect(result).toEqual({ valid: true, eventCount: 0 });
  });

  it('prev_hash uyumsuzluğunda valid=false döner', async () => {
    const result = await verifier.verify({
      fetchOrderedChainRows: () =>
        Promise.resolve([
          { id: 'a', prevHash: null, eventHash: 'h1' },
          { id: 'b', prevHash: 'broken', eventHash: 'h2' },
        ]),
    });

    expect(result.valid).toBe(false);
    expect(result.brokenAtEventId).toBe('b');
  });
});
