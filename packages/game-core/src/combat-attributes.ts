import type { Combatant, CombatEvent } from '@shards/shared';
import type { CombatContext } from './context';
import { modifiersFor } from './modifiers';
import { rollFor } from './combat-rolls';

/** A separate check for every direct hit or heal; its natural twenty always succeeds. */
export function rollCritical(ctx: CombatContext, source: Combatant, target: Combatant,
  kind: 'damage' | 'heal', identity: Pick<CombatEvent, 'attackHand' | 'attackSlot'> = {}): boolean {
  const bonuses = modifiersFor(ctx, source);
  const resilience = kind === 'damage' ? (target.stats.resilience ?? 0) + modifiersFor(ctx, target).resilienceBonus : 0;
  const threshold = 20 - source.stats.crit - bonuses.critBonus + resilience;
  const face = rollFor(ctx, source, '1d20', 'critical', 0, identity);
  return kind === 'damage' && bonuses.guaranteedCrit || face === 20 || face >= threshold;
}

/** Armour belongs to the defender's dice stream, including a deterministic residual d1. */
export function rollArmorDefense(ctx: CombatContext, defender: Combatant, armor: number): number {
  const value = Math.max(0, Math.floor(armor));
  let fullDice = Math.floor(value / 20);
  const remainder = value % 20;
  let absorbed = 0;
  // The expression and event formats allow at most 1000 dice in one roll.
  while (fullDice > 0) {
    const batch = Math.min(1000, fullDice);
    absorbed += rollFor(ctx, defender, `${batch}d20`, 'armor');
    fullDice -= batch;
  }
  if (remainder > 0) absorbed += rollFor(ctx, defender, `1d${remainder}`, 'armor');
  return absorbed;
}
