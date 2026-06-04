import { z } from 'zod';
import { hexColor } from './common.schema.js';

export const categoryCreateSchema = z
  .object({
    name: z.string().min(1).max(80),
    description: z.string().max(500).nullable().optional(),
    color: hexColor.optional(),
    icon: z.string().max(50).optional(),
  })
  .strict();

export const categoryUpdateSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    description: z.string().max(500).nullable().optional(),
    color: hexColor.optional(),
    icon: z.string().max(50).optional(),
  })
  .strict();
