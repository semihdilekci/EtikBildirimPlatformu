import { z } from 'zod';

export const authLogoutResponseSchema = z.object({
  loggedOut: z.literal(true),
  idpLogoutUrl: z.string().url().nullable(),
});

export type AuthLogoutResponse = z.infer<typeof authLogoutResponseSchema>;
