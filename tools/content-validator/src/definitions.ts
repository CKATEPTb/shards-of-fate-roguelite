import { z } from 'zod';
import { actionList, actionSchema, nonemptyActionList } from './actions';
import { color, identifier, metadata, modifiers, nonnegative, positive, selector, tags, text } from './common';
import { anatomySchema } from './anatomy';
import { AURA_FAMILIES, AURA_MOTIFS, SKILL_ICON_FRAMES, SKILL_RARITIES, PROJECTILE_KINDS } from '@shards/shared';
import { auraVisualSchema } from './aura-visual';

export const statsSchema = z.object({
  maxHp: positive, power: nonnegative, armor: nonnegative, initiative: z.number().int().min(-1000).max(1000),
  crit: z.number().int().min(0).max(1_000_000), evasion: z.number().int().min(0).max(1_000_000),
  accuracy: z.number().int().min(0).max(1_000_000).optional(), resilience: z.number().int().min(0).max(1_000_000).optional(), luck: z.number().int().min(0).max(1_000_000).optional(),
  agility: z.number().int().min(-1000).max(1000).optional(),
}).strict();

const unitFields = {
  ...metadata, title: text, role: z.enum(['tank', 'healer', 'damage']), color, sprite: identifier,
  stats: statsSchema, movementSpeed: z.number().finite().min(10).max(300).optional(), anatomy: anatomySchema.optional(),
  passive: z.object({ name: text, description: text }).strict().optional(), basicAttack: actionSchema,
  skillIds: z.array(identifier).max(16), effectIds: z.array(identifier).max(32), modifiers, tags,
};
export const unitSchema = z.object(unitFields).strict();
export const enemySchema = z.object({
  ...unitFields, rank: z.enum(['NORMAL', 'SWARM', 'VETERAN', 'ELITE']), encounterCost: positive, level: z.number().int().min(1).max(1000).optional(),
}).strict();

export const skillSchema = z.object({
  ...metadata, cooldown: z.number().int().min(0).max(10_000), priority: z.number().int().min(-10_000).max(10_000),
  rarity: z.enum(SKILL_RARITIES).optional(),
  target: selector, condition: z.enum(['always', 'allyWounded', 'selfWounded', 'hasOtherAlly']), actions: nonemptyActionList, tags,
  icon: z.object({ family: z.enum(AURA_FAMILIES), frame: z.enum(SKILL_ICON_FRAMES), motif: z.enum(AURA_MOTIFS),
    accent: z.enum(AURA_MOTIFS).optional(), colors: z.tuple([color, color, color]), variant: z.number().int().min(0).max(10_000),
  }).strict().optional(),
  projectile: z.enum(PROJECTILE_KINDS).optional(),
}).strict().superRefine((skill, context) => {
  if (skill.tags.includes('LEARNABLE') && !skill.rarity) {
    context.addIssue({ code: 'custom', path: ['rarity'], message: 'A learnable skill needs a rarity tier' });
  }
});

export const effectSchema = z.object({
  ...metadata,
  trigger: z.enum(['COMBAT_STARTED', 'ROUND_STARTED', 'TURN_STARTED', 'SKILL_USED', 'ATTACK_STARTED', 'DICE_ROLLED', 'HIT', 'MISS', 'CRIT', 'BLOCKED', 'DAMAGE', 'HEALED', 'OVERHEALED', 'SHIELD_CREATED', 'SHIELD_UPDATED', 'SHIELD_BROKEN', 'STATUS_APPLIED', 'STATUS_UPDATED', 'STATUS_EXPIRED', 'FLEE_SUCCEEDED', 'FLEE_FAILED', 'ENTITY_DIED', 'TURN_ENDED', 'COMBAT_ENDED']),
  conditions: z.array(z.enum(['sourceIsOwner', 'targetIsOwner', 'targetIsAlly', 'ownerAlive'])).max(4),
  target: selector, actions: nonemptyActionList, priority: z.number().int().min(-10_000).max(10_000),
  internalCooldown: z.number().int().min(0).max(10_000), tags,
}).strict();

export const statusSchema = z.object({
  ...metadata, color, trigger: z.enum(['TURN_STARTED', 'TURN_ENDED']).optional(),
  actions: actionList, modifiers, tags, polarity: z.enum(['positive', 'negative']).optional(), stacking: z.enum(['independent', 'refresh', 'decay']).optional(),
  expiresAt: z.enum(['TURN_STARTED', 'TURN_ENDED']).optional(),
  defaultDuration: z.number().int().min(1).max(10_000).nullable().optional(), visual: auraVisualSchema.optional(),
}).strict().superRefine((status, context) => {
  if (status.actions.length > 0 && !status.trigger) {
    context.addIssue({ code: 'custom', path: ['trigger'], message: 'A status with actions needs a turn trigger' });
  }
  if (status.actions.length === 0 && Object.keys(status.modifiers).length === 0) {
    context.addIssue({ code: 'custom', message: 'A status must supply an action or modifier' });
  }
  if (status.stacking === 'decay' && !status.trigger) {
    context.addIssue({ code: 'custom', path: ['trigger'], message: 'A decaying aura needs a turn trigger to consume its stacks' });
  }
});

export const encounterSchema = z.object({
  ...metadata, biome: text, difficulty: text, enemyIds: z.array(identifier).min(1).max(12),
}).strict();
