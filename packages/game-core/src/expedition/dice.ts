import type { CombatState, ExpeditionState } from '@shards/shared';
import { createCombatEntityRng } from '../random';

export function expeditionCombatDice(state: ExpeditionState, combat: CombatState, enemyIds: readonly string[]): CombatState {
  let enemy = 0;
  const owners = Object.fromEntries(combat.units.map(unit => [unit.id,
    unit.team === 'heroes' ? `hero:${unit.definitionId}` : `enemy:${enemyIds[enemy++]}`]));
  if (enemy !== enemyIds.length) throw new Error('Encounter dice identities do not match enemies');
  const counters = Object.fromEntries(Object.values(owners).map(owner => [owner,
    owner.startsWith('hero:') ? state.diceCounters?.[owner] ?? 0 : 0]));
  return { ...combat, rng: createCombatEntityRng(state.world.graph.seed, owners, counters) };
}

/** Persist only hero draws. Each surviving enemy starts its next battle at zero. */
export function withExpeditionCombat(state: ExpeditionState, combat: CombatState): ExpeditionState {
  const diceCounters = { ...state.diceCounters };
  for (const [owner, count] of Object.entries(combat.rng.entityDice?.counters ?? {})) {
    if (owner.startsWith('hero:')) diceCounters[owner] = count;
  }
  return { ...state, combat, diceCounters };
}
