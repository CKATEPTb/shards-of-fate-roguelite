import { describe, expect, it } from 'vitest';
import {
  analyzeWorldConnectivity, chunkRegions, createExploration, deserializeExploration,
  findPath, generateChunk, generateWorld, regionAt, requestMove, serializeExploration,
  stepExploration, validateChunk, validateWorld,
} from '@shards/game-core';
import type { Direction, ExplorationState, GridPoint, WorldChunk } from '@shards/shared';

const party = ['guardian', 'priest', 'mage'];

function walk(initial: ExplorationState, target: GridPoint): ExplorationState {
  const command = requestMove(initial, 'guardian', target);
  expect(command.accepted, command.reason).toBe(true);
  let state = command.state;
  for (let steps = 0; steps < 1225 && state.actors.some(actor => actor.path.length); steps++) state = stepExploration(state);
  return state;
}

function goToChunk(initial: ExplorationState, targetId: string): ExplorationState {
  const routes = [[initial.currentChunkId]]; const seen = new Set([initial.currentChunkId]);
  for (let cursor = 0; cursor < routes.length; cursor++) {
    const route = routes[cursor]; const current = route[route.length - 1];
    if (current === targetId) {
      let state = initial;
      for (const target of route.slice(1)) {
        // The last gate is the ordinary transit route; the earlier gate can be a detached entrance.
        const gate = state.chunk.exits.filter(exit => exit.targetNodeId === target).at(-1)!;
        state = walk(state, gate.position);
      }
      return state;
    }
    const node = initial.graph.nodes.find(item => item.id === current)!;
    for (const next of Object.values(node.exits)) if (!seen.has(next)) { seen.add(next); routes.push([...route, next]); }
  }
  throw new Error('Missing world route in fixture');
}

function splitRegionFixture() {
  const initial = createExploration({ seed: 'FIRST-CAMPFIRE', characterIds: party });
  const split = initial.graph.nodes.filter(node => Math.abs(node.x) <= 2 && Math.abs(node.y) <= 2).map(node => generateChunk(initial.graph, node.id))
    .find(chunk => chunkRegions(chunk).sizes.length > 1)!;
  expect(split).toBeDefined();
  const state = goToChunk(initial, split.id);
  const regions = chunkRegions(split);
  const main = regionAt(split, regions, split.spawn);
  const hiddenGate = split.exits.find(gate => regionAt(split, regions, gate.position) !== main)!;
  const mainGate = split.exits.find(gate => gate.targetNodeId === hiddenGate.targetNodeId && regionAt(split, regions, gate.position) === main)!;
  return { state, hiddenGate, mainGate };
}

/** Compact fault-injection fixture retains all four long seasonal spokes and central branches. */
function focusedGraph(seed: string) {
  const full = generateWorld(seed);
  const nodes = full.nodes.filter(node => node.x === 0 || node.y === 0 || Math.abs(node.x) <= 2 && Math.abs(node.y) <= 2)
    .map(node => ({ ...node, exits: {} as Partial<Record<Direction, string>> }));
  const ids = new Set(nodes.map(node => node.id));
  const deltas = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
  for (const node of nodes) for (const [direction, [dx, dy]] of Object.entries(deltas)) {
    const id = `${node.x + dx},${node.y + dy}`;
    if (ids.has(id)) node.exits[direction as Direction] = id;
  }
  return { ...full, nodes, altarNodeId: `0,${full.radius}` };
}

describe('paired gates and disconnected local regions', () => {
  it('requires a neighboring-chunk detour, enters at the exact paired gate and transfers the entire party', () => {
    const { state, hiddenGate, mainGate } = splitRegionFixture();
    const rejected = requestMove(state, 'guardian', hiddenGate.position);
    expect(rejected.accepted).toBe(false);
    expect(rejected.reason).toContain('Нужен другой вход');
    expect(rejected.state).toBe(state);
    expect(findPath(state.chunk, state.actors[0].position, hiddenGate.position)).toEqual([]);

    const outside = walk(state, mainGate.position);
    expect(outside.currentChunkId).toBe(hiddenGate.targetNodeId);
    const returnGate = outside.chunk.exits.find(exit => exit.id === hiddenGate.returnGateId)!;
    const inside = walk(outside, returnGate.position);
    expect(inside.currentChunkId).toBe(state.currentChunkId);
    expect(inside.transitions).toBe(state.transitions + 2);
    expect(inside.actors.map(actor => actor.id)).toEqual(party);
    const regions = chunkRegions(inside.chunk);
    const expectedRegion = regionAt(inside.chunk, regions, hiddenGate.position);
    for (const actor of inside.actors) {
      expect(regionAt(inside.chunk, regions, actor.position)).toBe(expectedRegion);
      expect(actor.path).toEqual([]);
    }
    const leader = inside.actors[0].position;
    expect(Math.abs(leader.x - hiddenGate.position.x) + Math.abs(leader.y - hiddenGate.position.y)).toBe(1);
    expect(requestMove(inside, 'mage', inside.chunk.spawn).reason).toContain('Нужен другой вход');
    expect(stepExploration(inside)).toBe(inside);

    const backOutside = walk(inside, hiddenGate.position);
    const ordinaryReturn = backOutside.chunk.exits.find(exit => exit.id === mainGate.returnGateId)!;
    const mainAgain = walk(backOutside, ordinaryReturn.position);
    expect(regionAt(mainAgain.chunk, chunkRegions(mainAgain.chunk), mainAgain.actors[0].position))
      .toBe(regionAt(mainAgain.chunk, chunkRegions(mainAgain.chunk), mainAgain.chunk.spawn));
  });

  it('round-trips a party inside a detached region and rejects splitting saved heroes across regions', () => {
    const { state, hiddenGate, mainGate } = splitRegionFixture();
    const outside = walk(state, mainGate.position);
    const inside = walk(outside, outside.chunk.exits.find(exit => exit.id === hiddenGate.returnGateId)!.position);
    const json = serializeExploration(inside);
    expect(deserializeExploration(json)).toEqual(inside);
    const tampered = JSON.parse(json);
    tampered.actors[1].position = inside.chunk.spawn;
    expect(() => deserializeExploration(JSON.stringify(tampered))).toThrow('different disconnected regions');
  });

  it('rejects an old save before reinterpreting its coordinates with the new generator', () => {
    const state = createExploration({ seed: 'OLD-SAVE', characterIds: party });
    const snapshot = JSON.parse(serializeExploration(state));
    snapshot.version = 1; delete snapshot.generatorVersion;
    expect(() => deserializeExploration(JSON.stringify(snapshot))).toThrow('старым генератором');
  });
});

