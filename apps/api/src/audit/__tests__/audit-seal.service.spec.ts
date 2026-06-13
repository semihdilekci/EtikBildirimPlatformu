import { describe, expect, it } from 'vitest';

import { AuditSealService } from '../audit-seal.service.js';
import type { AuditChainQueryPort } from '../audit.types.js';

describe('AuditSealService', () => {
  const service = new AuditSealService();

  it('application layer sealing devre dışı — hash yalnızca DB trigger ile üretilir', () => {
    expect(service.isApplicationLayerSealingEnabled()).toBe(false);
  });

  it('verifyChainIntegrity: boş tablo geçerli', async () => {
    const chainQuery: AuditChainQueryPort = {
      fetchOrderedChainRows: () => Promise.resolve([]),
    };

    await expect(service.verifyChainIntegrity(chainQuery)).resolves.toEqual({
      valid: true,
      eventCount: 0,
    });
  });

  it('verifyChainIntegrity: geçerli zincir', async () => {
    const chainQuery: AuditChainQueryPort = {
      fetchOrderedChainRows: () =>
        Promise.resolve([
          { id: 'evt-1', prevHash: null, eventHash: 'hash-1' },
          { id: 'evt-2', prevHash: 'hash-1', eventHash: 'hash-2' },
          { id: 'evt-3', prevHash: 'hash-2', eventHash: 'hash-3' },
        ]),
    };

    await expect(service.verifyChainIntegrity(chainQuery)).resolves.toEqual({
      valid: true,
      eventCount: 3,
    });
  });

  it('verifyChainIntegrity: kırık prev_hash zinciri reddeder', async () => {
    const chainQuery: AuditChainQueryPort = {
      fetchOrderedChainRows: () =>
        Promise.resolve([
          { id: 'evt-1', prevHash: null, eventHash: 'hash-1' },
          { id: 'evt-2', prevHash: 'wrong-hash', eventHash: 'hash-2' },
        ]),
    };

    await expect(service.verifyChainIntegrity(chainQuery)).resolves.toEqual({
      valid: false,
      eventCount: 2,
      brokenAtEventId: 'evt-2',
    });
  });

  it('verifyChainIntegrity: eksik event_hash reddeder', async () => {
    const chainQuery: AuditChainQueryPort = {
      fetchOrderedChainRows: () =>
        Promise.resolve([{ id: 'evt-1', prevHash: null, eventHash: null }]),
    };

    await expect(service.verifyChainIntegrity(chainQuery)).resolves.toEqual({
      valid: false,
      eventCount: 1,
      brokenAtEventId: 'evt-1',
    });
  });
});
