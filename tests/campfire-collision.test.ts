import { describe, expect, it } from 'vitest';
import {
  chunkRegions, createExploration, deserializeExploration, findPath, generateChunk, generateWorld,
  regionAt, requestMove, serializeExploration, stepExploration, validateChunk,
} from '@shards/game-core';
import type { ExplorationState, GridPoint, WorldChunk } from '@shards/shared';

const party = ['guardian', 'priest', 'mage'];
const fire = { x: 17, y: 17 };
const tile = (chunk: WorldChunk, point: GridPoint) => chunk.tiles[point.y * chunk.size + point.x];
const fixture = () => createExploration({ seed: 'FIRST-CAMPFIRE', characterIds: party });

function assertSafePath(chunk: WorldChunk, start: GridPoint, path: GridPoint[], target: GridPoint) {
  expect(path.length).toBeGreaterThan(0);
  expect(path.at(-1)).toEqual(target);
  let previous = start;
  for (const point of path) {
    expect(tile(chunk, point).walkable).toBe(true);
    expect(point).not.toEqual(fire);
    expect(Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y)).toBe(1);
    previous = point;
  }
}

function snapshotWithActor(position: GridPoint, path: GridPoint[] = []) {
  const state = fixture();
  state.actors = [{ id: 'guardian', position, path }];
  return JSON.parse(serializeExploration(state));
}

describe('campfire collision', () => {
  it('blocks the fire footprint while spawning the party on distinct neighboring ground', () => {
    const state = fixture();
    expect(state.chunk.pois.find(poi => poi.kind === 'campfire')?.position).toEqual(fire);
    expect(tile(state.chunk, fire)).toEqual({ terrain: 'grass', walkable: false, movementCost: 1 });
    expect(state.chunk.spawn).toEqual({ x: 17, y: 18 });
    expect(state.actors.map(actor => actor.position)).toEqual([{ x: 17, y: 16 }, { x: 16, y: 17 }, { x: 18, y: 17 }]);
    expect(new Set(state.actors.map(actor => `${actor.position.x},${actor.position.y}`)).size).toBe(party.length);
    for (const actor of state.actors) expect(tile(state.chunk, actor.position).walkable).toBe(true);
  });

  it('rejects walking onto the flames and takes a cardinal detour to the opposite side', () => {
    const state = fixture();
    const rejected = requestMove(state, 'guardian', fire);
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(state);
    expect(findPath(state.chunk, state.chunk.spawn, fire)).toEqual([]);
    const target = { x: 17, y: 18 };
    const command = requestMove(state, 'guardian', target);
    expect(command.accepted).toBe(true);
    assertSafePath(state.chunk, state.actors[0].position, command.state.actors[0].path, target);
    expect(command.state.actors[0].path.length).toBe(4);
    let walked = command.state;
    while (walked.actors[0].path.length) {
      walked = stepExploration(walked);
      expect(walked.actors[0].position).not.toEqual(fire);
    }
    expect(walked.actors[0].position).toEqual(target);
    expect(walked.actors.slice(1)).toEqual(state.actors.slice(1));
  });

  it('cancels a stale next step onto newly blocked ground without moving the actor', () => {
    const state = fixture();
    const blocked = { x: 18, y: 16 };
    tile(state.chunk, blocked).walkable = false;
    const stale: ExplorationState = { ...state, actors: state.actors.map((actor, index) => index === 0
      ? { ...actor, path: [blocked, { x: 19, y: 16 }] } : actor) };
    const before = structuredClone(stale);
    const stepped = stepExploration(stale);
    expect(stepped.actors[0].position).toEqual(state.actors[0].position);
    expect(stepped.actors[0].path).toEqual([]);
    expect(stepped.actors.slice(1)).toEqual(state.actors.slice(1));
    expect(stale).toEqual(before);
    expect(stepExploration(stepped)).toBe(stepped);
  });

  it('repairs an already running old route before its next step can enter the fire', () => {
    const state = fixture();
    state.actors[0].position = { x: 17, y: 18 };
    state.actors[0].path = [fire, { x: 17, y: 16 }];
    const before = structuredClone(state);
    const stepped = stepExploration(state);
    expect(stepped.actors[0].position).not.toEqual(fire);
    expect(stepped.actors[0].position).not.toEqual(state.actors[0].position);
    assertSafePath(stepped.chunk, stepped.actors[0].position, stepped.actors[0].path, { x: 17, y: 16 });
    expect(state).toEqual(before);
  });

  it('safely upgrades a live pre-fix map even when the next click targets the fire', () => {
    const legacy = fixture();
    legacy.chunk.spawn = { ...fire };
    tile(legacy.chunk, fire).walkable = true;
    legacy.actors = [
      { id: 'guardian', position: fire, path: [] },
      { id: 'priest', position: { x: 17, y: 16 }, path: [] },
      { id: 'mage', position: { x: 18, y: 17 }, path: [] },
    ];
    const before = structuredClone(legacy);
    const result = requestMove(legacy, 'guardian', fire);
    expect(result.accepted).toBe(false);
    expect(result.state.actors[0].position).toEqual({ x: 17, y: 18 });
    expect(result.state.chunk.spawn).toEqual({ x: 17, y: 18 });
    expect(tile(result.state.chunk, fire).walkable).toBe(false);
    expect(result.state.actors.slice(1)).toEqual(legacy.actors.slice(1));
    expect(legacy).toEqual(before);
  });

  it('preserves reachable entrances and validates deterministic chunks with an occupied camp', () => {
    for (const seed of ['FIRST-CAMPFIRE', 'CAMP-COLLISION-A', 'CAMP-COLLISION-B']) {
      const graph = generateWorld(seed);
      const chunk = generateChunk(graph, graph.startId);
      expect(generateChunk(graph, graph.startId)).toEqual(chunk);
      expect(validateChunk(chunk)).toEqual({ valid: true, errors: [] });
      const regions = chunkRegions(chunk);
      const main = regionAt(chunk, regions, chunk.spawn);
      expect(regionAt(chunk, regions, fire)).toBe(-1);
      const exits = chunk.exits.filter(exit => regionAt(chunk, regions, exit.position) === main);
      expect(exits.length).toBeGreaterThanOrEqual(4);
      for (const exit of exits) assertSafePath(chunk, chunk.spawn, findPath(chunk, chunk.spawn, exit.position), exit.position);
      expect(findPath(chunk, chunk.spawn, chunk.pois.find(poi => poi.kind === 'encounter')!.position).length).toBeGreaterThan(0);
    }
  });

  it('still rejects an open fire tile and unexplained blocked ground elsewhere', () => {
    const openFire = fixture().chunk;
    tile(openFire, fire).walkable = true;
    expect(validateChunk(openFire).valid).toBe(false);
    const blockedGround = fixture().chunk;
    tile(blockedGround, { x: 19, y: 18 }).walkable = false;
    expect(validateChunk(blockedGround).errors).toContain('Invalid tile');
  });
});

