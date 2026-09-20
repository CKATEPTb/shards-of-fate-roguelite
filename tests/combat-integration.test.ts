import { describe, expect, it } from 'vitest';
import { createCombat, deserializeSnapshot, hashState, runCombat, serializeSnapshot, stepCombat } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import { partyCompositions } from '../tools/balance-simulator/src/simulate';

describe('real game content integration', () => {
  it('has the agreed nine heroes and ten enemy archetypes', () => {
    expect(gameContent.characters).toHaveLength(9);
    expect(gameContent.enemies).toHaveLength(10);
    expect(new Set(gameContent.characters.map(character => character.role)).size).toBe(3);
    const usedEnemies = new Set(gameContent.encounters.flatMap(encounter => encounter.enemyIds));
    for (const enemy of gameContent.enemies) expect(usedEnemies.has(enemy.id), enemy.id).toBe(true);
  });

  it('terminates with finite bounded state for every encounter, each solo hero, and representative cooperative parties', () => {
    const parties = [...gameContent.characters.map(hero => [hero.id]),
      ...partyCompositions(['guardian', 'priest', 'mage']).filter(party => party.length > 1),
      ['vampire', 'paladin', 'druid', 'necromancer'], ['rogue', 'ranger', 'guardian', 'priest']];
    for (const encounter of gameContent.encounters) {
      for (const party of parties) {
        for (let seed = 0; seed < 5; seed++) {
          const state = runCombat(createCombat({ seed: `property-${seed}`, characterIds: party, encounterId: encounter.id }, gameContent), gameContent);
          expect(['victory', 'defeat', 'draw']).toContain(state.status);
          expect(state.round).toBeLessThanOrEqual(gameContent.balance.maxRounds + 1);
          for (const unit of state.units) {
            expect(Number.isFinite(unit.hp)).toBe(true);
            expect(unit.hp).toBeGreaterThanOrEqual(0);
            expect(unit.hp).toBeLessThanOrEqual(unit.stats.maxHp);
            expect(unit.shield).toBeGreaterThanOrEqual(0);
          }
          for (let i = 1; i < state.events.length; i++) expect(state.events[i].sequence).toBe(state.events[i - 1].sequence + 1);
        }
      }
    }
  }, 60_000);

  it('restores a battle mid-turn sequence and reproduces the exact future', () => {
    const options = { seed: 'snapshot-integration', characterIds: ['paladin', 'druid', 'necromancer', 'ranger'], encounterId: gameContent.encounters.at(-1)!.id };
    let state = createCombat(options, gameContent);
    for (let i = 0; i < 9; i++) state = stepCombat(state, gameContent);
    const restored = deserializeSnapshot(serializeSnapshot(state), gameContent);
    expect(restored).toEqual(state);
    const resumed = runCombat(restored, gameContent);
    const original = runCombat(createCombat(options, gameContent), gameContent);
    expect(resumed).toEqual(original);
    expect(hashState(resumed)).toBe(hashState(original));
  });
});
