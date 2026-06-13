import { describe, expect, it } from 'vitest';

import { maskTrackingCode } from '../tracking-code-mask.util.js';

describe('maskTrackingCode', () => {
  it('son segmenti maskeler', () => {
    expect(maskTrackingCode('ETK-2XA9-KP7M')).toBe('ETK-2XA9-****');
  });

  it('geçersiz format için tam mask', () => {
    expect(maskTrackingCode('invalid')).toBe('ETK-****-****');
  });
});
