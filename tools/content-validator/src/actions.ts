import { z } from 'zod';
import { dice, identifier, nonnegative, positive, selector, turns } from './common';

const amountFields = {
  dice: dice.optional(), scaling: z.enum(['power', 'healing']).optional(),
  factor: nonnegative.optional(), target: selector.optional(),
  targetRelation: z.enum(['ally', 'enemy']).optional(),
  scaleWithRemainingDuration: z.boolean().optional(),
};

const numericAction = z.object({
  type: z.enum(['damage', 'heal', 'shield']), ...amountFields, duration: turns.nullable().optional(),
  hits: z.number().int().min(1).max(32).optional(),
  onHitStatusId: identifier.optional(), onHitDuration: turns.nullable().optional(),
  damagePerStack: positive.optional(), bypassArmor: z.boolean().optional(),
}).strict()
  .superRefine((action, context) => {
    if (!action.dice && !action.scaling && action.damagePerStack === undefined) {
      context.addIssue({ code: 'custom', message: 'Numeric actions need dice, a scaling stat or damage per aura stack' });
    }
    if (action.factor !== undefined && !action.scaling) {
      context.addIssue({ code: 'custom', path: ['factor'], message: 'A factor requires a scaling stat' });
    }
    if (action.duration !== undefined && action.type !== 'shield') {
      context.addIssue({ code: 'custom', path: ['duration'], message: 'Only shields can have a numeric-action duration' });
    }
    for (const field of ['hits', 'onHitStatusId', 'onHitDuration', 'damagePerStack', 'bypassArmor'] as const) {
      if (action[field] !== undefined && action.type !== 'damage') {
        context.addIssue({ code: 'custom', path: [field], message: 'This property is available only to damage actions' });
      }
    }
    if (action.onHitDuration !== undefined && action.onHitStatusId === undefined) {
      context.addIssue({ code: 'custom', path: ['onHitDuration'], message: 'An on-hit duration requires an on-hit status' });
    }
  });

const statusAction = z.object({
  type: z.literal('status'), statusId: identifier, duration: turns.nullable(), target: selector.optional(),
  targetRelation: z.enum(['ally', 'enemy']).optional(),
}).strict();

export const actionSchema = z.union([numericAction, statusAction]);
export const actionList = z.array(actionSchema).max(32);
export const nonemptyActionList = actionList.min(1);
