import type { Combatant, CombatEvent, TargetSelector } from '@shards/shared';
import { compareIds, type CombatContext } from './context';
import { modifiersFor } from './modifiers';
import { healableHealthRatio } from './anatomy';
import { rollFor } from './combat-rolls';

const byHealth = (left: Combatant, right: Combatant) => left.hp / left.stats.maxHp - right.hp / right.stats.maxHp || compareIds(left.id, right.id);
const byHealableHealth = (left: Combatant, right: Combatant) => healableHealthRatio(left) - healableHealthRatio(right) || compareIds(left.id, right.id);
const byThreat = (left: Combatant, right: Combatant) => right.stats.maxHp - left.stats.maxHp || compareIds(left.id, right.id);

/** A later challenge replaces the focus, including attacks that normally strike a whole party. */
export function forcedTauntTarget(ctx: CombatContext, source: Combatant): Combatant | undefined {
  const freshness = (unit: Combatant) => unit.statuses.reduce<[number, number]>((latest, status) => {
    if (!ctx.content.statuses.find(candidate => candidate.id === status.id)?.modifiers.taunt) return latest;
    const sequence = Number(status.instanceId?.match(/(\d+)$/)?.[1] ?? 0);
    return status.appliedTurn > latest[0] || status.appliedTurn === latest[0] && sequence > latest[1]
      ? [status.appliedTurn, sequence] : latest;
  }, [-1, -1]);
  return ctx.state.units.filter(unit => unit.team !== source.team && unit.hp > 0 && !unit.escaped && modifiersFor(ctx, unit).taunt)
    .sort((left, right) => {
      const a = freshness(left);
      const b = freshness(right);
      return b[0] - a[0] || b[1] - a[1] || compareIds(left.id, right.id);
    })[0];
}

export function isRandomTargetSelector(selector: TargetSelector): boolean {
  return selector === 'randomEnemy' || selector === 'randomAlly' || selector === 'randomUnit';
}

export function matchesTargetRelation(source: Combatant, target: Combatant, relation?: 'ally' | 'enemy'): boolean {
  return relation === undefined || (source.team === target.team) === (relation === 'ally');
}

/** Pure candidates: inspection by the UI, AI and validation must never consume a die. */
export function eligibleTargets(ctx: CombatContext, source: Combatant, selector: TargetSelector, event?: CombatEvent): Combatant[] {
  const alive = ctx.state.units.filter(unit => unit.hp > 0 && !unit.escaped);
  if (selector === 'self') return source.hp > 0 && !source.escaped ? [source] : [];
  if (selector === 'eventTarget') return alive.filter(unit => unit.id === event?.targetId);
  if (selector === 'ally' || selector === 'lowestHealthAlly' || selector === 'allAllies' || selector === 'randomAlly') {
    return alive.filter(unit => unit.team === source.team);
  }
  const taunter = forcedTauntTarget(ctx, source);
  if (selector === 'any' || selector === 'randomUnit') {
    // A challenge controls only hostile targets; friendly fire remains a real choice.
    return taunter ? alive.filter(unit => unit.team === source.team || unit.id === taunter.id) : alive;
  }
  if (taunter) return [taunter];
  return alive.filter(unit => unit.team !== source.team);
}

/** Resolve one selector once; callers retain this result for all strikes of an action. */
export function selectTargets(ctx: CombatContext, source: Combatant, selector: TargetSelector, event?: CombatEvent, targetId?: string): Combatant[] {
  const candidates = eligibleTargets(ctx, source, selector, event);
  if (isRandomTargetSelector(selector)) {
    if (candidates.length < 2) return candidates;
    candidates.sort((left, right) => compareIds(left.id, right.id));
    const index = rollFor(ctx, source, `1d${candidates.length}`, 'target') - 1;
    return [candidates[index]];
  }
  if (selector === 'self' || selector === 'eventTarget' || selector === 'allAllies' || selector === 'allEnemies') return candidates;
  if (selector === 'ally' || selector === 'lowestHealthAlly') return targetId
    ? candidates.filter(unit => unit.id === targetId) : candidates.sort(byHealableHealth).slice(0, 1);
  if (targetId) {
    const selected = candidates.find(unit => unit.id === targetId);
    if (selected) return [selected];
    // Validation rejects disallowed manual targets, while event actions still obey a new taunt.
    const intended = ctx.state.units.find(unit => unit.id === targetId);
    const taunter = forcedTauntTarget(ctx, source);
    return taunter && (selector !== 'any' || intended?.team !== source.team) ? [taunter] : [];
  }
  if (selector === 'lowestHealthEnemy') return candidates.sort(byHealth).slice(0, 1);
  if (selector === 'any') {
    const enemies = candidates.filter(unit => unit.team !== source.team);
    return enemies.length ? enemies.sort(byThreat).slice(0, 1) : candidates.sort(byHealableHealth).slice(0, 1);
  }
  return candidates.sort(byThreat).slice(0, 1);
}
