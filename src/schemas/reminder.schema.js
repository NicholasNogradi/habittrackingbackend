import { z } from 'zod';
import { hhmm, weekday, isoDate } from './common.schema.js';

export const reminderCreateSchema = z
  .object({
    time: hhmm,
    daysOfWeek: z.array(weekday).optional(),
    channel: z.enum(['push', 'email', 'sms']),
    message: z.string().max(200).nullable().optional(),
    isEnabled: z.boolean().default(true),
  })
  .strict();

export const reminderUpdateSchema = z
  .object({
    time: hhmm.optional(),
    daysOfWeek: z.array(weekday).optional(),
    channel: z.enum(['push', 'email', 'sms']).optional(),
    message: z.string().max(200).nullable().optional(),
    isEnabled: z.boolean().optional(),
  })
  .strict();

export const analyticsSummaryQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
});

export const habitTrendsQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  granularity: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
});
