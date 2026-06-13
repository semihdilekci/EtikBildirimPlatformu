import { SecureMessageApiDirection } from '@ethics/shared';
import { z } from 'zod';

export const sendSecureMessageBodySchema = z.object({
  bodyText: z
    .string()
    .trim()
    .min(1, 'Mesaj metni zorunludur.')
    .max(5000, 'Mesaj en fazla 5000 karakter olabilir.'),
});

export type SendSecureMessageBody = z.infer<typeof sendSecureMessageBodySchema>;

export const secureMessageItemSchema = z.object({
  id: z.string(),
  direction: z.enum([SecureMessageApiDirection.INBOUND, SecureMessageApiDirection.OUTBOUND]),
  senderLabel: z.string(),
  bodyText: z.string(),
  sentAt: z.string(),
  isRead: z.boolean(),
});

export type SecureMessageItem = z.infer<typeof secureMessageItemSchema>;

export const secureMessageListResponseSchema = z.object({
  data: z.array(secureMessageItemSchema),
});

export const sendSecureMessageResponseSchema = z.object({
  id: z.string(),
  sentAt: z.string(),
});

export type SendSecureMessageResponse = z.infer<typeof sendSecureMessageResponseSchema>;
