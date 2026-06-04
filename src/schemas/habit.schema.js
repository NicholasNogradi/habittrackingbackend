import { z } from 'zod';
import { hexColor, isoDate, weekday, uuid } from './common.schema.js';

const base = {
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  categoryId: uuid.nullable().optional(),
  color: hexColor.nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  frequency: z.enum(['daily', 'weekly', 'custom']),
  targetDays: z.array(weekday).optional(),
  targetCount: z.coerce.number().int().min(1).default(1),
  unit: z.string().max(50).nullable().optional(),
  targetValue: z.number().nullable().optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.nullable().optional(),
};

// POST and PUT use the full create schema.
export const habitCreateSchema = z.object(base).strict();

// PATCH allows partial updates plus status.
export const habitUpdateSchema = z
  .object({
    name: base.name.optional(),
    description: base.description,
    categoryId: base.categoryId,
    color: base.color,
    icon: base.icon,
    frequency: z.enum(['daily', 'weekly', 'custom']).optional(),
    targetDays: base.targetDays,
    targetCount: z.coerce.number().int().min(1).optional(),
    unit: base.unit,
    targetValue: base.targetValue,
    status: z.enum(['active', 'paused', 'archived']).optional(),
    endDate: base.endDate,
  })
  .strict();

export const habitListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  categoryId: uuid.optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
  frequency: z.enum(['daily', 'weekly', 'custom']).optional(),
  sort: z
    .enum(['name', '-name', 'createdAt', '-createdAt', 'streak', '-streak'])
    .default('-createdAt'),
});
