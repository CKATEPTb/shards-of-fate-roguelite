import type { Combatant } from '@shards/shared';
import { rollFor } from './combat-rolls';
import { CombatLimitError, type CombatContext } from './context';
import { modifiersFor } from './modifiers';

/** Each tied subgroup rolls again, retaining its position relative to other totals. */
function resolveTies(ctx: CombatContext, units: Combatant[], depth = 0): Combatant[] {
  if (units.length < 2) return units;
  if (depth >= 128) throw new CombatLimitError('Initiative tie exceeded 128 rerolls');
  const rolls = units.map(unit => ({ unit, value: rollFor(ctx, unit, '1d20', 'initiativeTie') }));
  return rankGroups(ctx, rolls, depth + 1);
}

function rankGroups(ctx: CombatContext, rolls: { unit: Combatant; value: number }[], depth: number): Combatant[] {
  const totals = [...new Set(rolls.map(entry => entry.value))].sort((a, b) => b - a);
  return totals.flatMap(total => resolveTies(ctx, rolls.filter(entry => entry.value === total).map(entry => entry.unit), depth));
}

export function rollInitiative(ctx: CombatContext, units: Combatant[]): string[] {
  const rolls = units.map(unit => ({ unit, value: rollFor(ctx, unit, '1d20', 'initiative',
    unit.stats.initiative + modifiersFor(ctx, unit).initiativeBonus) }));
  ctx.state.initiative = { ...ctx.state.initiative, ...Object.fromEntries(rolls.map(entry => [entry.unit.id, entry.value])) };
  return rankGroups(ctx, rolls, 0).map(unit => unit.id);
}

/** Existing combatants retain their result/order; late arrivals roll at the next round boundary. */
export function ensureInitiative(ctx: CombatContext, reroll: boolean): string[] {
  const living = ctx.state.units.filter(unit => unit.hp > 0 && !unit.escaped);
  if (reroll || !ctx.state.initiative) return rollInitiative(ctx, living);
  const incoming = living.filter(unit => !Object.hasOwn(ctx.state.initiative!, unit.id));
  if (!incoming.length) return ctx.state.turnOrder.filter(id => living.some(unit => unit.id === id));
  const incomingIds = new Set(incoming.map(unit => unit.id));
  for (const unit of incoming) ctx.state.initiative[unit.id] = rollFor(ctx, unit, '1d20', 'initiative', unit.stats.initiative + modifiersFor(ctx, unit).initiativeBonus);
  const totals = [...new Set(living.map(unit => ctx.state.initiative![unit.id]))].sort((a, b) => b - a);
  return totals.flatMap(total => {
    const group = living.filter(unit => ctx.state.initiative![unit.id] === total);
    if (group.some(unit => incomingIds.has(unit.id))) return resolveTies(ctx, group);
    return group.sort((a, b) => ctx.state.turnOrder.indexOf(a.id) - ctx.state.turnOrder.indexOf(b.id));
  }).map(unit => unit.id);
}
