import { describe, expect, it } from 'vitest';
import {
  createExploration, deserializeExploration, findPath, generateChunk, generateWorld,
  requestMove, serializeExploration, stepExploration, validateChunk, validateWorld,
} from '@shards/game-core';
import type { ExplorationState, GridPoint, WorldChunk } from '@shards/shared';
import { independentWinterRoutes } from '../packages/game-core/src/world/routes';

const party = ['guardian', 'priest', 'mage'];
const same = (left: GridPoint, right: GridPoint) => left.x === right.x && left.y === right.y;
const advance = (initial: ExplorationState, limit = 1225): ExplorationState => {
  let state = initial;
  for (let tick = 0; tick < limit && state.actors.some(actor => actor.path.length); tick++) state = stepExploration(state);
  return state;
};

function assertPath(chunk: WorldChunk, start: GridPoint, target: GridPoint): void {
  const path = findPath(chunk, start, target);
  if (same(start, target)) { expect(path).toEqual([]); return; }
  expect(path.length).toBeGreaterThan(0);
  expect(path.at(-1)).toEqual(target);
  let previous = start;
  for (const point of path) {
    expect(Math.abs(previous.x - point.x) + Math.abs(previous.y - point.y)).toBe(1);
    expect(chunk.tiles[point.y * chunk.size + point.x].walkable).toBe(true);
    previous = point;
  }
}

describe('seeded world and local chunks', () => {
  it('reproduces both graph and chunk independently of visitation order', () => {
    const graph = generateWorld('ORDER-INDEPENDENT');
    expect(generateWorld('ORDER-INDEPENDENT')).toEqual(graph);
    const first = generateChunk(graph, graph.nodes[3].id);
    for (const node of graph.nodes.slice(0, 12).reverse()) generateChunk(graph, node.id);
    expect(generateChunk(graph, graph.nodes[3].id)).toEqual(first);
    const other = generateWorld('DIFFERENT-SEED');
    expect(other.nodes).not.toEqual(graph.nodes);
    expect(generateChunk(other, other.startId).tiles).not.toEqual(generateChunk(graph, graph.startId).tiles);
  });

  it('supports the full seed contract without overflowing derived RNG seeds', () => {
    const state = createExploration({ seed: 'я'.repeat(256), characterIds: party });
    expect(deserializeExploration(serializeExploration(state))).toEqual(state);
    expect(() => generateWorld('')).toThrow();
    expect(() => generateWorld('a'.repeat(257))).toThrow();
  });

  it('has four independent routes, reciprocal gates and one reachable winter altar', () => {
    const graph = generateWorld('FOUR-ROUTES');
    expect(independentWinterRoutes(graph, 4)).toBe(4);
    let altars = 0;
    const sampledIds = new Set([graph.startId, graph.altarNodeId, ...graph.nodes.slice(0, 8).map(node => node.id)]);
    for (const node of graph.nodes.filter(node => sampledIds.has(node.id))) {
      const chunk = generateChunk(graph, node.id);
      expect(validateChunk(chunk), node.id).toEqual({ valid: true, errors: [] });
      expect(chunk.exits.length).toBeGreaterThanOrEqual(Object.keys(node.exits).length * 2);
      for (const exit of chunk.exits) {
        const neighbor = generateChunk(graph, exit.targetNodeId);
        const peer = neighbor.exits.find(gate => gate.id === exit.returnGateId)!;
        expect(peer.returnGateId).toBe(exit.id);
        expect(peer.targetNodeId).toBe(chunk.id);
        expect(exit.direction === 'east' || exit.direction === 'west' ? peer.position.y : peer.position.x)
          .toBe(exit.direction === 'east' || exit.direction === 'west' ? exit.position.y : exit.position.x);
      }
      for (const altar of chunk.pois.filter(poi => poi.kind === 'altar')) {
        altars++; expect(node.season).toBe('winter'); expect(node.id).toBe(graph.altarNodeId);
        assertPath(chunk, chunk.spawn, altar.position);
      }
    }
    expect(altars).toBe(1);
    expect(graph.altarNodeId).not.toBe(graph.startId);
  });

  it('detects bottlenecks, disconnected nodes and asymmetric graph edges independently', () => {
    const graph = generateWorld('BROKEN-WORLD');
    const center = graph.nodes.find(node => node.id === graph.startId)!;
    delete center.exits.north; delete center.exits.south;
    delete graph.nodes.find(node => node.id === '0,-1')!.exits.south;
    delete graph.nodes.find(node => node.id === '0,1')!.exits.north;
    expect(validateWorld(graph).errors).toContain('Fewer than three independent routes to winter');
    const broken = generateWorld('BROKEN-EDGE');
    broken.nodes[0].exits.north = 'missing';
    expect(validateWorld(broken).valid).toBe(false);
  });

  it('rejects sealed ground islands and unlabeled boundary openings', () => {
    const graph = generateWorld('BROKEN-CHUNK');
    const chunk = generateChunk(graph, graph.startId);
    for (const [x, y] of [[0, 1], [1, 0], [2, 1], [1, 2]]) chunk.tiles[y * chunk.size + x] = { terrain: 'rock', walkable: false, movementCost: 1 };
    chunk.tiles[1 * chunk.size + 1] = { terrain: 'grass', walkable: true, movementCost: 1 };
    expect(validateChunk(chunk).errors).toContain('Walkable region has no spawn or entrance');
    chunk.tiles[0] = { terrain: 'path', walkable: true, movementCost: 1 };
    expect(validateChunk(chunk).errors).toContain('Open boundary without an exit');
  });

});

