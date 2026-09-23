import type { CombatEvent, Combatant, EffectDefinition } from '@shards/shared';
import { runActions } from './actions';
import { compareIds, definitionFor, type CombatContext } from './context';

function matches(ctx: CombatContext, owner: Combatant, effect: EffectDefinition, event: CombatEvent): boolean {
  return effect.conditions.every(condition => {
    if (condition === 'sourceIsOwner') return event.actorId === owner.id;
    if (condition === 'targetIsOwner') return event.targetId === owner.id;
    if (condition === 'ownerAlive') return owner.hp > 0 && !owner.escaped;
    return ctx.state.units.some(target => target.id === event.targetId && target.team === owner.team && !target.escaped);
  });
}

export function triggerEffects(ctx: CombatContext, event: CombatEvent): void {
  // Existing CRIT effects react to critical hits; a critical heal must not burn its recipient.
  if (event.type === 'CRIT' && event.rollReason === 'heal') return;
  const effects = ctx.state.units.flatMap(owner => definitionFor(ctx, owner.definitionId).effectIds.map(id => {
    const effect = ctx.content.effects.find(candidate => candidate.id === id);
    if (!effect) throw new Error(`Unknown effect: ${id}`);
    return { owner, effect };
  })).filter(({ effect }) => effect.trigger === event.type)
    .sort((a, b) => b.effect.priority - a.effect.priority || compareIds(a.effect.id, b.effect.id) || compareIds(a.owner.id, b.owner.id));
  for (const { owner, effect } of effects) {
    if (owner.hp <= 0 || owner.escaped || (owner.effectCooldowns[effect.id] ?? 0) > 0 || !matches(ctx, owner, effect, event)) continue;
    // Set before dispatch: a triggered child event cannot bypass an internal cooldown.
    owner.effectCooldowns[effect.id] = effect.internalCooldown;
    runActions(ctx, effect.actions, { source: owner, target: effect.target, origin: 'effect', event });
  }
}
