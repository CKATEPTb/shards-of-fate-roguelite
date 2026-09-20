import { describe, expect, it } from 'vitest';
import { DIFFICULTY_IDS, type DifficultyId, type GameContent } from '@shards/shared';
import { DIFFICULTY_PROFILES, gameContent } from '@shards/game-data';
import { createCombat, createExpedition, deserializeExpedition, deserializeSnapshot, generateRoamingGroups, getDifficultyProfile, moveExpedition, serializeExpedition, serializeSnapshot, stepCombat, stepExpedition } from '@shards/game-core';
import { runActions } from '../packages/game-core/src/actions';
import { createContext } from '../packages/game-core/src/events';
import { contentFixture, options } from '../packages/game-core/src/__tests__/fixtures';
import { formationPoints } from '../packages/game-core/src/roaming/navigation';
import { DELTAS } from '../packages/game-core/src/world/grid';
import { roamingChunk } from './helpers/roaming';
import { validateContent } from '../tools/content-validator/src';

function fixture(): GameContent {
  const content = contentFixture();
  content.difficulties = structuredClone(DIFFICULTY_PROFILES);
  content.characters[0].stats.maxHp = 10_000;
  return content;
}

describe('difficulty combat profiles', () => {
  it('keeps normal as the default and scales enemy health without changing hero resources or enemy power', () => {
    const content = fixture();
    const normal = createCombat(options, content);
    expect(createCombat({ ...options, difficultyId: 'normal' }, content)).toEqual(normal);
    for (const difficultyId of DIFFICULTY_IDS) {
      const combat = createCombat({ ...options, difficultyId }, content);
      expect(combat.difficultyId).toBe(difficultyId);
      expect(combat.units[0]).toEqual(normal.units[0]);
      expect(combat.units[1].hp).toBe(Math.round(100 * DIFFICULTY_PROFILES[difficultyId].enemyHpMultiplier));
      expect(combat.units[1].stats.power).toBe(10);
      expect(deserializeSnapshot(serializeSnapshot(combat), content)).toEqual(combat);
    }
  });

  it.each(['attack', 'status', 'effect'] as const)('scales the entire enemy dice-plus-power %s damage exactly once', origin => {
    const content = fixture();
    const damages: number[] = [];
    for (const difficultyId of DIFFICULTY_IDS) {
      const state = createCombat({ ...options, seed: 'difficulty-damage', difficultyId }, content);
      runActions(createContext(state, content), [{ type: 'damage', dice: '1d6', scaling: 'power' }], { source: state.units[1], target: 'enemy', origin });
      const damage = state.events.find(event => event.type === 'DAMAGE');
      expect(damage).toBeDefined();
      damages.push(damage!.amount!);
      const damageRoll = state.events.filter(event => event.type === 'DICE_ROLLED').at(-1)!.amount!;
      expect(damage!.amount).toBe(Math.floor((10 + damageRoll) * DIFFICULTY_PROFILES[difficultyId].enemyDamageMultiplier));
    }
    expect(damages[2]).toBeGreaterThan(damages[1]);
    expect(damages[1]).toBeGreaterThan(damages[0]);
  });

  it('applies enemy difficulty before armor and shields while keeping hero damage unchanged', () => {
    const content = fixture();
    content.characters[0].stats.armor = 100;
    for (const difficultyId of DIFFICULTY_IDS) {
      const state = createCombat({ ...options, difficultyId }, content);
      state.units[0].shield = 2;
      runActions(createContext(state, content), [{ type: 'damage', scaling: 'power' }], { source: state.units[1], target: 'enemy', origin: 'status' });
      expect(state.events.find(event => event.type === 'DAMAGE')!.amount).toBe(Math.floor(10 * DIFFICULTY_PROFILES[difficultyId].enemyDamageMultiplier / 2) - 2);
      runActions(createContext(state, content), [{ type: 'damage', scaling: 'power' }], { source: state.units[0], target: 'enemy', origin: 'effect' });
      expect(state.events.filter(event => event.type === 'DAMAGE').at(-1)!.amount).toBe(10);
    }
  });

  it('restores active difficulty and rejects unknown IDs, altered enemy HP or changed profiles', () => {
    const content = fixture();
    const state = stepCombat(createCombat({ ...options, difficultyId: 'nightmare' }, content), content);
    const restored = deserializeSnapshot(serializeSnapshot(state), content);
    expect(restored).toEqual(state);
    expect(stepCombat(restored, content)).toEqual(stepCombat(state, content));
    expect(() => createCombat({ ...options, difficultyId: 'easy' as DifficultyId }, content)).toThrow(/difficulty/);
    expect(() => createCombat({ ...options, difficultyId: 'hard' }, contentFixture())).toThrow(/profile/);
    expect(() => deserializeSnapshot(JSON.stringify({ ...state, difficultyId: 'normal' }), content)).toThrow(/stats/);
    const changed = structuredClone(content);
    changed.difficulties!.nightmare.enemyDamageMultiplier++;
    expect(() => deserializeSnapshot(serializeSnapshot(state), changed)).toThrow(/contentHash/);
    const malformed = structuredClone(gameContent);
    malformed.difficulties!.hard.epicGroupChance = 1.1;
    expect(validateContent(malformed).valid).toBe(false);
  });
});

