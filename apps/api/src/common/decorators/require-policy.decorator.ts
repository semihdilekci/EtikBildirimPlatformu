import type { PermissionCode } from '@ethics/policy';
import { SetMetadata } from '@nestjs/common';

import { REQUIRE_POLICY_KEY } from '../constants/auth-route.metadata.js';

/** Internal endpoint RBAC permission — PolicyGuard tarafından değerlendirilir */
export const RequirePolicy = (permission: PermissionCode) =>
  SetMetadata(REQUIRE_POLICY_KEY, permission);
