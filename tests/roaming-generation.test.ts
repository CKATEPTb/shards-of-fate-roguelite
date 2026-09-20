import { describe, expect, it } from 'vitest';
import { gameContent } from '@shards/game-data';
import { createExploration, generateChunk, generateWorld } from '@shards/game-core';
import { findRoamingEncounter, generateRoamingGroups, prepareRoamingArrival } from '../packages/game-core/src/roaming';
import { distanceSquared, sameRoamingRegion } from '../packages/game-core/src/roaming/navigation';
import { movementStepMs } from '../packages/game-core/src/world/movement-speed';
import { roamingChunk, roamingGroup, roamingHero } from './helpers/roaming';

describe('deterministic roaming population', () => {
  it('generates two to four varied groups with legal formations throughout seasonal chunks', () => {
    const graph = generateWorld('ROAMING-POPULATION');
    const counts = new Set<number>(); const sizes = new Set<number>(); const categories = new Set<string>();
    let bosses = 0; let chasing = 0;
    const nodes = graph.nodes.filter((_, index) => index % 71 === 0).slice(0, 110);
    for (const node of nodes) {
      const chunk = generateChunk(graph, node.id);
      const groups = generateRoamingGroups(graph.seed, chunk, gameContent);
      expect(generateRoamingGroups(graph.seed, chunk, gameContent)).toEqual(groups);
      expect(groups.length).toBeGreaterThanOrEqual(2); expect(groups.length).toBeLessThanOrEqual(4);
      counts.add(groups.length);
      const members = groups.flatMap(group => group.members);
      expect(new Set(members.map(member => member.id)).size).toBe(members.length);
      expect(new Set(members.map(member => `${member.position.x},${member.position.y}`)).size).toBe(members.length);
      for (const group of groups) {
        categories.add(group.category); sizes.add(group.members.length);
        if (group.category === 'miniboss') bosses++;
        if (group.chases) chasing++;
        expect(group.members.length).toBeGreaterThanOrEqual(1);
        expect(group.members.length).toBeLessThanOrEqual(group.category === 'normal' ? 4 : group.category === 'epic' ? 3 : 1);
        for (const member of group.members) {
          expect(gameContent.enemies.some(enemy => enemy.id === member.definitionId)).toBe(true);
          expect(chunk.tiles[member.position.y * chunk.size + member.position.x].walkable).toBe(true);
          expect(sameRoamingRegion(chunk, group.home, member.position)).toBe(true);
          expect(distanceSquared(group.home, member.position)).toBeLessThanOrEqual(9);
          expect(distanceSquared(chunk.spawn, member.position)).toBeGreaterThan(64);
          expect(chunk.exits.some(exit => exit.position.x === member.position.x && exit.position.y === member.position.y)).toBe(false);
        }
      }
    }
    expect([...counts].sort()).toEqual([2, 3, 4]); expect([...sizes].sort()).toEqual([1, 2, 3, 4]);
    expect([...categories].sort()).toEqual(['epic', 'miniboss', 'normal']);
    expect(bosses).toBeGreaterThan(0); expect(bosses).toBeLessThan(nodes.length / 4);
    expect(chasing).toBeGreaterThan(10);
  });

  it('keeps actual campfire and each entrance arrival safe for all four heroes', () => {
    const state = createExploration({ seed: 'FIRST-CAMPFIRE', characterIds: ['guardian', 'priest', 'mage', 'assassin'] });
    const original = generateRoamingGroups(state.graph.seed, state.chunk, gameContent);
    for (const heroes of [state.actors, ...state.chunk.exits.map(exit => {
      const x = Math.min(state.chunk.size - 2, Math.max(1, exit.position.x));
      const y = Math.min(state.chunk.size - 2, Math.max(1, exit.position.y));
      return state.actors.map(actor => ({ ...actor, position: { x, y } }));
    })]) {
      const groups = prepareRoamingArrival(original, state.chunk, heroes, state.graph.seed);
      expect(findRoamingEncounter(state.chunk, groups, heroes)).toBeNull();
      expect(groups.flatMap(group => group.members).every(member => heroes.every(hero => distanceSquared(member.position, hero.position) > 64))).toBe(true);
      expect(groups.map(group => group.members.map(member => member.definitionId))).toEqual(original.map(group => group.members.map(member => member.definitionId)));
    }
  });

  it('preserves safe positions and clears old pursuit and partial movement on revisits', () => {
    const chunk = roamingChunk(); const group = roamingGroup('pack', [{ x: 25, y: 25 }],
      { mode: 'chase', targetActorId: 'guardian', chases: true, decision: 9 });
    group.members[0].path = [{ x: 24, y: 25 }];
    group.members[0].movement!.elapsedMs = movementStepMs(group.members[0]) / 2;
    const groups = prepareRoamingArrival([group], chunk, [roamingHero(2, 2)], 'seed');
    expect(groups[0].members[0].position).toEqual(group.members[0].position);
    expect(groups[0].members[0].path).toEqual([]);
    expect(groups[0].members[0].movement!.elapsedMs).toBe(0);
    expect(groups[0].mode).toBe('patrol'); expect(groups[0].targetActorId).toBeNull();
    expect(groups[0].decision).toBe(9);
    expect(group.mode).toBe('chase'); expect(group.members[0].path).toHaveLength(1);
  });
});
