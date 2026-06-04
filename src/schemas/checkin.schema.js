import { z } from 'zod';
import { isoDate } from './common.schema.js';

export const checkinCreateSchema = z
  .object({
    date: isoDate,
    status: z.enum(['completed', 'skipped', 'missed']),
    value: z.number().nullable().optional(),
    note: z.string().max(1000).nullable().optional(),
    mood: z.coerce.number().int().min(1).max(5).nullable().optional(),
  })
  .strict();

export const checkinUpdateSchema = z
  .object({
    status: z.enum(['completed', 'skipped', 'missed']).optional(),
    value: z.number().nullable().optional(),
    note: z.string().max(1000).nullable().optional(),
    mood: z.coerce.number().int().min(1).max(5).nullable().optional(),
  })
  .strict();

export const checkinListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: z.enum(['completed', 'skipped', 'missed']).optional(),
});