describe('local movement', () => {
  it('moves along a cardinal path, without modifying the previous state', () => {
    const state = createExploration({ seed: 'WALK', characterIds: party });
    const before = structuredClone(state);
    const target = state.chunk.pois.find(poi => poi.kind === 'encounter')!.position;
    const intent = requestMove(state, 'guardian', target);
    expect(intent.accepted).toBe(true);
    expect(state).toEqual(before);
    expect(intent.state.graph).toBe(state.graph);
    expect(intent.state.chunk).toBe(state.chunk);
    const moved = advance(intent.state);
    expect(moved.actors[0].position).toEqual(target);
    expect(moved.tick).toBe(intent.state.actors[0].path.length);
    expect(moved.actors[1].position).toEqual(state.actors[1].position);
    expect(stepExploration(moved)).toBe(moved);
  });

  it('rejects blocked, noninteger, out-of-bounds and unknown-actor commands', () => {
    const state = createExploration({ seed: 'BLOCKED', characterIds: party });
    for (const target of [{ x: 0, y: 0 }, { x: -1, y: 17 }, { x: 35, y: 17 }, { x: 1.5, y: 17 }, { x: NaN, y: 17 }]) {
      const result = requestMove(state, 'guardian', target);
      expect(result.accepted).toBe(false); expect(result.state).toBe(state);
    }
    expect(requestMove(state, 'missing', state.chunk.spawn).accepted).toBe(false);
  });

  it('can redirect or stop an actor while walking', () => {
    const state = createExploration({ seed: 'REDIRECT', characterIds: party });
    const walking = requestMove(state, 'guardian', state.chunk.exits[0].position).state;
    const stepped = stepExploration(walking);
    const stopped = requestMove(stepped, 'guardian', stepped.actors[0].position);
    expect(stopped.accepted).toBe(true); expect(stopped.state.actors[0].path).toEqual([]);
    expect(advance(requestMove(stepped, 'guardian', state.chunk.spawn).state).actors[0].position).toEqual(state.chunk.spawn);
  });

  it('transfers all party members through each gate and places them safely inside the reciprocal gate', () => {
    const original = createExploration({ seed: 'PARTY-GATES', characterIds: party });
    for (const exit of original.chunk.exits) {
      const queued = requestMove(original, 'mage', exit.position).state;
      const destination = advance(queued);
      expect(destination.currentChunkId).toBe(exit.targetNodeId);
      expect(destination.transitions).toBe(1);
      expect(destination.visited).toEqual([original.currentChunkId, exit.targetNodeId]);
      expect(destination.actors.map(actor => actor.id)).toEqual(party);
      expect(new Set(destination.actors.map(actor => `${actor.position.x},${actor.position.y}`)).size).toBe(1);
      for (const actor of destination.actors) {
        expect(actor.path).toEqual([]);
        expect(destination.chunk.exits.some(gate => same(gate.position, actor.position))).toBe(false);
        expect(destination.chunk.tiles[actor.position.y * 35 + actor.position.x].walkable).toBe(true);
      }
      expect(stepExploration(destination)).toBe(destination);
      const back = destination.chunk.exits.find(gate => gate.id === exit.returnGateId)!;
      const returned = advance(requestMove(destination, 'priest', back.position).state);
      expect(returned.currentChunkId).toBe(original.currentChunkId);
      expect(returned.chunk).toEqual(original.chunk);
      expect(returned.transitions).toBe(2);
      expect(returned.visited).toHaveLength(2);
    }
  });

  it('respects terrain costs and cannot cut diagonal corners', () => {
    const chunk: WorldChunk = { id: 'test', season: 'spring', size: 5, spawn: { x: 1, y: 2 }, exits: [], pois: [], structures: [], tiles: Array.from({ length: 25 }, () => ({ terrain: 'grass', walkable: true, movementCost: 1 })) };
    chunk.tiles[2 * 5 + 2].movementCost = 9;
    const path = findPath(chunk, chunk.spawn, { x: 3, y: 2 });
    expect(path.length).toBe(4);
    expect(path.some(point => point.x === 2 && point.y === 2)).toBe(false);
    chunk.tiles = chunk.tiles.map(() => ({ terrain: 'rock', walkable: false, movementCost: 1 }));
    chunk.tiles[1 * 5 + 1] = { terrain: 'grass', walkable: true, movementCost: 1 };
    chunk.tiles[2 * 5 + 2] = { terrain: 'grass', walkable: true, movementCost: 1 };
    expect(findPath(chunk, { x: 1, y: 1 }, { x: 2, y: 2 })).toEqual([]);
  });
});