describe('saved walks from before campfires became solid', () => {
  it('moves a saved hero off the fire without displacing allies or losing progress', () => {
    const state = fixture();
    state.actors = [
      { id: 'guardian', position: fire, path: [] },
      { id: 'priest', position: { x: 17, y: 16 }, path: [] },
      { id: 'mage', position: { x: 18, y: 17 }, path: [] },
    ];
    state.tick = 42;
    const restored = deserializeExploration(serializeExploration(state));
    expect(restored.actors[0].position).not.toEqual(fire);
    expect(Math.abs(restored.actors[0].position.x - fire.x) + Math.abs(restored.actors[0].position.y - fire.y)).toBe(1);
    expect(tile(restored.chunk, restored.actors[0].position).walkable).toBe(true);
    expect(restored.actors.slice(1)).toEqual(state.actors.slice(1));
    expect(new Set(restored.actors.map(actor => `${actor.position.x},${actor.position.y}`)).size).toBe(3);
    expect(restored.tick).toBe(42);
    expect(restored.visited).toEqual(state.visited);
    expect(restored.currentChunkId).toBe(state.currentChunkId);
    expect(deserializeExploration(serializeExploration(restored))).toEqual(restored);
  });

  it('reroutes an old walk through the fire while retaining its requested destination', () => {
    const start = { x: 16, y: 17 }; const target = { x: 18, y: 17 };
    const old = snapshotWithActor(start, [fire, target]);
    const restored = deserializeExploration(JSON.stringify(old));
    expect(restored.actors[0].position).toEqual(start);
    assertSafePath(restored.chunk, start, restored.actors[0].path, target);
    expect(restored.actors[0].path.length).toBeGreaterThan(old.actors[0].path.length);
  });

  it('retains a valid destination when a saved walk begins in the fire', () => {
    const target = { x: 19, y: 17 };
    const restored = deserializeExploration(JSON.stringify(snapshotWithActor(fire, [{ x: 18, y: 17 }, target])));
    expect(restored.actors[0].position).not.toEqual(fire);
    assertSafePath(restored.chunk, restored.actors[0].position, restored.actors[0].path, target);
  });

  it('clears an old destination in the flames while retaining the safe current position', () => {
    const start = { x: 17, y: 18 };
    const restored = deserializeExploration(JSON.stringify(snapshotWithActor(start, [fire])));
    expect(restored.actors[0]).toEqual({ id: 'guardian', position: start, path: [] });
  });

  it('does not use fire migration to accept corrupt paths or other blocked positions', () => {
    const impossible = [
      snapshotWithActor({ x: 15, y: 17 }, [fire, { x: 18, y: 17 }]),
      snapshotWithActor({ x: 16, y: 17 }, [fire, { x: 18, y: 17 }, fire]),
      snapshotWithActor(fire, [{ x: 19, y: 17 }]),
      snapshotWithActor({ x: 0, y: 0 }),
    ];
    for (const snapshot of impossible) expect(() => deserializeExploration(JSON.stringify(snapshot))).toThrow();
    const unchanged = fixture();
    expect(deserializeExploration(serializeExploration(unchanged))).toEqual(unchanged);
  });
});
