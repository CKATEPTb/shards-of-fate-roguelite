import type { ActionDefinition, Combatant, TargetSelector } from '@shards/shared';
import { canBodyAct } from './anatomy';
import { runActions } from './actions';
import { definitionFor, type CombatContext } from './context';
import { rollCheck } from './combat-rolls';
import { modifiersFor } from './modifiers';
import { selectTargets } from './targets';

/** Repeat is one extra basic attack after a damaging action, never a recursive chain. */
export function runAttackTurn(ctx: CombatContext, actor: Combatant, actions: ActionDefinition[], target: TargetSelector, skillId?: string, targetId?: string): void {
  // Preserve the chosen target for the second hand and passive repeats.
  const selected = selectTargets(ctx, actor, target, undefined, targetId);
  const selectedId = targetId ?? selected[0]?.id;
  const selectedTargets = new Map<TargetSelector, readonly Combatant[]>([[target, selected]]);
  const result = runActions(ctx, actions, { source: actor, target, targetId: selectedId, selectedTargets, origin: 'attack', skillId, basicWeaponAttack: skillId === undefined });
  if (!actions.some(action => action.type === 'damage') || actor.hp <= 0 || actor.escaped || actor.body && !canBodyAct(actor.body)) return;
  const repeatedTarget = result.attemptedDamageTargets.has(selectedId ?? '')
    ? ctx.state.units.find(unit => unit.id === selectedId && unit.hp > 0 && !unit.escaped) : undefined;
  if (repeatedTarget && rollCheck(ctx, actor, modifiersFor(ctx, actor).repeatAttack, 'повторная атака')) {
    const repeatSelector = repeatedTarget.team === actor.team ? 'any' : 'enemy';
    runActions(ctx, [definitionFor(ctx, actor.definitionId).basicAttack], { source: actor, target: repeatSelector, targetId: repeatedTarget.id,
      selectedTargets: new Map([[repeatSelector, [repeatedTarget]]]), origin: 'attack', basicWeaponAttack: true });
  }
}
