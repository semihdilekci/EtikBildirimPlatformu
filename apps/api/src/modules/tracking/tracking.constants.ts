export const TRACKING_CODE_HEADER = 'x-tracking-code';
export const TRACKING_PASSWORD_HEADER = 'x-tracking-password';

export const TRACKING_VERIFY_RATE_LIMIT = {
  limit: 5,
  ttl: 900_000,
} as const;

export const TRACKING_STATUS_RATE_LIMIT = {
  limit: 20,
  ttl: 60_000,
} as const;

export const TRACKING_ATTACHMENT_RATE_LIMIT = {
  limit: 10,
  ttl: 300_000,
} as const;

export const TRACKING_MESSAGES_READ_RATE_LIMIT = {
  limit: 20,
  ttl: 60_000,
} as const;

export const TRACKING_MESSAGES_SEND_RATE_LIMIT = {
  limit: 5,
  ttl: 60_000,
} as const;
