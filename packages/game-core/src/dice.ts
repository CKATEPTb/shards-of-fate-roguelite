import type { DiceResult, RngState, RngStream } from '@shards/shared';
import { drawRandom } from './random';

export interface ParsedDice { count: number; sides: number; modifier: number }
export function parseDice(expression: string): ParsedDice {
  if (typeof expression !== 'string' || expression.length > 64) throw new Error('Invalid dice expression');
  const match = /^(\d*)d(4|6|8|10|12|20)(?:\s*([+-])\s*(\d+))?$/i.exec(expression.trim());
  if (!match) throw new Error(`Invalid dice expression: ${expression}`);
  const count = match[1] ? Number(match[1]) : 1;
  const modifier = match[4] ? Number(match[4]) * (match[3] === '-' ? -1 : 1) : 0;
  if (!Number.isSafeInteger(count) || count < 1 || count > 1000 || !Number.isSafeInteger(modifier) || Math.abs(modifier) > 1_000_000) throw new Error('Dice count or modifier is out of range');
  return { count, sides: Number(match[2]), modifier };
}

export function drawDice(expression: string, rng: RngState, stream: RngStream = 'COMBAT'): DiceResult {
  const { count, sides, modifier } = parseDice(expression);
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(drawRandom(rng, stream) * sides));
  return { expression, rolls, sides, modifier, total: rolls.reduce((sum, value) => sum + value, modifier) };
}

export function rollDice(expression: string, rng: RngState, stream: RngStream = 'COMBAT'): { result: DiceResult; rng: RngState } {
  const updated = structuredClone(rng);
  return { result: drawDice(expression, updated, stream), rng: updated };
}

export function rollD20(rng: RngState, mode: 'normal' | 'advantage' | 'disadvantage' = 'normal', stream: RngStream = 'COMBAT'): { result: DiceResult; rng: RngState } {
  const rolled = rollDice(mode === 'normal' ? 'd20' : '2d20', rng, stream);
  if (mode !== 'normal') rolled.result.total = (mode === 'advantage' ? Math.max : Math.min)(...rolled.result.rolls);
  return rolled;
}
