import { DIFFICULTY_IDS } from '@shards/shared';
import { z } from 'zod';
import { fraction, positive, text } from './common';

const profile = z.object({
  id: z.enum(DIFFICULTY_IDS), name: text, description: text,
  enemyHpMultiplier: positive, enemyDamageMultiplier: positive,
  epicGroupChance: fraction, minibossChunkChance: fraction, rareLootMultiplier: positive,
}).strict();

export const difficultiesSchema = z.object({ normal: profile, hard: profile, nightmare: profile }).strict().superRefine((profiles, context) => {
  for (const id of DIFFICULTY_IDS) if (profiles[id].id !== id) context.addIssue({ code: 'custom', path: [id, 'id'], message: 'Difficulty ID must match its profile key' });
});
