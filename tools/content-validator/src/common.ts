import { z } from 'zod';

export const identifier = z.string().regex(/^[a-z][a-z0-9_]*$/).max(80);
export const text = z.string().trim().min(1).max(1000);
export const fraction = z.number().finite().min(0).max(1);
export const nonnegative = z.number().finite().min(0).max(1_000_000);
export const positive = z.number().finite().gt(0).max(1_000_000);
export const turns = z.number().int().min(1).max(10_000);
export const tags = z.array(z.string().regex(/^[A-Z][A-Z0-9_]*$/)).max(64);
export const selector = z.enum(['self', 'enemy', 'lowestHealthEnemy', 'lowestHealthAlly', 'allAllies', 'allEnemies', 'eventTarget']);
export const metadata = {
  schemaVersion: z.literal(1), id: identifier, name: text, description: text,
};
export const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const modifiers = z.object({
  damageMultiplier: z.number().finite().gt(0).max(10).optional(),
  damageReduction: z.number().finite().min(0).max(0.9).optional(),
  partyDamageReduction: z.number().finite().min(0).max(0.9).optional(),
  taunt: z.boolean().optional(),
  vampirism: fraction.optional(), healingShare: fraction.optional(),
  preserveHotChance: fraction.optional(), preserveShieldChance: fraction.optional(),
  guaranteedCrit: z.boolean().optional(), evasionBonus: fraction.optional(),
  repeatChance: z.number().finite().min(0).max(10).optional(),
}).strict();

/** The content contract intentionally mirrors dice syntax without importing the engine. */
export function validDiceExpression(expression: string): boolean {
  if (expression.length > 64) return false;
  const match = /^(\d*)d(4|6|8|10|12|20)(?:\s*([+-])\s*(\d+))?$/i.exec(expression.trim());
  if (!match) return false;
  const count = Number(match[1] || 1);
  const modifier = Number(match[4] ?? 0);
  return Number.isSafeInteger(count) && count >= 1 && count <= 1000
    && Number.isSafeInteger(modifier) && modifier <= 1_000_000;
}

export const dice = z.string().refine(validDiceExpression, 'Expected 1–1000 dice, sides 4/6/8/10/12/20, optional integer modifier up to ±1000000');
