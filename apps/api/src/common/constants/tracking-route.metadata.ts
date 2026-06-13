import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const REQUIRES_TRACKING_KEY = 'auth:requiresTracking';

export function requiresTrackingAuth(reflector: Reflector, context: ExecutionContext): boolean {
  const requiresTracking = reflector.getAllAndOverride<boolean | undefined>(REQUIRES_TRACKING_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  return requiresTracking ?? false;
}
