import type { ActionDefinition, Combatant, TargetSelector } from '@shards/shared';
import { canBodyAct } from './anatomy';
import { runActions } from './actions';
import { definitionFor, type CombatContext } from './context';
import { rollChance } from './combat-rolls';
import { modifiersFor } from './modifiers';

/** Repeat is one extra basic attack after a damaging action, never a recursive chain. */
export function runAttackTurn(ctx: CombatContext, actor: Combatant, actions: ActionDefinition[], target: TargetSelector, skillId?: string): void {
  runActions(ctx, actions, { source: actor, target, origin: 'attack', skillId });
  if (!actions.some(action => action.type === 'damage') || actor.hp <= 0 || actor.body && !canBodyAct(actor.body)
    || !ctx.state.units.some(unit => unit.team !== actor.team && unit.hp > 0)) return;
  if (rollChance(ctx, actor, modifiersFor(ctx, actor).repeatChance, 'повторная атака')) {
    runActions(ctx, [definitionFor(ctx, actor.definitionId).basicAttack], { source: actor, target: 'enemy', origin: 'attack' });
  }
}
