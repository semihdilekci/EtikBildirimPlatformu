import { BUSINESS_CALENDAR_DAY_TYPE_VALUES } from '@ethics/shared';
import { z } from 'zod';

const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-MM-DD formatında olmalıdır.');

export const listBusinessCalendarQuerySchema = z.object({
  from: dateKeySchema.optional(),
  to: dateKeySchema.optional(),
});

export type ListBusinessCalendarQuery = z.infer<typeof listBusinessCalendarQuerySchema>;

export const createBusinessCalendarEntryBodySchema = z.object({
  date: dateKeySchema,
  dayType: z.enum(BUSINESS_CALENDAR_DAY_TYPE_VALUES as [string, ...string[]]),
  description: z.string().trim().max(500).optional(),
  reason: z.string().trim().min(3).max(500),
});

export type CreateBusinessCalendarEntryBody = z.infer<typeof createBusinessCalendarEntryBodySchema>;

export const deleteBusinessCalendarEntryBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export type DeleteBusinessCalendarEntryBody = z.infer<typeof deleteBusinessCalendarEntryBodySchema>;

export const businessCalendarEntrySchema = z.object({
  id: z.string(),
  date: dateKeySchema,
  dayType: z.enum(BUSINESS_CALENDAR_DAY_TYPE_VALUES as [string, ...string[]]),
  description: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export type BusinessCalendarEntryDto = z.infer<typeof businessCalendarEntrySchema>;
