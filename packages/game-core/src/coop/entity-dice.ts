import type { CombatState, CoopDiceAdvance, CoopState } from '@shards/shared';
import { createCombatEntityRng } from '../random';

/** Battle-local enemy indices never enter a persistent entity's random identity. */
export function coopBattleDiceOwners(combat: CombatState, mobIds: readonly string[]): Record<string, string> {
  let enemy = 0;
  const owners: Record<string, string> = {};
  for (const unit of combat.units) {
    const id = unit.team === 'heroes' ? `hero:${unit.definitionId}` : `enemy:${mobIds[enemy++]}`;
    owners[unit.id] = id;
  }
  if (enemy !== mobIds.length) throw new Error('Co-op enemy dice identity does not match its roster');
  return owners;
}

/** Heroes continue across battles; enemies continue only inside their current battle. */
export function coopBattleRng(state: Pick<CoopState, 'seed' | 'diceCounters'>, combat: CombatState, mobIds: readonly string[]) {
  const owners = coopBattleDiceOwners(combat, mobIds);
  const counters = Object.fromEntries(Object.values(owners).map(owner => [owner, owner.startsWith('hero:')
    ? state.diceCounters?.[owner] ?? 0 : combat.rng.entityDice?.counters[owner] ?? 0]));
  return createCombatEntityRng(state.seed, owners, counters, combat.rng.diceIndex ?? 0);
}

export function coopDiceChanges(before: Record<string, number>, after: Record<string, number>): CoopDiceAdvance[] {
  return Object.keys(after).sort().flatMap(ownerId => {
    const index = before[ownerId] ?? 0, nextIndex = after[ownerId];
    return index === nextIndex ? [] : [{ ownerId, index, nextIndex }];
  });
}

/** Persist hero advances and count all battle dice; enemy counters stay in the combat state. */
export function advanceCoopDice(state: CoopState, changes: readonly CoopDiceAdvance[], before: Record<string, number>): CoopState {
  if (!changes.length) return state;
  const counters = { ...state.diceCounters };
  let diceIndex = state.diceIndex;
  for (const { ownerId, index, nextIndex } of changes) {
    if (!ownerId || !Number.isSafeInteger(index) || index < 0 || !Number.isSafeInteger(nextIndex) || nextIndex < index
      || before[ownerId] !== index || diceIndex > Number.MAX_SAFE_INTEGER - (nextIndex - index)) {
      throw new Error('Co-op entity dice counter diverged');
    }
    if (ownerId.startsWith('hero:')) counters[ownerId] = nextIndex;
    diceIndex += nextIndex - index;
  }
  return { ...state, diceCounters: counters, diceIndex };
}
