import type { Request } from 'express';

export function extractClientIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.ip ?? 'unknown';
}

export function resolveSessionExpiresAt(request: Request): Date {
  const maxAge = request.session.cookie.maxAge ?? 0;
  return new Date(Date.now() + maxAge);
}
