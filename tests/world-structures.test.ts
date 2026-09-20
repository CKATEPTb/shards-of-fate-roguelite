import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExpedition, deserializeExpedition, findPath, generateChunk, generateWorld, serializeExpedition, validateChunk } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import * as chunkModule from '../packages/game-core/src/world/chunk';
import { planChunk } from '../packages/game-core/src/world/plan';
import { withinStructure } from '../packages/game-core/src/world/structures';

afterEach(() => vi.restoreAllMocks());

describe('inhabited chunk layouts', () => {
  it('keeps the legacy first village, camp and encounter playable around physical building walls', () => {
    const graph = generateWorld('FIRST-CAMPFIRE', { structureVersion: 1 });
    const chunk = generateChunk(graph, graph.startId);
    expect(chunk.structures.map(structure => structure.kind).sort()).toEqual(['house', 'house', 'well']);
    expect(chunk.tiles[18 * 35 + 19].walkable).toBe(true);
    expect(chunk.tiles[19 * 35 + 17].walkable).toBe(true);
    expect(chunk.pois.find(poi => poi.kind === 'encounter')!.position).toEqual({ x: 23, y: 17 });
    for (const structure of chunk.structures) {
      expect(findPath(chunk, chunk.spawn, structure.approach).length).toBeGreaterThan(0);
      for (const point of structure.blockedCells) {
        expect(chunk.tiles[point.y * chunk.size + point.x]).toEqual({ terrain: 'wall', walkable: false, movementCost: 1 });
        expect(withinStructure(point, structure)).toBe(true);
      }
      for (let y = structure.origin.y; y < structure.origin.y + structure.height; y++) for (let x = structure.origin.x; x < structure.origin.x + structure.width; x++) {
        if (chunk.tiles[y * chunk.size + x].walkable) expect(findPath(chunk, structure.approach, { x, y }).length).toBeGreaterThan(0);
      }
    }
  });

  it('uses the exact metadata plan for both lightweight content checks and materialized geometry', () => {
    const graph = generateWorld('CONTENT-PLAN');
    const kinds = new Set<string>();
    for (const node of graph.nodes.slice(0, 32)) {
      const plan = planChunk(graph, node);
      const chunk = generateChunk(graph, node.id);
      expect(chunk.pois).toEqual(plan.pois);
      expect(chunk.structures).toEqual(plan.structures);
      expect(chunk.exits).toEqual(plan.exits);
      expect(validateChunk(chunk).errors).toEqual([]);
      chunk.structures.forEach(structure => kinds.add(structure.kind));
    }
    expect([...kinds].sort()).toEqual(['house', 'ruin', 'well']);
  });

  it('rejects decorative footprints that disagree with physical terrain', () => {
    const graph = generateWorld('FIRST-CAMPFIRE');
    const chunk = generateChunk(graph, graph.startId);
    const point = chunk.structures[0].blockedCells[0];
    chunk.tiles[point.y * chunk.size + point.x] = { terrain: 'grass', walkable: true, movementCost: 1 };
    expect(validateChunk(chunk).errors).toContain('Invalid structure footprint');
  });

  it('restores a large-world save by materializing only the current chunk', () => {
    const state = createExpedition('FIRST-CAMPFIRE', ['guardian', 'priest', 'mage'], gameContent);
    const snapshot = serializeExpedition(state, gameContent);
    const generate = vi.spyOn(chunkModule, 'generateChunk');
    const restored = deserializeExpedition(snapshot, gameContent);
    expect(restored).toEqual(state);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(snapshot.length).toBeLessThan(5000);
    expect(snapshot).not.toContain('blockedCells');
  });
});
