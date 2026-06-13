/** Audit ve log için takip kodunun son segmentini maskeler — ETK-2XA9-**** */
export function maskTrackingCode(trackingCode: string): string {
  const match =
    /^ETK-([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4})-([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4})$/.exec(
      trackingCode,
    );

  if (!match) {
    return 'ETK-****-****';
  }

  const prefix = match[1] ?? '';
  return `ETK-${prefix}-****`;
}
