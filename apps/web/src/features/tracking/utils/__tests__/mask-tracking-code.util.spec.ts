import { describe, expect, it } from 'vitest';

import { maskTrackingCode } from '@/features/tracking/utils/mask-tracking-code.util';

describe('maskTrackingCode', () => {
  it('masks the last segment of a valid tracking code', () => {
    expect(maskTrackingCode('ETK-2XA9-KP7M')).toBe('ETK-2XA9-****');
  });

  it('returns generic mask for invalid format', () => {
    expect(maskTrackingCode('invalid')).toBe('ETK-****-****');
  });
});
