import { z } from 'zod';

const trackingCodePattern =
  /^ETK-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/;

export const trackingLoginSchema = z.object({
  trackingCode: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => trackingCodePattern.test(value), {
      message: 'Geçerli bir takip kodu giriniz (ETK-XXXX-XXXX).',
    }),
  trackingPassword: z.string().min(1, 'Takip şifresi zorunludur.'),
});

export type TrackingLoginValues = z.infer<typeof trackingLoginSchema>;

export const trackingVerifyResponseSchema = z.object({
  verified: z.literal(true),
  reportStatus: z.string(),
  hasUnreadMessages: z.boolean(),
  submittedAt: z.string(),
});

export type TrackingVerifyResponse = z.infer<typeof trackingVerifyResponseSchema>;

export const trackingStatusResponseSchema = z.object({
  trackingCode: z.string(),
  status: z.string(),
  statusLabel: z.string(),
  submittedAt: z.string(),
  lastActivityAt: z.string().nullable(),
});

export type TrackingStatusResponse = z.infer<typeof trackingStatusResponseSchema>;
