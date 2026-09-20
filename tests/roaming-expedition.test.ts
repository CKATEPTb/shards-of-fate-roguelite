import { describe, expect, it } from 'vitest';
import { gameContent } from '@shards/game-data';
import { createExpedition, deserializeExpedition, enableRoaming, leaveEncounter, moveExpedition, runCombat, serializeExpedition,
  stepExpedition, stepExpeditionCombat } from '@shards/game-core';
import type { ExpeditionState, GridPoint } from '@shards/shared';
import { findRoamingEncounter } from '../packages/game-core/src/roaming';
import { formationPoints } from '../packages/game-core/src/roaming/navigation';
import { DELTAS } from '../packages/game-core/src/world/grid';
import { beginRoamingBattle } from '../packages/game-core/src/expedition/roaming';
import { movementStepMs } from '../packages/game-core/src/world/movement-speed';

const party = ['guardian', 'priest', 'mage'];
const create = (ids = party) => createExpedition('FIRST-CAMPFIRE', ids, gameContent);
const groupsOf = (state: ExpeditionState) => state.roaming!.chunks[state.world.currentChunkId];
const saveLoad = (state: ExpeditionState) => deserializeExpedition(serializeExpedition(state, gameContent), gameContent);

function pursuitFixture(): ExpeditionState {
  const state = create();
  state.world.actors = state.world.actors.map((actor, index) => ({ ...actor, position: index ? { x: 24, y: 10 } : { x: 23, y: 9 } }));
  const group = groupsOf(state)[0];
  expect(group.chases).toBe(false);
  group.home = { x: 23, y: 4 };
  group.pauseMs = 60_000;
  group.members = group.members.map(member => ({ ...member, position: { ...group.home } }));
  state.roaming!.chunks[state.world.currentChunkId] = [group];
  return state;
}

function mobBushFixture(): ExpeditionState {
  const state = create(); const chunk = state.world.chunk;
  for (let index = 0; index < chunk.tiles.length; index++) {
    if (chunk.tiles[index].terrain !== 'bush') continue;
    const target = { x: index % chunk.size, y: Math.floor(index / chunk.size) };
    if (state.world.actors.some(hero => Math.hypot(hero.position.x - target.x, hero.position.y - target.y) < 10)) continue;
    const position = Object.values(DELTAS).map(delta => ({ x: target.x + delta.x, y: target.y + delta.y }))
      .find(point => point.x > 0 && point.y > 0 && point.x < chunk.size - 1 && point.y < chunk.size - 1
        && chunk.tiles[point.y * chunk.size + point.x].walkable && chunk.tiles[point.y * chunk.size + point.x].terrain !== 'bush');
    if (!position) continue;
    const group = groupsOf(state)[0];
    state.roaming!.chunks[chunk.id] = [{ ...group, home: position, pauseMs: 0,
      members: group.members.map(member => ({ ...member, position, path: [target] })) }];
    return state;
  }
  throw new Error('Expected a distant walkable bush approach in the generated fixture');
}

/** Move a hero beside a real generated pack without changing terrain or rosters. */
function approach(state: ExpeditionState, joinAll = false): ExpeditionState {
  const groups = groupsOf(state);
  const position = groups[0].members[0].position;
  const point = formationPoints(state.world.chunk, position, 2).find(point => point.x !== position.x || point.y !== position.y)!;
  const nearby = groups.map((group, index) => index > 0 && (index < 2 || joinAll)
    ? { ...group, home: position, members: group.members.map(member => ({ ...member, position, path: [], movement: { ...member.movement!, elapsedMs: 0 } })) }
    : group);
  return { ...state, world: { ...state.world, actors: state.world.actors.map((actor, index) => index ? actor : { ...actor, position: point, path: [] }) },
    roaming: { ...state.roaming!, chunks: { ...state.roaming!.chunks, [state.world.currentChunkId]: nearby } } };
}

