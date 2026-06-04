import { z } from 'zod';

export const userUpdateSchema = z
  .object({
    displayName: z.string().min(1).max(100).optional(),
    avatarUrl: z.string().url().nullable().optional(),
    timezone: z.string().optional(),
    locale: z.string().optional(),
    weekStartDay: z.enum(['monday', 'sunday']).optional(),
  })
  .strict();
