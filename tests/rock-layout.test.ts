import { describe, expect, it } from 'vitest';
import type { WorldChunk } from '@shards/shared';
import { generateChunk, generateWorld } from '@shards/game-core';
import { planRockLayout, type RockFormation } from '../apps/client/src/world/rockLayout';
import { rockShape } from '../apps/client/src/world/rockArt';

function emptyChunk(size = 16): WorldChunk {
  return { id: '3,-7', size, season: 'spring', tiles: Array.from({ length: size * size }, () => ({ terrain: 'grass', walkable: true, movementCost: 1 })),
    spawn: { x: 0, y: 0 }, exits: [], pois: [], structures: [] };
}

function addRock(chunk: WorldChunk, x: number, y: number, width: number, height: number): void {
  for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) {
    chunk.tiles[(y + dy) * chunk.size + x + dx] = { terrain: 'rock', walkable: false, movementCost: 1 };
  }
}

function assertCoverage(chunk: WorldChunk, formations: RockFormation[]): void {
  const coverage = new Uint8Array(chunk.tiles.length);
  for (const formation of formations) {
    expect(formation.variant).toBeGreaterThanOrEqual(0);
    expect(formation.variant).toBeLessThan(4);
    expect(formation.origin.x + formation.width).toBeLessThanOrEqual(chunk.size);
    expect(formation.origin.y + formation.height).toBeLessThanOrEqual(chunk.size);
    for (let y = 0; y < formation.height; y++) for (let x = 0; x < formation.width; x++) {
      coverage[(formation.origin.y + y) * chunk.size + formation.origin.x + x]++;
    }
  }
  expect(Array.from(coverage)).toEqual(chunk.tiles.map(tile => Number(tile.terrain === 'rock' && !tile.walkable)));
  expect(new Set(formations.map(formation => formation.id)).size).toBe(formations.length);
}

describe('rock formations use existing collision footprints', () => {
  it('packs all supported isolated footprints into one coherent formation each', () => {
    const chunk = emptyChunk();
    addRock(chunk, 0, 0, 3, 3);
    addRock(chunk, 5, 0, 3, 2);
    addRock(chunk, 10, 0, 2, 3);
    addRock(chunk, 0, 6, 2, 2);
    addRock(chunk, 5, 6, 1, 1);
    const formations = planRockLayout(chunk);
    expect(formations.map(({ origin, width, height }) => [origin.x, origin.y, width, height])).toEqual([
      [0, 0, 3, 3], [5, 0, 3, 2], [10, 0, 2, 3], [0, 6, 2, 2], [5, 6, 1, 1],
    ]);
    assertCoverage(chunk, formations);
  });

  it('never closes real passages, merges across non-rock obstacles, or mutates simulation tiles', () => {
    const chunk = emptyChunk(8);
    addRock(chunk, 0, 0, 8, 8);
    for (let y = 0; y < 8; y++) chunk.tiles[y * 8 + 3] = { terrain: 'path', walkable: true, movementCost: 1 };
    for (const [index, terrain] of [[1, 'tree'], [8, 'water'], [9, 'wall']] as const) chunk.tiles[index] = { terrain, walkable: false, movementCost: 1 };
    chunk.tiles[63].walkable = true;
    const before = structuredClone(chunk);
    const first = planRockLayout(chunk);
    assertCoverage(chunk, first);
    expect(first.every(formation => formation.origin.x > 3 || formation.origin.x + formation.width <= 3)).toBe(true);
    expect(chunk).toEqual(before);
    expect(planRockLayout(structuredClone(chunk))).toEqual(first);
  });

  it('covers representative real chunks in every season without changing their walkability', () => {
    const graph = generateWorld('FIRST-CAMPFIRE');
    for (const id of ['0,0', '16,0', '30,0', '43,0']) {
      const chunk = generateChunk(graph, id);
      const before = structuredClone(chunk);
      assertCoverage(chunk, planRockLayout(chunk));
      expect(chunk).toEqual(before);
    }
  });
});

describe('rock image geometry matches ground footprints', () => {
  it('keeps low singles within their tile, with a five-pixel minimum horizontal gap', () => {
    for (let variant = 0; variant < 4; variant++) {
      const shape = rockShape({ width: 1, height: 1, variant });
      expect(shape.width).toBeGreaterThanOrEqual(25);
      expect(shape.width).toBeLessThanOrEqual(27);
      expect(shape.height).toBeLessThanOrEqual(29);
      expect(shape.elevation).toBe(0);
      expect(32 - shape.width).toBeGreaterThanOrEqual(5);
      expect(shape.silhouette.some(band => band.x <= shape.width / 2 && band.x + band.width >= shape.width / 2
        && band.y <= shape.height / 2 && band.y + band.height >= shape.height / 2)).toBe(true);
    }
  });

  it.each([[2, 2], [2, 3], [3, 2], [3, 3]] as const)('keeps a %i × %i outcrop low and rounded while covering every blocked cell center', (width, height) => {
    for (let variant = 0; variant < 4; variant++) {
      const shape = rockShape({ width, height, variant });
      expect(shape.width).toBe(width * 32 - 4);
      expect(shape.height - shape.elevation).toBe(height * 32 - 4);
      expect(shape.elevation).toBeGreaterThanOrEqual(6);
      expect(shape.elevation).toBeLessThanOrEqual(14);
      expect(shape.elevation).toBeLessThan(Math.min(width, height) * 32 / 4);
      expect(shape.silhouette[0].width).toBeLessThan(shape.width * 0.7);
      expect(shape.silhouette.at(-1)!.width).toBeLessThan(shape.width * 0.7);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const localX = (x + 0.5) * 32 - 2;
        const localY = (y + 0.5) * 32 + shape.elevation - 2;
        expect(shape.silhouette.some(band => localX >= band.x && localX < band.x + band.width
          && localY >= band.y && localY < band.y + band.height)).toBe(true);
      }
      // Below the irregular crest, the body has no arch-shaped void or repeated stone gaps.
      for (let y = shape.elevation; y < shape.height; y++) {
        const bands = shape.silhouette.filter(band => y >= band.y && y < band.y + band.height);
        expect(bands).toHaveLength(1);
        expect(bands[0].x).toBeGreaterThanOrEqual(0);
        expect(bands[0].x + bands[0].width).toBeLessThanOrEqual(shape.width);
      }
    }
  });
});
