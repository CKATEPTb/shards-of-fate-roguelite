import { describe, expect, it } from 'vitest';
import { createCombat } from '../packages/game-core/src/create';
import { runCombat, stepCombat } from '../packages/game-core/src/combat';
import { deserializeSnapshot, serializeSnapshot } from '../packages/game-core/src/snapshot';
import { gameContent } from '@shards/game-data';
import type { CombatOptions } from '@shards/shared';

const options: CombatOptions = {
  seed: 'roaming-battle', encounterId: 'roaming',
  characterIds: ['guardian', 'priest', 'mage'],
  enemyIds: ['wolf', 'rat', 'wolf', 'goblin_shaman'],
};

describe('dynamic battle rosters', () => {
  it('preserves enemy order and duplicates independently of static encounters', () => {
    const state = createCombat(options, gameContent);
    expect(state.enemyIds).toEqual(options.enemyIds);
    expect(state.units.filter(unit => unit.team === 'enemies').map(unit => unit.definitionId)).toEqual(options.enemyIds);
    expect(new Set(state.units.map(unit => unit.id)).size).toBe(state.units.length);
    expect(state.enemyIds).not.toBe(options.enemyIds);
    expect(state.encounterId).toBe('roaming');
    expect(state.contentHash).toBe(createCombat({ ...options, enemyIds: undefined, encounterId: gameContent.encounters[0].id }, gameContent).contentHash);
  });

  it.each([1, 4, 16])('runs and restores a %i-enemy battle without losing its exact future', total => {
    const initial = createCombat({ ...options, enemyIds: Array.from({ length: total }, (_, index) => index % 2 ? 'wolf' : 'rat') }, gameContent);
    expect(deserializeSnapshot(serializeSnapshot(initial), gameContent)).toEqual(initial);
    let state = initial;
    for (let index = 0; index < 5; index++) state = stepCombat(state, gameContent);
    const restored = deserializeSnapshot(serializeSnapshot(state), gameContent);
    const result = runCombat(restored, gameContent);
    expect(result).toEqual(runCombat(initial, gameContent));
    expect(deserializeSnapshot(serializeSnapshot(result), gameContent)).toEqual(result);
  });

  it.each([[], Array(17).fill('rat'), ['missing-enemy'], [42], null, 'rat', new Array(1)])('rejects invalid dynamic rosters: %j', enemyIds => {
    expect(() => createCombat({ ...options, enemyIds } as CombatOptions, gameContent)).toThrow();
  });

  it('rejects snapshot roster tampering and unknown metadata', () => {
    const state = stepCombat(createCombat(options, gameContent), gameContent);
    const mutations = [
      { ...state, enemyIds: ['rat'] },
      { ...state, enemyIds: [...state.enemyIds!].reverse() },
      { ...state, enemyIds: ['unknown'] },
      { ...state, enemyIds: null },
      { ...state, enemyIds: [] },
      { ...state, enemyIds: Array(17).fill('rat') },
      { ...state, enemyMultiplier: 2 },
    ];
    for (const mutation of mutations) expect(() => deserializeSnapshot(JSON.stringify(mutation), gameContent)).toThrow();
  });

  it('keeps legacy static combat snapshots unchanged', () => {
    const state = createCombat({ seed: 'legacy', encounterId: gameContent.encounters[0].id, characterIds: options.characterIds }, gameContent);
    expect(state).not.toHaveProperty('enemyIds');
    expect(deserializeSnapshot(serializeSnapshot(state), gameContent)).toEqual(state);
  });
});