function takeExit(state: ExpeditionState, id: string): ExpeditionState {
  const exit = state.world.chunk.exits.find(candidate => candidate.id === id)!;
  const delta = DELTAS[exit.direction];
  const position = { x: exit.position.x - delta.x, y: exit.position.y - delta.y };
  state = { ...state, world: { ...state.world, actors: state.world.actors.map((actor, index) => index ? actor
    : { ...actor, position, path: [], movement: { ...actor.movement!, elapsedMs: 0 } }) } };
  const commanded = moveExpedition(state, state.world.actors[0].id, exit.position);
  expect(commanded.accepted).toBe(true);
  const transitioned = stepExpedition(commanded.state, gameContent, 280);
  expect(transitioned.combat).toBeNull();
  expect(transitioned.world.currentChunkId).toBe(exit.targetNodeId);
  return transitioned;
}

describe('roaming expedition integration', () => {
  it('saves current mob bush progress exactly and resumes at the normal step duration', () => {
    const state = mobBushFixture();
    const member = groupsOf(state)[0].members[0]; const target = member.path[0];
    const duration = movementStepMs(member);
    member.movement!.elapsedMs = duration * 0.75;
    const restored = saveLoad(state);
    expect(restored).toEqual(state);
    expect(saveLoad(restored)).toEqual(restored);
    const resumed = stepExpedition(restored, gameContent, Math.ceil(duration * 0.25));
    expect(groupsOf(resumed)[0].members[0].position).toEqual(target);
  });

  it('normalizes older double-duration mob bush saves without admitting invalid clocks elsewhere', () => {
    const state = mobBushFixture();
    const member = groupsOf(state)[0].members[0]; const target = member.path[0];
    const duration = movementStepMs(member);
    member.movement!.elapsedMs = duration * 1.5;
    const restored = saveLoad(state);
    expect(groupsOf(restored)[0].members[0].movement!.elapsedMs).toBe(duration * 0.75);
    expect(saveLoad(restored)).toEqual(restored);
    expect(groupsOf(stepExpedition(restored, gameContent, Math.ceil(duration * 0.25)))[0].members[0].position).toEqual(target);
    member.movement!.elapsedMs = duration * 2;
    expect(() => saveLoad(state)).toThrow('Invalid mob movement progress');
    member.movement!.elapsedMs = duration * 1.5;
    member.path = [];
    expect(() => saveLoad(state)).toThrow('Invalid mob movement progress');
  });

  it('saves ordinary pursuit from five tiles, retargets a closer ally and fights only on contact', () => {
    let state = stepExpedition(pursuitFixture(), gameContent, 40);
    expect(state.combat).toBeNull();
    expect(groupsOf(state)[0]).toMatchObject({ mode: 'chase', targetActorId: state.world.actors[0].id, chases: false });
    expect(saveLoad(state)).toEqual(state);
    const nearest = state.world.actors[1].id;
    state = { ...state, world: { ...state.world, actors: state.world.actors.map((actor, index) =>
      index === 1 ? { ...actor, position: { x: 24, y: 6 } } : actor) } };
    state = stepExpedition(state, gameContent, 40);
    expect(state.combat).toBeNull();
    expect(groupsOf(state)[0].targetActorId).toBe(nearest);
    for (let tick = 0; tick < 80 && !state.combat; tick++) {
      const next = stepExpedition(state, gameContent, 40);
      expect(stepExpedition(saveLoad(state), gameContent, 40)).toEqual(next);
      state = next;
    }
    expect(state.combat?.encounterId).toBe('roaming');
    expect(state.roaming!.active).toMatchObject({ actorId: nearest, triggerRadius: 1 });
    const target = state.world.actors.find(actor => actor.id === nearest)!;
    const mob = groupsOf(state)[0].members[0];
    expect(Math.hypot(target.position.x - mob.position.x, target.position.y - mob.position.y)).toBeLessThanOrEqual(1);
    expect(saveLoad(state)).toEqual(state);
  });

  it('preserves older five-tile battle saves while enforcing one-tile geometry for new battles', () => {
    const state = pursuitFixture();
    const encounter = findRoamingEncounter(state.world.chunk, groupsOf(state), state.world.actors, 5)!;
    expect(encounter).not.toBeNull();
    const legacy = beginRoamingBattle(state, encounter, gameContent);
    delete legacy.roaming!.active!.triggerRadius;
    delete legacy.roaming!.active!.includePursuers;
    expect(saveLoad(legacy)).toEqual(legacy);
    const current = structuredClone(legacy);
    current.roaming!.active!.triggerRadius = 1;
    expect(() => saveLoad(current)).toThrow('Invalid roaming engagement geometry');
    const edited = JSON.parse(serializeExpedition(legacy, gameContent));
    edited.roaming.active.triggerRadius = 5;
    expect(() => deserializeExpedition(JSON.stringify(edited), gameContent)).toThrow();
  });

  it('commits distant pursuing packs, preserves their roster on load, and clears every participant after victory', () => {
    const approached = approach(create());
    const groups = groupsOf(approached);
    const origin = groups[0].members[0].position;
    const distant = formationPoints(approached.world.chunk, origin, 35).find(point =>
      approached.world.actors.every(hero => Math.hypot(point.x - hero.position.x, point.y - hero.position.y) > 6)
      && Math.hypot(point.x - origin.x, point.y - origin.y) > 6)!;
    expect(distant).toBeDefined();
    const hunter = groups[2];
    hunter.home = distant;
    hunter.members = hunter.members.map(member => ({ ...member, position: { ...distant }, path: [] }));
    hunter.mode = 'chase'; hunter.targetActorId = approached.world.actors[0].id;
    const battle = stepExpedition(approached, gameContent, 40);
    expect(battle.roaming!.active?.groupIds).toEqual(groups.map(group => group.id));
    expect(battle.combat?.enemyIds).toEqual(groups.flatMap(group => group.members.map(member => member.definitionId)));
    expect(saveLoad(battle)).toEqual(battle);
    // Reinforcement cleanup is independent of whether this large roster is balanced.
    const protectedBattle = structuredClone(battle.combat!);
    protectedBattle.units.filter(unit => unit.team === 'heroes').forEach(unit => { unit.shield = 1_000_000; });
    const combat = runCombat(protectedBattle, gameContent);
    expect(combat.status).toBe('victory');
    expect(groupsOf(leaveEncounter({ ...battle, combat }))).toEqual([]);

    // Old active encounters keep the original limited reinforcement roster.
    const oldEncounter = findRoamingEncounter(approached.world.chunk, groups, approached.world.actors, 1, false)!;
    expect(oldEncounter.groupIds).not.toContain(hunter.id);
    const legacy = beginRoamingBattle(approached, oldEncounter, gameContent);
    delete legacy.roaming!.active!.includePursuers;
    expect(saveLoad(legacy)).toEqual(legacy);
  });

  it('starts safe, advances mobs while heroes stand still, and resumes every clock exactly', () => {
    let state = create();
    expect(findRoamingEncounter(state.world.chunk, groupsOf(state), state.world.actors)).toBeNull();
    const original = structuredClone(state);
    // Stop during an actual partial step, independent of patrol pause lengths.
    for (let tick = 0; tick < 160 && (tick < 93 || !groupsOf(state).some(group => group.members.some(member => member.movement!.elapsedMs > 0))); tick++) {
      state = stepExpedition(state, gameContent, 40);
    }
    expect(state.combat).toBeNull(); expect(state.world.actors).toEqual(original.world.actors);
    expect(groupsOf(state).some((group, index) => group.members.some((member, memberIndex) =>
      JSON.stringify(member.position) !== JSON.stringify(groupsOf(original)[index].members[memberIndex].position)))).toBe(true);
    expect(groupsOf(state).some(group => group.members.some(member => member.movement!.elapsedMs > 0))).toBe(true);
    const restored = saveLoad(state);
    expect(restored).toEqual(state);
    for (let tick = 0; tick < 40; tick++) {
      const next = stepExpedition(state, gameContent, 40);
      expect(stepExpedition(saveLoad(state), gameContent, 40)).toEqual(next);
      state = next;
    }
    expect(stepExpedition(original, gameContent)).toEqual(stepExpedition(original, gameContent, 280));
  });

  it('starts before occupying a mob tile, freezes the world, and saves the exact recruited battle', () => {
    const approached = approach(create());
    expect(approached.world.actors[0].position).not.toEqual(groupsOf(approached)[0].members[0].position);
    let state = stepExpedition(approached, gameContent, 40);
    expect(state.combat?.encounterId).toBe('roaming');
    expect(state.roaming!.active?.groupIds).toEqual(groupsOf(state).slice(0, 2).map(group => group.id));
    expect(state.combat?.enemyIds).toEqual(groupsOf(state).slice(0, 2).flatMap(group => group.members.map(member => member.definitionId)));
    expect(state.combat?.characterIds).toEqual(party);
    expect(state.world.actors.every(actor => !actor.path.length)).toBe(true);
    expect(groupsOf(state).every(group => group.members.every(member => !member.path.length && !member.movement!.elapsedMs))).toBe(true);
    expect(stepExpedition(state, gameContent, 60_000)).toBe(state);
    expect(moveExpedition(state, party[0], state.world.chunk.spawn).accepted).toBe(false);
    state = stepExpeditionCombat(state, gameContent);
    const restored = saveLoad(state);
    expect(restored).toEqual(state);
    expect(stepExpeditionCombat(restored, gameContent)).toEqual(stepExpeditionCombat(state, gameContent));
  });

  it('removes every recruited group after victory and keeps uninvolved groups and the result saved', () => {
    const state = stepExpedition(approach(create()), gameContent, 40);
    const combat = runCombat(state.combat!, gameContent);
    expect(combat.status).toBe('victory');
    const won = leaveEncounter({ ...state, combat });
    expect(won.combat).toBeNull(); expect(won.roaming!.active).toBeNull();
    expect(groupsOf(won).map(group => group.id)).toEqual(groupsOf(state).slice(2).map(group => group.id));
    expect(won.clearedPoiIds).toEqual([]);
    expect(saveLoad(won)).toEqual(won);
    expect(stepExpedition(won, gameContent, 40).combat).toBeNull();
  });

  it('retains defeat and enemy population without returning or healing the party', () => {
    const state = stepExpedition(approach(create(['mage']), true), gameContent, 40);
    const combat = runCombat(state.combat!, gameContent);
    expect(combat.status).toBe('defeat');
    const returned = leaveEncounter({ ...state, combat });
    expect(returned.world.currentChunkId).toBe(returned.world.graph.startId);
    expect(returned.world.actors[0].position).toEqual(state.world.actors[0].position);
    expect(returned.failed).toBe(true);
    expect(returned.world.actors[0].body).toEqual(combat.units[0].body);
    expect(stepExpedition(returned, gameContent)).toBe(returned);
    expect(groupsOf(returned).map(group => group.id)).toEqual(groupsOf(state).map(group => group.id));
    expect(findRoamingEncounter(returned.world.chunk, groupsOf(returned), returned.world.actors)).toBeNull();
    expect(groupsOf(returned).every(group => group.mode === 'patrol' && group.targetActorId === null)).toBe(true);
    expect(saveLoad(returned)).toEqual(returned);
  });

  it('initializes the camp population when upgrading a legacy save away from camp, then losing', () => {
    const initial = createExpedition('audit-legacy-return', ['mage'], gameContent);
    const { roaming: _roaming, ...legacy } = initial;
    const exit = legacy.world.chunk.exits.find(candidate => candidate.direction === 'east')!;
    const away = enableRoaming(saveLoad(takeExit(legacy, exit.id)), gameContent);
    const campGroups = away.roaming!.chunks[away.world.graph.startId];
    expect(campGroups.length).toBeGreaterThanOrEqual(2);
    expect(saveLoad(away)).toEqual(away);
    const state = stepExpedition(approach(away, true), gameContent, 40);
    const combat = runCombat(state.combat!, gameContent);
    expect(combat.status).toBe('defeat');
    const returned = leaveEncounter({ ...state, combat });
    expect(returned.failed).toBe(true);
    expect(returned.world.currentChunkId).toBe(state.world.currentChunkId);
    expect(returned.roaming!.chunks[returned.world.graph.startId]).toEqual(campGroups);
    expect(findRoamingEncounter(returned.world.chunk, groupsOf(returned), returned.world.actors)).toBeNull();
    expect(saveLoad(returned)).toEqual(returned);
  });

  it('preserves off-screen positions and safely initializes reciprocal chunk transitions', () => {
    const start = create(); const exit = start.world.chunk.exits.find(candidate => candidate.direction === 'north')!;
    const next = takeExit(start, exit.id);
    expect(next.roaming!.chunks[start.world.currentChunkId]).toEqual(groupsOf(start));
    expect(next.world.actors.every(actor => JSON.stringify(actor.position) === JSON.stringify(next.world.actors[0].position))).toBe(true);
    expect(groupsOf(next).length).toBeGreaterThanOrEqual(2);
    expect(findRoamingEncounter(next.world.chunk, groupsOf(next), next.world.actors)).toBeNull();
    expect(saveLoad(next)).toEqual(next);
    const returned = takeExit(next, exit.returnGateId);
    expect(groupsOf(returned).map(group => group.members.map(member => member.position)))
      .toEqual(groupsOf(start).map(group => group.members.map(member => member.position)));
    expect(returned.roaming!.chunks[next.world.currentChunkId]).toEqual(groupsOf(next));
    expect(saveLoad(returned)).toEqual(returned);
  });

  it('moves a persistent pack away from a returning party and saves the new patrol home', () => {
    const start = create(); const exit = start.world.chunk.exits.find(candidate => candidate.direction === 'north')!;
    const next = takeExit(start, exit.id);
    const delta = DELTAS[exit.direction];
    const entrance: GridPoint = { x: exit.position.x - delta.x, y: exit.position.y - delta.y };
    const crowded: ExpeditionState = { ...next, roaming: { ...next.roaming!, chunks: { ...next.roaming!.chunks,
      [start.world.currentChunkId]: groupsOf(start).map((group, index) => index ? group : { ...group, home: entrance,
        members: group.members.map(member => ({ ...member, position: entrance })) }) } } };
    const returned = takeExit(crowded, exit.returnGateId);
    expect(groupsOf(returned)[0].home).not.toEqual(entrance);
    expect(findRoamingEncounter(returned.world.chunk, groupsOf(returned), returned.world.actors)).toBeNull();
    expect(saveLoad(returned)).toEqual(returned);
  });

  it('rejects edited group rosters, pursuit traits, impossible movement, and battle provenance', () => {
    const initial = create(); const encoded = JSON.parse(serializeExpedition(initial, gameContent));
    const edits: ((saved: typeof encoded) => void)[] = [
      saved => { saved.roaming.chunks['0,0'][0].members[0].definitionId = 'elite_warden'; },
      saved => { saved.roaming.chunks['0,0'][0].chases = !saved.roaming.chunks['0,0'][0].chases; },
      saved => { saved.roaming.chunks['0,0'][0].members[0].movement.elapsedMs = 9999; },
      saved => { saved.roaming.chunks['0,0'][0].members[0].position = { x: 17, y: 17 }; },
      saved => { saved.roaming.chunks['0,0'][0].members.pop(); },
    ];
    for (const edit of edits) {
      const changed = structuredClone(encoded); edit(changed);
      expect(() => deserializeExpedition(JSON.stringify(changed), gameContent), edit.toString()).toThrow();
    }
    const battle = stepExpedition(approach(initial), gameContent, 40);
    const savedBattle = JSON.parse(serializeExpedition(battle, gameContent));
    for (const mutate of [
      (saved: typeof encoded) => { saved.roaming.active.groupIds.pop(); },
      (saved: typeof encoded) => { saved.roaming.active.actorId = 'mage'; },
      (saved: typeof encoded) => { saved.roaming.battleSerial++; },
    ]) {
      const changed = structuredClone(savedBattle); mutate(changed);
      expect(() => deserializeExpedition(JSON.stringify(changed), gameContent), mutate.toString()).toThrow();
    }
    // A legitimate completed fight can leave a different pack near an ally.
    // Save/load preserves that pending engagement, and the very next tick starts it.
    const pending = structuredClone(savedBattle);
    pending.combat = null; pending.activePoiId = null; pending.roaming.active = null;
    const resumed = stepExpedition(deserializeExpedition(JSON.stringify(pending), gameContent), gameContent, 40);
    expect(resumed.combat?.encounterId).toBe('roaming');
    expect(resumed.roaming!.active?.groupIds).toEqual(battle.roaming!.active?.groupIds);
  });
});
