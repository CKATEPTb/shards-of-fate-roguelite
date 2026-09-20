import { z } from 'zod';
import { fraction, nonnegative, positive, turns } from './common';
import { effectSchema, encounterSchema, enemySchema, skillSchema, statusSchema, unitSchema } from './definitions';
import { difficultiesSchema } from './difficulty';

const scaling = z.object({ hp: positive, damage: positive }).strict();

export const contentSchema = z.object({
  schemaVersion: z.literal(1),
  difficulties: difficultiesSchema.optional(),
  characters: z.array(unitSchema).min(1).max(1000),
  enemies: z.array(enemySchema).min(1).max(10_000),
  skills: z.array(skillSchema).max(10_000),
  effects: z.array(effectSchema).max(10_000),
  statuses: z.array(statusSchema).max(10_000),
  encounters: z.array(encounterSchema).min(1).max(10_000),
  balance: z.object({
    maxRounds: turns, maxTriggerDepth: z.number().int().min(1).max(100),
    maxEventsPerStep: z.number().int().min(1).max(1_000_000),
    armorFactor: nonnegative, maxDamageReduction: z.number().finite().min(0).lt(1),
    critMultiplier: z.number().finite().min(1).max(10), healThreshold: fraction,
    partyScaling: z.object({ 1: scaling, 2: scaling, 3: scaling, 4: scaling }).strict(),
  }).strict(),
}).strict();
