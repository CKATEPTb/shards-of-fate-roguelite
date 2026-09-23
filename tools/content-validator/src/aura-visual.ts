import { AURA_FAMILIES, AURA_FORMS, AURA_MOTIONS, AURA_MOTIFS } from '@shards/shared';
import { z } from 'zod';
import { color } from './common';

/** Shared by authored statuses and auras derived from equipped sets. */
export const auraVisualSchema = z.object({
  family: z.enum(AURA_FAMILIES), form: z.enum(AURA_FORMS), motion: z.enum(AURA_MOTIONS), motif: z.enum(AURA_MOTIFS),
  colors: z.tuple([color, color, color]), variant: z.number().int().min(0).max(10_000),
  count: z.number().int().min(1).max(32), radius: z.number().min(1).max(64), height: z.number().min(1).max(96),
  speed: z.number().min(0.1).max(4),
}).strict();
