import { randomBytes } from 'node:crypto';

const TRACKING_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** ETK-XXXX-XXXX formatında benzersiz takip kodu üretir */
export function generateTrackingCode(): string {
  const raw = Array.from({ length: 8 }, () => {
    const [byte] = randomBytes(1);
    const index = (byte ?? 0) % TRACKING_CODE_ALPHABET.length;
    return TRACKING_CODE_ALPHABET[index];
  }).join('');

  return `ETK-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function isValidTrackingCodeFormat(code: string): boolean {
  return /^ETK-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/.test(
    code,
  );
}
