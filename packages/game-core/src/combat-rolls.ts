import type { Combatant } from '@shards/shared';
import type { CombatContext } from './context';
import { drawDice } from './dice';

export function rollFor(ctx: CombatContext, source: Combatant, expression: string, reason: string, bonus = 0): number {
  const dice = drawDice(expression, ctx.state.rng);
  const reasons: Record<string, string> = { damage: 'урон', heal: 'лечение', shield: 'щит', accuracy: 'попадание', initiative: 'инициатива', body: 'часть тела' };
  const modifier = dice.modifier + bonus;
  const total = dice.total + bonus;
  ctx.emit({ type: 'DICE_ROLLED', actorId: source.id, rolls: dice.rolls, sides: dice.sides, modifier, amount: total,
    message: `${source.name}: ${reasons[reason] ?? reason}, ${expression}${bonus ? ` ${bonus > 0 ? '+' : '−'} ${Math.abs(bonus)}` : ''} → ${total}` });
  return total;
}

/** Probabilities use the same logged d20 stream as all other combat decisions. */
export function rollChance(ctx: CombatContext, source: Combatant, chance: number, reason: string): boolean {
  if (chance <= 0) return false;
  return rollFor(ctx, source, 'd20', reason) <= Math.min(20, Math.floor(chance * 20 + 1e-9));
}
