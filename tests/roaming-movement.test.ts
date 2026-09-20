import { describe, expect, it } from 'vitest';
import { findRoamingEncounter, stepRoamingGroups } from '../packages/game-core/src/roaming';
import { distanceSquared, sameRoamingRegion } from '../packages/game-core/src/roaming/navigation';
import { movementStepMs } from '../packages/game-core/src/world/movement-speed';
import { findPath } from '../packages/game-core/src/world/pathfinding';
import { paintRoamingTile, roamingChunk, roamingGroup, roamingHero } from './helpers/roaming';

describe('wandering groups and pursuit', () => {
  it('patrols deterministically with idle pauses, compact packs, and no region or gate crossing', () => {
    const chunk = roamingChunk();
    for (let y = 1; y < chunk.size - 1; y++) paintRoamingTile(chunk, 17, y, 'wall');
    chunk.exits = [{ id: 'exit', returnGateId: 'return', direction: 'west', targetNodeId: '-1,0', position: { x: 0, y: 10 } }];
    paintRoamingTile(chunk, 0, 10, 'path');
    const original = [roamingGroup('pack', [{ x: 6, y: 10 }, { x: 5, y: 10 }, { x: 6, y: 9 }, { x: 6, y: 11 }])];
    let groups = original; let idle = false; let moved = false;
    for (let tick = 0; tick < 800; tick++) {
      const next = stepRoamingGroups(groups, chunk, [], 40, 'seed');
      expect(stepRoamingGroups(structuredClone(groups), chunk, [], 40, 'seed')).toEqual(next);
      idle ||= next[0].pauseMs > 0;
      moved ||= next[0].members[0].position.x !== original[0].members[0].position.x;
      for (const member of next[0].members) {
        expect(sameRoamingRegion(chunk, original[0].home, member.position)).toBe(true);
        expect(member.position.x).toBeGreaterThan(0); expect(member.position.x).toBeLessThan(17);
        expect(distanceSquared(member.position, next[0].home)).toBeLessThanOrEqual(100);
        expect(member.path.every(point => point.x > 0 && point.y > 0 && point.x < chunk.size - 1 && point.y < chunk.size - 1)).toBe(true);
      }
      groups = next;
    }
    expect(idle).toBe(true); expect(moved).toBe(true);
    expect(original[0].decision).toBe(0); expect(original[0].members[0].path).toEqual([]);
  });

  it('only the pursuit trait detects at eight tiles and wakes the entire pack', () => {
    const chunk = roamingChunk(); const heroes = [roamingHero(10, 18)];
    const plain = roamingGroup('plain', [{ x: 10, y: 10 }], { pauseMs: 1000 });
    const hunter = roamingGroup('hunter', [{ x: 10, y: 10 }, { x: 8, y: 10 }], { chases: true, pauseMs: 1000 });
    const [calm, chasing] = stepRoamingGroups([plain, hunter], chunk, heroes, 40, 'seed');
    expect(calm.mode).toBe('patrol'); expect(calm.members[0].path).toEqual([]);
    expect(chasing.mode).toBe('chase'); expect(chasing.targetActorId).toBe('guardian');
    expect(chasing.members.every(member => member.path.length > 0 && member.path.at(-1)!.y === 18)).toBe(true);
    expect(stepRoamingGroups([hunter], chunk, [roamingHero(10, 19)], 40, 'seed')[0].mode).toBe('patrol');
  });

  it('alerts every ordinary pack at five tiles, approaches together, and fights only at one', () => {
    const chunk = roamingChunk(); const heroes = [roamingHero(10, 15)];
    const initial = roamingGroup('ordinary', [{ x: 10, y: 10 }, { x: 8, y: 10 }], { pauseMs: 1000 });
    expect(stepRoamingGroups([initial], chunk, [roamingHero(10, 16)], 40, 'seed')[0].mode).toBe('patrol');
    let groups = stepRoamingGroups([initial], chunk, heroes, 40, 'seed');
    expect(groups[0].chases).toBe(false);
    expect(groups[0].mode).toBe('chase'); expect(groups[0].targetActorId).toBe('guardian');
    expect(groups[0].members.every(member => member.path.at(-1)?.y === 15)).toBe(true);
    expect(findRoamingEncounter(chunk, groups, heroes)).toBeNull();
    for (let tick = 0; tick < 40 && !findRoamingEncounter(chunk, groups, heroes); tick++) {
      groups = stepRoamingGroups(groups, chunk, heroes, 40, 'seed');
    }
    expect(findRoamingEncounter(chunk, groups, heroes)?.groupIds).toEqual(['ordinary']);
    expect(groups[0].members.some(member => distanceSquared(member.position, heroes[0].position) === 1)).toBe(true);
  });

  it('keeps an ordinary group chasing beyond the detection radius without a leash', () => {
    const chunk = roamingChunk();
    let groups = stepRoamingGroups([roamingGroup('ordinary', [{ x: 10, y: 10 }, { x: 8, y: 10 }])], chunk, [roamingHero(10, 15)], 40, 'seed');
    groups = stepRoamingGroups(groups, chunk, [roamingHero(30, 30)], 320, 'seed');
    expect(groups[0].mode).toBe('chase'); expect(groups[0].targetActorId).toBe('guardian');
    expect(groups[0].members.every(member => member.path.at(-1)?.x === 30 && member.path.at(-1)?.y === 30)).toBe(true);
    expect(groups[0].members[0].path.length).toBeGreaterThan(12);
  });

  it('switches the entire pack to the nearest available hero every tick, including followers', () => {
    const chunk = roamingChunk();
    const original = roamingGroup('ordinary', [{ x: 10, y: 10 }, { x: 8, y: 10 }]);
    let groups = stepRoamingGroups([original], chunk, [roamingHero(10, 14), roamingHero(3, 10, 'priest')], 40, 'seed');
    expect(groups[0].targetActorId).toBe('guardian');
    expect(groups[0].pauseMs).toBeGreaterThan(40);
    // The follower is now closer to the priest, although the leader is still closer to the guardian.
    groups = stepRoamingGroups(groups, chunk, [roamingHero(10, 14), roamingHero(5, 10, 'priest')], 40, 'seed');
    expect(groups[0].targetActorId).toBe('priest');
    expect(groups[0].members.every(member => member.path.at(-1)?.x === 5 && member.path.at(-1)?.y === 10)).toBe(true);
    groups = stepRoamingGroups(groups, chunk, [roamingHero(10, 13), roamingHero(30, 30, 'priest')], 40, 'seed');
    expect(groups[0].targetActorId).toBe('guardian');
    expect(groups[0].members.every(member => member.path.at(-1)?.x === 10 && member.path.at(-1)?.y === 13)).toBe(true);
  });

  it('retains fractional movement when switching heroes without changing the next tile', () => {
    const chunk = roamingChunk();
    let groups = stepRoamingGroups([roamingGroup('ordinary', [{ x: 10, y: 10 }])], chunk, [roamingHero(10, 15), roamingHero(10, 17, 'priest')], 100, 'seed');
    expect(groups[0].members[0].movement?.elapsedMs).toBe(100);
    groups = stepRoamingGroups(groups, chunk, [roamingHero(30, 30), roamingHero(10, 17, 'priest')], 40, 'seed');
    expect(groups[0].targetActorId).toBe('priest');
    expect(groups[0].members[0].movement?.elapsedMs).toBe(140);
    expect(groups[0].members[0].path.at(-1)).toEqual({ x: 10, y: 17 });
  });

  it('never detects through walls or switches to a closer hero in a disconnected area', () => {
    const chunk = roamingChunk();
    for (let y = 1; y < chunk.size - 1; y++) paintRoamingTile(chunk, 12, y, 'wall');
    const initial = roamingGroup('ordinary', [{ x: 10, y: 10 }], { pauseMs: 1000 });
    const hidden = stepRoamingGroups([initial], chunk, [roamingHero(13, 10)], 40, 'seed');
    expect(hidden[0].mode).toBe('patrol');
    expect(findRoamingEncounter(chunk, hidden, [roamingHero(13, 10)])).toBeNull();
    let groups = stepRoamingGroups([initial], chunk, [roamingHero(10, 15), roamingHero(13, 10, 'priest')], 40, 'seed');
    expect(groups[0].targetActorId).toBe('guardian');
    groups = stepRoamingGroups(groups, chunk, [roamingHero(10, 30), roamingHero(13, 10, 'priest')], 40, 'seed');
    expect(groups[0].targetActorId).toBe('guardian');
    expect(groups[0].mode).toBe('chase');
  });

  it('keeps the current target on exact distance ties instead of flickering between heroes', () => {
    const chunk = roamingChunk();
    const guardian = roamingHero(10, 14); const priest = roamingHero(10, 6, 'priest');
    let groups = stepRoamingGroups([roamingGroup('ordinary', [{ x: 10, y: 10 }])], chunk, [guardian, priest], 40, 'seed');
    expect(groups[0].targetActorId).toBe('guardian');
    groups = stepRoamingGroups(groups, chunk, [priest, guardian], 40, 'seed');
    expect(groups[0].targetActorId).toBe('guardian');
  });

  it('needs sight to start chasing but does not lose pursuit across the whole chunk', () => {
    const chunk = roamingChunk(); const hunter = roamingGroup('hunter', [{ x: 10, y: 10 }, { x: 9, y: 10 }], { chases: true });
    let groups = stepRoamingGroups([hunter], chunk, [roamingHero(10, 18)], 40, 'seed');
    groups = stepRoamingGroups(groups, chunk, [roamingHero(30, 30)], 320, 'seed');
    expect(groups[0].mode).toBe('chase');
    expect(groups[0].members.every(member => member.path.at(-1)?.x === 30 && member.path.at(-1)?.y === 30)).toBe(true);
    expect(groups[0].members[0].path.length).toBeGreaterThan(12);
    const blockedChunk = roamingChunk();
    for (let x = 1; x < blockedChunk.size - 1; x++) paintRoamingTile(blockedChunk, x, 14, 'wall');
    expect(stepRoamingGroups([hunter], blockedChunk, [roamingHero(10, 18)], 40, 'seed')[0].mode).toBe('patrol');
  });

  it('preserves partial walking progress when a moving target keeps the first step', () => {
    const chunk = roamingChunk();
    let groups = stepRoamingGroups([roamingGroup('hunter', [{ x: 10, y: 10 }], { chases: true })], chunk, [roamingHero(10, 18)], 100, 'seed');
    expect(groups[0].members[0].movement?.elapsedMs).toBe(100);
    groups = groups.map(group => ({ ...group, pauseMs: 0 }));
    groups = stepRoamingGroups(groups, chunk, [roamingHero(10, 20)], 100, 'seed');
    expect(groups[0].members[0].movement?.elapsedMs).toBe(200);
    expect(groups[0].members[0].path.at(-1)).toEqual({ x: 10, y: 20 });
  });

  it.each(['patrol', 'chase'] as const)('crosses bushes at normal pace during %s without skipping cells after stalls', mode => {
    const chunk = roamingChunk(); paintRoamingTile(chunk, 3, 2, 'bush');
    const group = roamingGroup('hunter', [{ x: 2, y: 2 }], { mode, targetActorId: mode === 'chase' ? 'guardian' : null, pauseMs: mode === 'chase' ? 1000 : 0 });
    group.members[0].path = [{ x: 3, y: 2 }, { x: 4, y: 2 }];
    const heroes = [roamingHero(20, 2)];
    let groups = stepRoamingGroups([group], chunk, heroes, 140, 'seed');
    expect(groups[0].members[0].position).toEqual({ x: 2, y: 2 });
    expect(groups[0].members[0].movement?.elapsedMs).toBe(140);
    groups = stepRoamingGroups(groups, chunk, heroes, 140, 'seed');
    expect(groups[0].members[0].position).toEqual({ x: 3, y: 2 });
    groups = stepRoamingGroups(groups, chunk, heroes, 280, 'seed');
    expect(groups[0].members[0].position).toEqual({ x: 4, y: 2 });
    const stalled = stepRoamingGroups([group], chunk, heroes, 60_000, 'seed');
    expect(distanceSquared(stalled[0].members[0].position, group.members[0].position)).toBeLessThanOrEqual(1);
    expect(stalled[0].members[0].movement!.elapsedMs).toBeLessThan(movementStepMs(stalled[0].members[0], 'bush'));
  });

  it('routes patrols and pursuit directly through bushes while heroes still prefer a faster detour', () => {
    const chunk = roamingChunk();
    for (let x = 3; x <= 8; x++) paintRoamingTile(chunk, x, 2, 'bush');
    const hero = roamingHero(10, 2);
    const start = { x: 2, y: 2 };
    const hunter = roamingGroup('hunter', [start], { mode: 'chase', targetActorId: hero.id });
    const [pursuing] = stepRoamingGroups([hunter], chunk, [hero], 40, 'seed');
    expect(pursuing.members[0].path).toHaveLength(8);
    expect(pursuing.members[0].path.every(point => point.y === 2)).toBe(true);
    expect(findPath(chunk, start, hero.position).some(point => point.y !== 2)).toBe(true);
    // Returning to a distant patrol home uses the same actor-aware route search.
    const [patrolling] = stepRoamingGroups([roamingGroup('patrol', [start], { home: { x: 20, y: 2 } })], chunk, [], 40, 'seed');
    expect(patrolling.members[0].path).toEqual([{ x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 2 }]);
    // Redirecting an existing chase still ignores bushes and preserves its first partial step.
    const [redirected] = stepRoamingGroups([{ ...pursuing, pauseMs: 0 }], chunk, [roamingHero(12, 2)], 40, 'seed');
    expect(redirected.members[0].path.every(point => point.y === 2)).toBe(true);
    expect(redirected.members[0].movement?.elapsedMs).toBe(80);
    // Immunity removes only the bush penalty, not unrelated custom path weights.
    paintRoamingTile(chunk, 5, 2, 'grass');
    chunk.tiles[2 * chunk.size + 5].movementCost = 9;
    expect(findPath(chunk, start, hero.position, hunter.members[0]).some(point => point.y !== 2)).toBe(true);
  });

  it('returns to its patrol area after pursuit has ended far from home', () => {
    const chunk = roamingChunk();
    const group = roamingGroup('pack', [{ x: 30, y: 30 }], { home: { x: 3, y: 3 } });
    const [next] = stepRoamingGroups([group], chunk, [], 280, 'seed');
    expect(distanceSquared(next.members[0].position, group.home)).toBeLessThan(distanceSquared(group.members[0].position, group.home));
    expect(next.members[0].path.length).toBeGreaterThan(0);
  });

  it('never walks into an exit while pursuing a hero at a gate', () => {
    const chunk = roamingChunk(); paintRoamingTile(chunk, 0, 10, 'path');
    chunk.exits = [{ id: 'exit', returnGateId: 'return', direction: 'west', targetNodeId: '-1,0', position: { x: 0, y: 10 } }];
    const [group] = stepRoamingGroups([roamingGroup('hunter', [{ x: 4, y: 10 }], { chases: true })], chunk, [roamingHero(0, 10)], 40, 'seed');
    expect(group.mode).toBe('chase');
    expect(group.members[0].path.at(-1)).toEqual({ x: 1, y: 10 });
  });

  it('keeps zero-time updates unchanged and rejects invalid clocks', () => {
    const chunk = roamingChunk(); const groups = [roamingGroup('pack', [{ x: 10, y: 10 }])];
    expect(stepRoamingGroups(groups, chunk, [], 0, 'seed')).toBe(groups);
    for (const duration of [-1, NaN, Infinity]) expect(() => stepRoamingGroups(groups, chunk, [], duration, 'seed')).toThrow('Invalid roaming elapsed time');
  });
});
