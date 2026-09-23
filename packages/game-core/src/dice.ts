import type { DiceResult, RngState, RngStream } from '@shards/shared';
import { drawRandom } from './random';
import { drawRoomDie, reserveRoomDice } from './room-random';

export const MIN_DICE_SIDES = 1;
export const MAX_DICE_SIDES = 1_000_000;

function validateSides(sides: number): void {
  if (!Number.isSafeInteger(sides) || sides < MIN_DICE_SIDES || sides > MAX_DICE_SIDES) throw new Error('Dice sides must be an integer in [1, 1000000]');
}

export interface ParsedDice { count: number; sides: number; modifier: number }
export function parseDice(expression: string): ParsedDice {
  if (typeof expression !== 'string' || expression.length > 64) throw new Error('Invalid dice expression');
  const match = /^(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?$/i.exec(expression.trim());
  if (!match) throw new Error(`Invalid dice expression: ${expression}`);
  const count = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]);
  const modifier = match[4] ? Number(match[4]) * (match[3] === '-' ? -1 : 1) : 0;
  if (!Number.isSafeInteger(count) || count < 1 || count > 1000 || !Number.isSafeInteger(modifier) || Math.abs(modifier) > 1_000_000) throw new Error('Dice count or modifier is out of range');
  validateSides(sides);
  return { count, sides, modifier };
}

export function drawDie(sides: number, rng: RngState, stream: RngStream = 'COMBAT'): number {
  validateSides(sides);
  return rng.diceIndex === undefined ? 1 + Math.floor(drawRandom(rng, stream) * sides) : drawRoomDie(sides, rng);
}

export function drawDice(expression: string, rng: RngState, stream: RngStream = 'COMBAT'): DiceResult {
  const { count, sides, modifier } = parseDice(expression);
  if (rng.diceIndex !== undefined) reserveRoomDice(rng, count);
  const rolls = Array.from({ length: count }, () => drawDie(sides, rng, stream));
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
