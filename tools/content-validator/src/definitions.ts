import { z } from 'zod';
import { actionList, actionSchema, nonemptyActionList } from './actions';
import { color, fraction, identifier, metadata, modifiers, nonnegative, positive, selector, tags, text } from './common';
import { anatomySchema } from './anatomy';

export const statsSchema = z.object({
  maxHp: positive, power: nonnegative, armor: nonnegative, initiative: nonnegative,
  crit: fraction, evasion: fraction, healing: nonnegative,
}).strict();

const unitFields = {
  ...metadata, title: text, role: z.enum(['tank', 'healer', 'damage']), color, sprite: identifier,
  stats: statsSchema, movementSpeed: z.number().finite().min(10).max(300).optional(), anatomy: anatomySchema.optional(),
  passive: z.object({ name: text, description: text }).strict().optional(), basicAttack: actionSchema,
  skillIds: z.array(identifier).max(16), effectIds: z.array(identifier).max(32), modifiers, tags,
};
export const unitSchema = z.object(unitFields).strict();
export const enemySchema = z.object({
  ...unitFields, rank: z.enum(['NORMAL', 'SWARM', 'VETERAN', 'ELITE']), encounterCost: positive,
}).strict();

export const skillSchema = z.object({
  ...metadata, cooldown: z.number().int().min(0).max(10_000), priority: z.number().int().min(-10_000).max(10_000),
  target: selector, condition: z.enum(['always', 'allyWounded', 'selfWounded', 'hasOtherAlly']), actions: nonemptyActionList, tags,
}).strict();

export const effectSchema = z.object({
  ...metadata,
  trigger: z.enum(['COMBAT_STARTED', 'ROUND_STARTED', 'TURN_STARTED', 'SKILL_USED', 'ATTACK_STARTED', 'DICE_ROLLED', 'HIT', 'MISS', 'CRIT', 'DAMAGE', 'HEALED', 'OVERHEALED', 'SHIELD_CREATED', 'SHIELD_BROKEN', 'STATUS_APPLIED', 'STATUS_EXPIRED', 'ENTITY_DIED', 'TURN_ENDED', 'COMBAT_ENDED']),
  conditions: z.array(z.enum(['sourceIsOwner', 'targetIsOwner', 'targetIsAlly', 'ownerAlive'])).max(4),
  target: selector, actions: nonemptyActionList, priority: z.number().int().min(-10_000).max(10_000),
  internalCooldown: z.number().int().min(0).max(10_000), tags,
}).strict();

export const statusSchema = z.object({
  ...metadata, color, trigger: z.enum(['TURN_STARTED', 'TURN_ENDED']).optional(),
  actions: actionList, modifiers, tags,
}).strict().superRefine((status, context) => {
  if (status.actions.length > 0 && !status.trigger) {
    context.addIssue({ code: 'custom', path: ['trigger'], message: 'A status with actions needs a turn trigger' });
  }
  if (status.actions.length === 0 && Object.keys(status.modifiers).length === 0) {
    context.addIssue({ code: 'custom', message: 'A status must supply an action or modifier' });
  }
});

export const encounterSchema = z.object({
  ...metadata, biome: text, difficulty: text, enemyIds: z.array(identifier).min(1).max(12),
}).strict();