describe('difficulty population and expedition persistence', () => {
  it('uses data-driven encounter probabilities and preserves normal generation exactly', () => {
    const chunk = roamingChunk();
    const seed = 'difficulty-population';
    expect(generateRoamingGroups(seed, chunk, gameContent)).toEqual(generateRoamingGroups(seed, chunk, gameContent, 'normal'));
    const custom = structuredClone(gameContent);
    const profile = custom.difficulties!.hard;
    profile.minibossChunkChance = 0;
    profile.epicGroupChance = 0;
    expect(generateRoamingGroups(seed, chunk, custom, 'hard').every(group => group.category === 'normal')).toBe(true);
    profile.epicGroupChance = 1;
    expect(generateRoamingGroups(seed, chunk, custom, 'hard').every(group => group.category === 'epic')).toBe(true);
    profile.minibossChunkChance = 1;
    const groups = generateRoamingGroups(seed, chunk, custom, 'hard');
    expect(groups.filter(group => group.category === 'miniboss')).toHaveLength(1);
    expect(groups.every(group => group.category !== 'normal')).toBe(true);
  });

  it('produces more epic packs and mini-boss chunks on harder profiles over deterministic samples', () => {
    const chunk = roamingChunk();
    const totals = DIFFICULTY_IDS.map(difficulty => {
      let epic = 0; let boss = 0;
      for (let index = 0; index < 160; index++) {
        const groups = generateRoamingGroups(`difficulty-sample-${index}`, chunk, gameContent, difficulty);
        epic += groups.filter(group => group.category === 'epic').length;
        boss += Number(groups.some(group => group.category === 'miniboss'));
      }
      return { epic, boss };
    });
    expect(totals[1].epic).toBeGreaterThan(totals[0].epic);
    expect(totals[2].epic).toBeGreaterThan(totals[1].epic);
    expect(totals[1].boss).toBeGreaterThan(totals[0].boss);
    expect(totals[2].boss).toBeGreaterThan(totals[1].boss);
  });

  it.each(DIFFICULTY_IDS)('keeps %s difficulty through transitions, battle creation and save/load', difficultyId => {
    let state = createExpedition('FIRST-CAMPFIRE', ['guardian'], gameContent, difficultyId);
    expect(state.difficultyId).toBe(difficultyId);
    const start = state;
    const exit = state.world.chunk.exits.find(candidate => candidate.direction === 'north')!;
    const delta = DELTAS[exit.direction];
    state = { ...state, world: { ...state.world, actors: state.world.actors.map(actor => ({ ...actor, position: { x: exit.position.x - delta.x, y: exit.position.y - delta.y } })) } };
    state = stepExpedition(moveExpedition(state, 'guardian', exit.position).state, gameContent, 280);
    expect(state.world.currentChunkId).toBe(exit.targetNodeId);
    expect(state.difficultyId).toBe(difficultyId);
    expect(state.roaming!.chunks[start.world.currentChunkId]).toEqual(start.roaming!.chunks[start.world.currentChunkId]);
    const groups = state.roaming!.chunks[state.world.currentChunkId];
    const generated = generateRoamingGroups(state.world.graph.seed, state.world.chunk, gameContent, difficultyId);
    expect(groups.map(group => [group.category, group.members.map(mob => mob.definitionId)])).toEqual(generated.map(group => [group.category, group.members.map(mob => mob.definitionId)]));
    const mob = groups[0].members[0];
    const point = formationPoints(state.world.chunk, mob.position, 1).find(point => point.x !== mob.position.x || point.y !== mob.position.y)!;
    state = { ...state, world: { ...state.world, actors: state.world.actors.map(actor => ({ ...actor, position: point, path: [] })) } };
    state = stepExpedition(state, gameContent, 40);
    expect(state.combat?.difficultyId).toBe(difficultyId);
    const restored = deserializeExpedition(serializeExpedition(state, gameContent), gameContent);
    expect(restored).toEqual(state);
    const saved = JSON.parse(serializeExpedition(state, gameContent));
    saved.difficultyId = 'invalid';
    expect(() => deserializeExpedition(JSON.stringify(saved), gameContent)).toThrow(/difficulty/);
    const mismatch = JSON.parse(serializeExpedition(state, gameContent));
    const combat = JSON.parse(mismatch.combat);
    combat.difficultyId = difficultyId === 'normal' ? 'hard' : 'normal';
    mismatch.combat = JSON.stringify(combat);
    expect(() => deserializeExpedition(JSON.stringify(mismatch), gameContent)).toThrow();
  });
});
