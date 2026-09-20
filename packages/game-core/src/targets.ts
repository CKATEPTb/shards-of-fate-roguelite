import type { Combatant, CombatEvent, TargetSelector } from '@shards/shared';
import { compareIds, type CombatContext } from './context';
import { modifiersFor } from './modifiers';
import { healableHealthRatio } from './anatomy';

const byHealth = (left: Combatant, right: Combatant) => left.hp / left.stats.maxHp - right.hp / right.stats.maxHp || compareIds(left.id, right.id);
const byHealableHealth = (left: Combatant, right: Combatant) => healableHealthRatio(left) - healableHealthRatio(right) || compareIds(left.id, right.id);
const byThreat = (left: Combatant, right: Combatant) => right.stats.maxHp - left.stats.maxHp || compareIds(left.id, right.id);
const byTaunt = (left: Combatant, right: Combatant) => right.hp - left.hp || compareIds(left.id, right.id);

export function selectTargets(ctx: CombatContext, source: Combatant, selector: TargetSelector, event?: CombatEvent): Combatant[] {
  const alive = ctx.state.units.filter(unit => unit.hp > 0);
  const allies = alive.filter(unit => unit.team === source.team);
  const enemies = alive.filter(unit => unit.team !== source.team);
  if (selector === 'self') return source.hp > 0 ? [source] : [];
  if (selector === 'eventTarget') return alive.filter(unit => unit.id === event?.targetId);
  if (selector === 'allAllies') return allies;
  if (selector === 'allEnemies') return enemies;
  if (selector === 'lowestHealthAlly') return allies.sort(byHealableHealth).slice(0, 1);
  const taunts = enemies.filter(unit => modifiersFor(ctx, unit).taunt);
  if (taunts.length) return taunts.sort(byTaunt).slice(0, 1);
  if (selector === 'lowestHealthEnemy') return enemies.sort(byHealth).slice(0, 1);
  return enemies.sort(byThreat).slice(0, 1);
}
