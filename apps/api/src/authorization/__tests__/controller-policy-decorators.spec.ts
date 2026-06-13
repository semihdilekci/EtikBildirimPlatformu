import { describe, expect, it } from 'vitest';

import { AuthController } from '../../modules/auth/auth.controller.js';
import { HealthController } from '../../modules/health/health.controller.js';
import {
  IS_AUTHENTICATED_KEY,
  IS_PUBLIC_KEY,
  REQUIRE_POLICY_KEY,
} from '../../common/constants/auth-route.metadata.js';

type ControllerClass = new (...args: never[]) => object;

function getControllerRouteMethods(controller: ControllerClass): Array<{
  methodName: string;
  handler: (...args: never[]) => unknown;
}> {
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor' && typeof prototype[name] === 'function')
    .map((methodName) => ({
      methodName,
      handler: prototype[methodName] as (...args: never[]) => unknown,
    }));
}

function describeControllerPolicyCoverage(controller: ControllerClass, controllerName: string) {
  describe(controllerName, () => {
    it.each(getControllerRouteMethods(controller))(
      '$methodName decorator ile korunur (@Public, @Authenticated veya @RequirePolicy)',
      ({ handler }) => {
        const isPublic =
          Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true ||
          Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true;
        const isAuthenticated = Reflect.getMetadata(IS_AUTHENTICATED_KEY, handler) === true;
        const requiredPolicy = Reflect.getMetadata(REQUIRE_POLICY_KEY, handler);

        expect(isPublic || isAuthenticated || requiredPolicy !== undefined).toBe(true);
      },
    );
  });
}

describe('Controller policy decorator spot check', () => {
  describeControllerPolicyCoverage(AuthController, 'AuthController');
  describeControllerPolicyCoverage(HealthController, 'HealthController');

  it('AuthController /me endpoint @Authenticated ile işaretli', () => {
    const handler = AuthController.prototype.me as (...args: never[]) => unknown;
    expect(Reflect.getMetadata(IS_AUTHENTICATED_KEY, handler)).toBe(true);
    expect(Reflect.getMetadata(REQUIRE_POLICY_KEY, handler)).toBeUndefined();
  });

  it('HealthController sınıf seviyesinde @Public', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, HealthController)).toBe(true);
  });

  it('tüm controller handlerları route metadata taşır', () => {
    for (const controller of [AuthController, HealthController]) {
      for (const { handler } of getControllerRouteMethods(controller)) {
        expect(Reflect.getMetadata('method', handler)).toBeDefined();
        expect(Reflect.getMetadata('path', handler)).toBeDefined();
      }
    }
  });
});
