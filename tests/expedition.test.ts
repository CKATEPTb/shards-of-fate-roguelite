import { describe, expect, it } from 'vitest';
import { createCombat, createExpedition, deserializeExpedition, generateChunk, leaveEncounter, moveExpedition, runCombat, serializeExpedition, stepExpedition, stepExpeditionCombat } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import type { ExpeditionState, GridPoint } from '@shards/shared';

const party = ['guardian', 'priest', 'mage'];
/** Keep the old point encounters covered for existing saves awaiting migration. */
function createLegacyExpedition(seed: string): ExpeditionState {
  const { roaming: _roaming, ...legacy } = createExpedition(seed, party, gameContent);
  return legacy;
}
function walk(state: ExpeditionState, target: GridPoint) {
  const command = moveExpedition(state, state.world.actors[0].id, target);
  expect(command.accepted).toBe(true);
  state = command.state;
  for (let steps = 0; steps < 1300 && !state.combat && state.world.actors.some(actor => actor.path.length); steps++) state = stepExpedition(state, gameContent);
  return state;
}
function enterEncounter(seed = 'FIRST-CAMPFIRE') {
  const initial = createLegacyExpedition(seed);
  return walk(initial, initial.world.chunk.pois.find(poi => poi.kind === 'encounter')!.position);
}

describe('legacy point encounters remain compatible', () => {
  it('walks to an encounter, freezes paths, resolves it and allows continued exploration', () => {
    const initial = createLegacyExpedition('FIRST-CAMPFIRE');
    const poi = initial.world.chunk.pois.find(item => item.kind === 'encounter')!;
    let state = walk(initial, poi.position);
    expect(initial.combat).toBeNull();
    expect(state.combat?.encounterId).toBe(poi.encounterId);
    expect(state.combat?.characterIds).toEqual(state.world.actors.map(actor => actor.id));
    expect(state.combat?.units.filter(unit => unit.team === 'heroes').map(unit => unit.definitionId)).toEqual(party);
    expect(state.world.actors.every(actor => actor.path.length === 0)).toBe(true);
    expect(stepExpedition(state, gameContent)).toBe(state);
    expect(moveExpedition(state, party[0], initial.world.chunk.spawn).accepted).toBe(false);
    for (const actor of state.world.actors) expect(moveExpedition(state, actor.id, initial.world.chunk.exits[0].position).accepted).toBe(false);
    expect(leaveEncounter(state)).toBe(state);
    for (let turn = 0; turn < 1000 && state.combat && !['victory', 'defeat', 'draw'].includes(state.combat.status); turn++) state = stepExpeditionCombat(state, gameContent);
    expect(state.combat?.status).toBe('victory');
    const resolved = leaveEncounter(state);
    expect(resolved.combat).toBeNull();
    expect(resolved.clearedPoiIds).toContain(poi.id);
    const atCampfire = walk(resolved, initial.world.chunk.spawn);
    expect(walk(atCampfire, poi.position).combat).toBeNull();
  });

  it('replays map-triggered battles deterministically', () => {
    const first = enterEncounter();
    const second = enterEncounter();
    expect(runCombat(first.combat!, gameContent)).toEqual(runCombat(second.combat!, gameContent));
  });

  it('activates a simultaneous altar arrival after victory, even while idle or trying to leave', () => {
    const initial = createLegacyExpedition('SIMULTANEOUS-ALTAR');
    const graph = initial.world.graph;
    const chunk = generateChunk(graph, graph.altarNodeId);
    const encounter = chunk.pois.find(poi => poi.kind === 'encounter')!;
    const altar = chunk.pois.find(poi => poi.kind === 'altar')!;
    // Build a valid visit history for a local fixture with two heroes one step from each POI.
    const routes = [[graph.startId]];
    const seen = new Set([graph.startId]);
    let visited: string[] = [];
    for (let index = 0; index < routes.length; index++) {
      const route = routes[index];
      if (route.at(-1) === chunk.id) { visited = route; break; }
      const node = graph.nodes.find(candidate => candidate.id === route.at(-1))!;
      for (const next of Object.values(node.exits)) if (!seen.has(next)) { seen.add(next); routes.push([...route, next]); }
    }
    const arriving: ExpeditionState = {
      ...initial,
      world: {
        ...initial.world, chunk, currentChunkId: chunk.id, visited, transitions: visited.length - 1, tick: 1000,
        actors: initial.world.actors.map((actor, index) => {
          const target = index === 0 ? encounter.position : index === 1 ? altar.position : chunk.spawn;
          return { ...actor, position: index < 2 ? { x: target.x - 1, y: target.y } : target, path: index < 2 ? [target] : [] };
        }),
      },
    };
    const battling = stepExpedition(arriving, gameContent);
    expect(battling.activePoiId).toBe(encounter.id);
    expect(battling.world.actors[1].position).toEqual(altar.position);
    expect(battling.completed).toBe(false);
    // This fixture exercises queued POI arrivals, independent of lethal battle balance.
    const protectedBattle = structuredClone(battling.combat!);
    protectedBattle.units.filter(unit => unit.team === 'heroes').forEach(unit => { unit.shield = 1_000_000; });
    const combat = runCombat(protectedBattle, gameContent);
    expect(combat.status).toBe('victory');
    const victory = leaveEncounter({ ...battling, combat });
    expect(victory.world.actors.every(actor => actor.path.length === 0)).toBe(true);
    const restored = deserializeExpedition(serializeExpedition(victory, gameContent), gameContent);
    const idle = stepExpedition(restored, gameContent);
    expect(idle.completed).toBe(true);
    expect(idle.clearedPoiIds).toEqual([encounter.id, altar.id]);
    const departing = moveExpedition(restored, party[1], { x: altar.position.x - 1, y: altar.position.y }).state;
    const activated = stepExpedition(departing, gameContent);
    expect(activated.completed).toBe(true);
    expect(activated.world.actors[1].position).toEqual(altar.position);
  });

  it('ends a defeated expedition without teleporting, healing or clearing the encounter', () => {
    const state = enterEncounter();
    const defeated = runCombat(createCombat({ seed: 'defeat', characterIds: ['mage'], encounterId: 'warden_grove' }, gameContent), gameContent);
    expect(defeated.status).toBe('defeat');
    const returned = leaveEncounter({ ...state, combat: defeated });
    expect(returned.world.currentChunkId).toBe(returned.world.graph.startId);
    expect(returned.failed).toBe(true);
    expect(returned.world.actors.map(actor => actor.position)).toEqual(state.world.actors.map(actor => actor.position));
    expect(stepExpedition(returned, gameContent)).toBe(returned);
    expect(returned.world.actors.every(actor => actor.path.length === 0)).toBe(true);
    expect(returned.clearedPoiIds).toEqual([]);
  });
});

