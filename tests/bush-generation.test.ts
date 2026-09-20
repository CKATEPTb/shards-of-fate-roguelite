import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateChunk, generateWorld, validateChunk } from '@shards/game-core';
import type { GridPoint, Season, WorldChunk } from '@shards/shared';
import * as bushes from '../packages/game-core/src/world/bushes';
import { chunkRegions } from '../packages/game-core/src/world/regions';
import { withinStructure } from '../packages/game-core/src/world/structures';

const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const near = (a: GridPoint, b: GridPoint, radius: number) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= radius;
const bushIndices = (chunk: WorldChunk) => chunk.tiles.flatMap((tile, index) => tile.terrain === 'bush' ? [index] : []);

afterEach(() => vi.restoreAllMocks());

describe('walkable bush patches', () => {
  it('generates reproducible undergrowth in every season without filling clearings or entrances', () => {
    for (const seed of ['FIRST-CAMPFIRE', 'BUSHES-COVERAGE']) {
      const graph = generateWorld(seed);
      for (const season of seasons) {
        const nodes = graph.nodes.filter(node => node.season === season).slice(0, 6);
        let bushesCount = 0; let walkableCount = 0;
        for (const node of nodes) {
          const chunk = generateChunk(graph, node.id);
          expect(validateChunk(chunk)).toEqual({ valid: true, errors: [] });
          walkableCount += chunk.tiles.filter(tile => tile.walkable).length;
          const indices = bushIndices(chunk);
          bushesCount += indices.length;
          for (const index of indices) {
            const point = { x: index % chunk.size, y: Math.floor(index / chunk.size) };
            expect(chunk.tiles[index]).toEqual({ terrain: 'bush', walkable: true, movementCost: 2 });
            expect(near(point, chunk.spawn, 2)).toBe(false);
            expect(chunk.pois.some(poi => near(point, poi.position, 2))).toBe(false);
            expect(chunk.exits.some(exit => near(point, exit.position, 3))).toBe(false);
            expect(chunk.structures.some(structure => withinStructure(point, structure, 1))).toBe(false);
          }
        }
        // Bushes should be encountered naturally, while leaving most traversable ground open.
        expect(bushesCount / walkableCount).toBeGreaterThan(0.05);
        expect(bushesCount / walkableCount).toBeLessThan(0.25);
        const first = generateChunk(graph, nodes[0].id);
        for (const node of nodes.slice(1).reverse()) generateChunk(graph, node.id);
        expect(generateChunk(graph, nodes[0].id)).toEqual(first);
      }
    }
  });

  it('preserves existing collision cells, disconnected regions and structure geometry', () => {
    const graph = generateWorld('FIRST-CAMPFIRE', { structureVersion: 1 });
    const ids = ['0,0', '2,-2', '11,0', '23,0', '38,0'];
    const withBushes = ids.map(id => generateChunk(graph, id));
    const addBushes = vi.spyOn(bushes, 'applyBushes').mockImplementation(() => {});
    const beforeBushes = ids.map(id => generateChunk(graph, id));
    addBushes.mockRestore();

    for (const [index, before] of beforeBushes.entries()) {
      const after = withBushes[index];
      expect(bushIndices(after).length).toBeGreaterThan(0);
      expect(chunkRegions(after)).toEqual(chunkRegions(before));
      expect({ ...after, tiles: [] }).toEqual({ ...before, tiles: [] });
      for (const [tileIndex, tile] of after.tiles.entries()) {
        const original = before.tiles[tileIndex];
        if (tile.terrain === 'bush') {
          expect(['grass', 'snow']).toContain(original.terrain);
          expect(original.walkable).toBe(true);
        } else expect(tile).toEqual(original);
      }
    }
    // This fixture has an entrance-only area that must not merge with the central region.
    expect(chunkRegions(withBushes[1]).sizes.length).toBeGreaterThan(1);
  });
});
