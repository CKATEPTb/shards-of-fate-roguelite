import type { Combatant } from '@shards/shared';
import { healBody, syncBodyCombatant } from './anatomy';
import { definitionFor, type CombatContext } from './context';
import { modifiersFor } from './modifiers';
import { rollFor } from './combat-rolls';

/** Receives the final amount: only a direct healing action may roll/double a critical before entering here. */
export function applyHealing(ctx: CombatContext, source: Combatant, target: Combatant, amount: number): number {
  if (target.hp <= 0 || target.escaped || amount <= 0) return 0;
  amount = Math.floor(amount);
  let actual: number;
  if (target.body) {
    const result = healBody(target.body, amount);
    target.body = result.body;
    actual = result.healed;
    syncBodyCombatant(target, definitionFor(ctx, target.definitionId));
  } else {
    actual = Math.min(target.stats.maxHp - target.hp, amount);
    target.hp += actual;
  }
  if (actual > 0) ctx.emit({ type: 'HEALED', actorId: source.id, targetId: target.id, amount: actual, message: `${target.name}: восстановлено ${actual} HP` });
  if (amount > actual) ctx.emit({ type: 'OVERHEALED', actorId: source.id, targetId: target.id, amount: amount - actual, message: `${target.name}: избыточное лечение ${amount - actual}` });
  const sharingDice = modifiersFor(ctx, target).healingShareDice;
  if (actual > 0 && sharingDice && target.hp > 0 && !ctx.sharingHealing) {
    ctx.sharingHealing = true;
    try {
      const shared = rollFor(ctx, target, sharingDice, 'общий свет');
      for (const ally of ctx.state.units.filter(unit => unit.team === target.team && unit.hp > 0 && !unit.escaped)) applyHealing(ctx, target, ally, shared);
    } finally { ctx.sharingHealing = false; }
  }
  return actual;
}