describe('expedition saves', () => {
  it('resumes a walking party and a partially played battle exactly', () => {
    const initial = createLegacyExpedition('save-map');
    const poi = initial.world.chunk.pois.find(item => item.kind === 'encounter')!;
    const walking = stepExpedition(moveExpedition(initial, party[0], poi.position).state, gameContent);
    const restored = deserializeExpedition(serializeExpedition(walking, gameContent), gameContent);
    expect(restored).toEqual(walking);
    expect(stepExpedition(restored, gameContent)).toEqual(stepExpedition(walking, gameContent));
    const battle = stepExpeditionCombat(enterEncounter(), gameContent);
    const battleRestore = deserializeExpedition(serializeExpedition(battle, gameContent), gameContent);
    expect(battleRestore).toEqual(battle);
    expect(stepExpeditionCombat(battleRestore, gameContent)).toEqual(stepExpeditionCombat(battle, gameContent));
  });

  it('round-trips a cleared encounter and rejects mismatched combat, content and invalid progression', () => {
    const state = enterEncounter();
    const won = leaveEncounter({ ...state, combat: runCombat(state.combat!, gameContent) });
    expect(deserializeExpedition(serializeExpedition(won, gameContent), gameContent)).toEqual(won);
    const encoded = JSON.parse(serializeExpedition(state, gameContent));
    for (const changed of [
      { ...encoded, contentHash: 'old-content' },
      { ...encoded, activePoiId: null },
      { ...encoded, activePoiId: null, combat: null },
      { ...encoded, activePoiId: 'unknown' },
      { ...encoded, clearedPoiIds: [state.activePoiId] },
      { ...encoded, clearedPoiIds: ['unknown'] },
      { ...encoded, completed: true },
      { ...encoded, extra: 'field' },
    ]) expect(() => deserializeExpedition(JSON.stringify(changed), gameContent)).toThrow();
    const foreign = createCombat({ seed: 'foreign', characterIds: party, encounterId: 'mossy_path' }, gameContent);
    expect(() => deserializeExpedition(JSON.stringify({ ...encoded, combat: JSON.stringify(foreign) }), gameContent)).toThrow();
    expect(() => deserializeExpedition('{broken', gameContent)).toThrow();
  });
});
