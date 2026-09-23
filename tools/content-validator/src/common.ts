import { z } from 'zod';
import { TARGET_SELECTORS } from '@shards/shared';

export const identifier = z.string().regex(/^[a-z][a-z0-9_]*$/).max(80);
export const text = z.string().trim().min(1).max(1000);
export const fraction = z.number().finite().min(0).max(1);
export const nonnegative = z.number().finite().min(0).max(1_000_000);
export const positive = z.number().finite().gt(0).max(1_000_000);
export const turns = z.number().int().min(1).max(10_000);
export const tags = z.array(z.string().regex(/^[A-Z][A-Z0-9_]*$/)).max(64);
export const selector = z.enum(TARGET_SELECTORS);
export const metadata = {
  schemaVersion: z.literal(1), id: identifier, name: text, description: text,
};
export const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** The content contract intentionally mirrors dice syntax without importing the engine. */
export function validDiceExpression(expression: string): boolean {
  if (expression.length > 64) return false;
  const match = /^(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?$/i.exec(expression.trim());
  if (!match) return false;
  const count = Number(match[1] || 1);
  const sides = Number(match[2]);
  const modifier = Number(match[4] ?? 0);
  return Number.isSafeInteger(count) && count >= 1 && count <= 1000
    && Number.isSafeInteger(sides) && sides >= 1 && sides <= 1_000_000
    && Number.isSafeInteger(modifier) && modifier <= 1_000_000;
}

export const dice = z.string().refine(validDiceExpression, 'Expected 1–1000 dice, 1–1000000 sides, optional integer modifier up to ±1000000');
export const diceCheck = z.object({ dice, atLeast: z.number().int().min(-1_000_000).max(1_000_000_000) }).strict();
const bonus = z.number().int().min(-1_000_000).max(1_000_000);
export const modifiers = z.object({
  damageBonus: bonus.optional(), damageReduction: nonnegative.optional(), partyDamageReduction: nonnegative.optional(),
  taunt: z.boolean().optional(), vampirismDice: dice.optional(), healingShareDice: dice.optional(),
  preserveHot: diceCheck.optional(), preserveShield: diceCheck.optional(), repeatAttack: diceCheck.optional(),
  guaranteedCrit: z.boolean().optional(), evasionBonus: bonus.optional(), initiativeBonus: bonus.optional(), agilityBonus: bonus.optional(),
  damageBonusDice: dice.optional(), partyGuardDice: dice.optional(), invulnerable: z.boolean().optional(),
  accuracyBonus: bonus.optional(), critBonus: bonus.optional(), armorBonus: bonus.optional(), powerBonus: bonus.optional(), resilienceBonus: bonus.optional(), luckBonus: bonus.optional(),
}).strict();