describe('exploration saves', () => {
  it('round-trips an in-flight path and resumes the same simulation', () => {
    const start = createExploration({ seed: 'SAVE-WALK', characterIds: party });
    let walking = requestMove(start, 'guardian', start.chunk.exits[0].position).state;
    walking = stepExploration(walking);
    const json = serializeExploration(walking);
    expect(json).not.toContain('tiles'); expect(json).not.toContain('nodes');
    const restored = deserializeExploration(json);
    expect(restored).toEqual(walking);
    expect(advance(restored)).toEqual(advance(walking));
    const destination = advance(walking);
    expect(deserializeExploration(serializeExploration(destination))).toEqual(destination);
  });

  it('rejects tampered geometry, unknown maps, counters, actors and impossible paths', () => {
    const state = createExploration({ seed: 'SAVE-VALIDATION', characterIds: party });
    const snapshot = JSON.parse(serializeExploration(state));
    const invalid: unknown[] = [
      { ...snapshot, tiles: [] }, { ...snapshot, currentChunkId: '99,99' },
      { ...snapshot, tick: -1 }, { ...snapshot, transitions: 1 }, { ...snapshot, version: 4 }, { ...snapshot, generatorVersion: 1 },
      { ...snapshot, actors: [] }, { ...snapshot, actors: [snapshot.actors[0], snapshot.actors[0]] },
      { ...snapshot, visited: [state.graph.startId, state.graph.startId] },
      { ...snapshot, actors: [{ ...snapshot.actors[0], position: { x: 0, y: 0 } }] },
      { ...snapshot, actors: [{ ...snapshot.actors[0], position: state.chunk.exits[0].position }] },
      { ...snapshot, actors: [{ ...snapshot.actors[0], path: [{ x: 25, y: 25 }] }] },
      { ...snapshot, actors: [{ ...snapshot.actors[0], path: Array.from({ length: 1226 }, () => ({ x: 17, y: 18 })) }] },
    ];
    for (const value of invalid) expect(() => deserializeExploration(JSON.stringify(value))).toThrow();
    expect(() => deserializeExploration('x'.repeat(1_000_001))).toThrow();
  });
});
