import type { Combatant, CombatEvent, DiceCheck, DiceResult } from '@shards/shared';
import type { CombatContext } from './context';
import { drawDice, parseDice } from './dice';
import { createEntityRng } from './random';
import { reserveRoomDice } from './room-random';

export function rollFor(ctx: CombatContext, source: Combatant, expression: string, reason: string, bonus = 0, attack: Pick<CombatEvent, 'attackHand' | 'attackSlot'> = {}): number {
  const rng = ctx.state.rng;
  let dice: DiceResult;
  if (rng.entityDice) {
    const { owners, counters } = rng.entityDice;
    if (!Object.hasOwn(owners, source.id)) throw new Error(`Missing dice owner for combatant: ${source.id}`);
    const owner = owners[source.id];
    const scoped = createEntityRng(rng.seed, owner, Object.hasOwn(counters, owner) ? counters[owner] : 0);
    const { count } = parseDice(expression);
    // Reserve both counts before drawing or committing either one.
    const aggregate = reserveRoomDice(rng, count);
    reserveRoomDice(scoped, count);
    dice = drawDice(expression, scoped);
    Object.defineProperty(counters, owner, { value: scoped.diceIndex, enumerable: true, writable: true, configurable: true });
    rng.diceIndex = aggregate + count;
  } else dice = drawDice(expression, rng);
  const reasons: Record<string, string> = { damage: 'урон', critical: 'критическая проверка', armor: 'защита бронёй', criticalDamage: 'дополнительные кубики критического урона', heal: 'лечение', shield: 'щит', accuracy: 'попадание', attackCheck: 'атака: грань против уклонения, итог с бонусом крита против 20', initiative: 'инициатива', initiativeTie: 'равная инициатива', flee: 'побег', body: 'часть тела', target: 'выбор цели' };
  const modifier = dice.modifier + bonus;
  const total = dice.total + bonus;
  ctx.emit({ type: 'DICE_ROLLED', actorId: source.id, rolls: dice.rolls, sides: dice.sides, modifier, amount: total, rollReason: reason, ...attack,
    message: `${source.name}${attack.attackHand ? `, ${attack.attackHand === 'right' ? 'правая' : 'левая'} рука` : ''}: ${reasons[reason] ?? reason}, ${expression}${bonus ? ` ${bonus > 0 ? '+' : '−'} ${Math.abs(bonus)}` : ''} → ${total}` });
  return total;
}

/** Checks are authored as dice and a visible target, without hidden probability conversion. */
export function rollCheck(ctx: CombatContext, source: Combatant, check: DiceCheck | undefined, reason: string): boolean {
  if (!check) return false;
  if (!Number.isSafeInteger(check.atLeast)) throw new Error('Invalid dice check threshold');
  return rollFor(ctx, source, check.dice, `${reason} (нужно ${check.atLeast}+)`) >= check.atLeast;
}
