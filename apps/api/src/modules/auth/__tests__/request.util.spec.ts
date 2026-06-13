import { describe, expect, it } from 'vitest';

import { extractClientIp, resolveSessionExpiresAt } from '../utils/request.util.js';

describe('request.util', () => {
  it('x-forwarded-for ilk IP adresini döner', () => {
    const ip = extractClientIp({
      headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.2' },
      ip: '127.0.0.1',
    } as never);

    expect(ip).toBe('203.0.113.1');
  });

  it('forwarded header yoksa request.ip kullanılır', () => {
    const ip = extractClientIp({
      headers: {},
      ip: '10.0.0.5',
    } as never);

    expect(ip).toBe('10.0.0.5');
  });

  it('resolveSessionExpiresAt cookie maxAge üzerinden hesaplar', () => {
    const before = Date.now();
    const expiresAt = resolveSessionExpiresAt({
      session: {
        cookie: {
          maxAge: 60_000,
        },
      },
    } as never);
    const after = Date.now();

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 60_000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 60_000);
  });
});
