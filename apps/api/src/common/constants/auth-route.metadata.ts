import type { PermissionCode } from '@ethics/policy';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const IS_AUTHENTICATED_KEY = 'auth:isAuthenticated';
export const REQUIRE_POLICY_KEY = 'auth:requirePolicy';

export function isPublicRoute(reflector: Reflector, context: ExecutionContext): boolean {
  const isPublic = reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  return isPublic ?? false;
}

export function isAuthenticatedRoute(reflector: Reflector, context: ExecutionContext): boolean {
  const isAuthenticated = reflector.getAllAndOverride<boolean | undefined>(IS_AUTHENTICATED_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  return isAuthenticated ?? false;
}

export function getRequiredPolicy(
  reflector: Reflector,
  context: ExecutionContext,
): PermissionCode | undefined {
  return reflector.getAllAndOverride<PermissionCode>(REQUIRE_POLICY_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
}

export function requiresSession(reflector: Reflector, context: ExecutionContext): boolean {
  return (
    getRequiredPolicy(reflector, context) !== undefined || isAuthenticatedRoute(reflector, context)
  );
}
