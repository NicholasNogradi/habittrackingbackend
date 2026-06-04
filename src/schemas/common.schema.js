import { z } from 'zod';

export const uuid = z.string().uuid();

export const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'must be a 6-digit hex colour, e.g. #4CAF50');

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO 8601 date (YYYY-MM-DD)');

export const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a 24-hour time (HH:mm)');

export const weekday = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const idParam = (name) => z.object({ [name]: uuid });
