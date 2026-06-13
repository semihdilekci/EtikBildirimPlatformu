import { describe, expect, it } from 'vitest';

import { TrackingPasswordService } from '../tracking-password.service.js';

describe('TrackingPasswordService', () => {
  const service = new TrackingPasswordService();

  it('hashPassword argon2id hash üretir ve verifyPassword doğrular', async () => {
    const hash = await service.hashPassword('SecurePass1');
    expect(service.isArgon2idHash(hash)).toBe(true);

    await expect(service.verifyPassword('SecurePass1', hash)).resolves.toBe(true);
    await expect(service.verifyPassword('WrongPass1', hash)).resolves.toBe(false);
  });

  it('argon2id parametreleri Docs/07 §1.3 eşiklerini karşılar (m≥65536, t≥3, p≥1)', async () => {
    const hash = await service.hashPassword('ParamCheck1');
    const paramsSegment = hash.split('$')[3] ?? '';

    expect(paramsSegment).toMatch(/^m=65536/);
    expect(paramsSegment).toMatch(/,t=3,/);
    expect(paramsSegment).toMatch(/,p=1(?:,|$)/);
  });
});
