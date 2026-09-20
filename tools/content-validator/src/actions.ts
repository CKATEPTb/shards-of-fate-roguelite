import { z } from 'zod';
import { dice, identifier, nonnegative, selector, turns } from './common';

const amountFields = {
  dice: dice.optional(), scaling: z.enum(['power', 'healing']).optional(),
  factor: nonnegative.optional(), target: selector.optional(),
  scaleWithRemainingDuration: z.boolean().optional(),
};

const numericAction = z.object({ type: z.enum(['damage', 'heal', 'shield']), ...amountFields, duration: turns.optional() }).strict()
  .superRefine((action, context) => {
    if (!action.dice && !action.scaling) {
      context.addIssue({ code: 'custom', message: 'Numeric actions need dice or a scaling stat' });
    }
    if (action.factor !== undefined && !action.scaling) {
      context.addIssue({ code: 'custom', path: ['factor'], message: 'A factor requires a scaling stat' });
    }
    if (action.duration !== undefined && action.type !== 'shield') {
      context.addIssue({ code: 'custom', path: ['duration'], message: 'Only shields can have a numeric-action duration' });
    }
  });

const statusAction = z.object({
  type: z.literal('status'), statusId: identifier, duration: turns, target: selector.optional(),
}).strict();

export const actionSchema = z.union([numericAction, statusAction]);
export const actionList = z.array(actionSchema).max(32);
export const nonemptyActionList = actionList.min(1);
