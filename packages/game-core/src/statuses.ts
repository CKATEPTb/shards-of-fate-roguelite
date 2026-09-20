import type { Combatant } from '@shards/shared';
import { runActions } from './actions';
import type { CombatContext } from './context';
import { modifiersFor } from './modifiers';
import { rollChance } from './combat-rolls';

export function tickStatuses(ctx: CombatContext, actor: Combatant, trigger: 'TURN_STARTED' | 'TURN_ENDED'): void {
  // A copy prevents a trigger's newly applied status from recursively ticking now.
  for (const status of [...actor.statuses]) {
    if (actor.hp <= 0) break;
    if (status.appliedTurn >= ctx.state.turn || !actor.statuses.includes(status)) continue;
    const definition = ctx.content.statuses.find(candidate => candidate.id === status.id);
    if (!definition) throw new Error(`Unknown status: ${status.id}`);
    if (definition.trigger !== trigger) continue;
    const source = ctx.state.units.find(unit => unit.id === status.sourceId);
    if (!source) throw new Error(`Unknown status source: ${status.sourceId}`);
    runActions(ctx, definition.actions, { source, target: 'self', origin: 'status', statusId: status.id, remaining: status.remaining, bearer: actor });
  }
}

export function expireStatuses(ctx: CombatContext, actor: Combatant): void {
  const expired = actor.statuses.filter(status => {
    if (status.appliedTurn >= ctx.state.turn) return false;
    const definition = ctx.content.statuses.find(candidate => candidate.id === status.id)!;
    const source = ctx.state.units.find(unit => unit.id === status.sourceId);
    if (definition.tags.includes('HOT') && source && source.hp > 0
      && rollChance(ctx, source, modifiersFor(ctx, source).preserveHotChance, 'сохранение исцеления')) return false;
    return --status.remaining <= 0;
  });
  actor.statuses = actor.statuses.filter(status => !expired.includes(status));
  for (const status of expired) ctx.emit({ type: 'STATUS_EXPIRED', actorId: actor.id, targetId: actor.id, statusId: status.id, message: `${actor.name}: ${ctx.content.statuses.find(definition => definition.id === status.id)!.name} завершён` });
}