describe('independent checks of generated terrain', () => {
  it('finds globally stranded regions even when the world graph and each local chunk validate', () => {
    const graph = focusedGraph('STRANDED-START');
    const chunks = new Map(graph.nodes.map(node => [node.id, generateChunk(graph, node.id)]));
    const start = chunks.get(graph.startId)!;
    start.structures = [];
    const exits = new Set(start.exits.map(exit => exit.position.y * start.size + exit.position.x));
    start.tiles = start.tiles.map((_, index) => {
      const x = index % start.size; const y = Math.floor(index / start.size);
      const border = x === 0 || y === 0 || x === start.size - 1 || y === start.size - 1;
      const ring = Math.max(Math.abs(x - start.spawn.x), Math.abs(y - start.spawn.y)) === 2;
      const walkable = (!border && !ring) || exits.has(index);
      return { terrain: walkable ? 'grass' : 'rock', walkable, movementCost: 1 };
    });
    for (const camp of start.pois.filter(poi => poi.kind === 'campfire')) start.tiles[camp.position.y * start.size + camp.position.x].walkable = false;
    expect(validateWorld(graph).valid).toBe(true);
    expect(validateChunk(start)).toEqual({ valid: true, errors: [] });
    const analysis = analyzeWorldConnectivity(graph, chunks);
    expect(analysis.valid).toBe(false);
    expect(analysis.errors).toContain('Unreachable world regions');
    expect(analysis.errors).toContain('Fewer than three physically independent routes to winter');
    expect(analysis.reachableRegions).toBe(1);
    expect(analysis.independentWinterRoutes).toBe(0);
  });

  it('rejects mismatched reciprocal identities even when both gate tiles are locally reachable', () => {
    const graph = focusedGraph('WRONG-PAIR');
    const chunks = new Map(graph.nodes.map(node => [node.id, generateChunk(graph, node.id)]));
    const start = chunks.get(graph.startId)!; const exit = start.exits[0];
    const target = chunks.get(exit.targetNodeId)!;
    exit.returnGateId = target.exits.find(gate => gate.targetNodeId === start.id && gate.id !== exit.returnGateId)!.id;
    expect(validateChunk(start).valid).toBe(true);
    expect(validateChunk(target).valid).toBe(true);
    expect(analyzeWorldConnectivity(graph, chunks).errors.some(error => error.startsWith('Unpaired or misaligned gate'))).toBe(true);
  });

  it('has deterministic dense terrain with different maze layouts, gate counts and detached regions', () => {
    const signatures = new Set<string>(); const gateCounts = new Set<number>(); let detached = 0;
    for (let seed = 0; seed < 12; seed++) {
      const graph = generateWorld(`maze-variety:${seed}`);
      const chunks: WorldChunk[] = graph.nodes.slice(0, 5).map(node => generateChunk(graph, node.id));
      for (const chunk of chunks) {
        const blocked = chunk.tiles.filter(tile => !tile.walkable).length / chunk.tiles.length;
        expect(blocked).toBeGreaterThan(0.3);
        expect(blocked).toBeLessThan(0.75);
        signatures.add(chunk.tiles.map(tile => tile.walkable ? '1' : '0').join(''));
        for (const direction of new Set(chunk.exits.map(exit => exit.direction))) gateCounts.add(chunk.exits.filter(exit => exit.direction === direction).length);
        detached += chunkRegions(chunk).sizes.length - 1;
      }
    }
    expect(signatures.size).toBe(60);
    expect([...gateCounts].sort()).toEqual([2, 3]);
    expect(detached).toBeGreaterThan(0);
  });
});
