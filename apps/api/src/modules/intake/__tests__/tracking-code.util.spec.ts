import { describe, expect, it } from 'vitest';

import { generateTrackingCode, isValidTrackingCodeFormat } from '../tracking-code.util.js';

describe('tracking-code.util', () => {
  it('generateTrackingCode ETK-XXXX-XXXX formatında üretir', () => {
    const code = generateTrackingCode();
    expect(isValidTrackingCodeFormat(code)).toBe(true);
    expect(code).toMatch(
      /^ETK-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/,
    );
  });

  it('ardışık üretimler farklı kod döndürür', () => {
    const first = generateTrackingCode();
    const second = generateTrackingCode();
    expect(first).not.toBe(second);
  });
});
