import type { ActiveStatus, Combatant } from '@shards/shared';
import { runActions } from './actions';
import type { CombatContext } from './context';
import { modifiersFor } from './modifiers';
import { rollCheck } from './combat-rolls';

function statusUpdate(ctx: CombatContext, actor: Combatant, status: ActiveStatus, message: string): void {
  ctx.emit({ type: 'STATUS_UPDATED', actorId: status.sourceId, targetId: actor.id, statusId: status.id,
    statusInstanceId: status.instanceId, statusRemaining: status.remaining, statusStacks: status.stacks, message });
}

function removeStatus(ctx: CombatContext, actor: Combatant, status: ActiveStatus): void {
  actor.statuses = actor.statuses.filter(candidate => candidate !== status);
  ctx.emit({ type: 'STATUS_EXPIRED', actorId: actor.id, targetId: actor.id, statusId: status.id,
    statusInstanceId: status.instanceId, statusRemaining: 0, statusStacks: 0,
    message: `${actor.name}: ${ctx.content.statuses.find(definition => definition.id === status.id)!.name} завершён` });
}

export function tickStatuses(ctx: CombatContext, actor: Combatant, trigger: 'TURN_STARTED' | 'TURN_ENDED'): void {
  // A copy prevents a trigger's newly applied status from recursively ticking now.
  for (const status of [...actor.statuses]) {
    if (actor.hp <= 0 || actor.escaped) break;
    if (status.appliedTurn >= ctx.state.turn || !actor.statuses.includes(status)) continue;
    const definition = ctx.content.statuses.find(candidate => candidate.id === status.id);
    if (!definition) throw new Error(`Unknown status: ${status.id}`);
    if (definition.trigger !== trigger) continue;
    const source = ctx.state.units.find(unit => unit.id === status.sourceId);
    if (!source) throw new Error(`Unknown status source: ${status.sourceId}`);
    const tickStart = ctx.state.events.length;
    runActions(ctx, definition.actions, { source, target: 'self', origin: 'status', statusId: status.id,
      remaining: status.remaining, stacks: status.stacks ?? 1, bearer: actor });
    // Attribute the entire resolved tick, including shield/defence reactions,
    // for presentation. Do this after triggers resolve so metadata cannot alter
    // their rules, dice stream, or event order.
    for (let index = tickStart; index < ctx.state.events.length; index++) {
      const event = ctx.state.events[index];
      if (!event.statusId && ['DICE_ROLLED', 'DAMAGE', 'BLOCKED', 'HEALED', 'OVERHEALED', 'SHIELD_CREATED', 'SHIELD_UPDATED', 'SHIELD_BROKEN'].includes(event.type)) event.statusId = status.id;
    }
    if (!actor.statuses.includes(status)) continue;
    if (definition.stacking === 'decay') {
      status.stacks = Math.max(0, (status.stacks ?? 1) - 1);
      if (status.stacks === 0) removeStatus(ctx, actor, status);
      else statusUpdate(ctx, actor, status, `${actor.name}: ${definition.name}, осталось зарядов: ${status.stacks}`);
    } else if (definition.tags.includes('HOT') && status.remaining !== null && source.hp > 0 && !source.escaped
      && rollCheck(ctx, source, modifiersFor(ctx, source).preserveHot, 'продление регенерации')) {
      status.remaining++;
      statusUpdate(ctx, actor, status, `${actor.name}: ${definition.name} продлена на 1 ход (осталось: ${status.remaining})`);
    }
  }
}

export function expireStatuses(ctx: CombatContext, actor: Combatant, trigger: 'TURN_STARTED' | 'TURN_ENDED' = 'TURN_ENDED'): void {
  for (const status of [...actor.statuses]) {
    if (status.appliedTurn >= ctx.state.turn || status.remaining === null || !actor.statuses.includes(status)) continue;
    const definition = ctx.content.statuses.find(candidate => candidate.id === status.id)!;
    if (definition.stacking === 'decay' || (definition.expiresAt ?? 'TURN_ENDED') !== trigger) continue;
    status.remaining--;
    if (status.remaining <= 0) removeStatus(ctx, actor, status);
    else statusUpdate(ctx, actor, status, `${actor.name}: ${definition.name}, осталось ходов: ${status.remaining}`);
  }
}
