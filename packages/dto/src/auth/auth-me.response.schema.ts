import { z } from 'zod';

import { CLEARANCE_LEVEL_VALUES, ClearanceLevel, ROLE_VALUES, Role } from '@ethics/shared';

const roleEnum = z.nativeEnum(Role);
const clearanceEnum = z.nativeEnum(ClearanceLevel);

export const authMeResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  roles: z.array(roleEnum),
  clearanceLevel: clearanceEnum,
  companyId: z.string().nullable(),
  companyName: z.string().nullable(),
  isGeneralSecretary: z.boolean(),
  sessionExpiresAt: z.string().datetime(),
});

export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;

// Keep exported values referenced for schema drift checks in tests.
export const AUTH_ME_ROLE_VALUES = ROLE_VALUES;
export const AUTH_ME_CLEARANCE_VALUES = CLEARANCE_LEVEL_VALUES;
