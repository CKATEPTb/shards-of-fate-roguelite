import { describe, expect, it } from 'vitest';
import type { WorldChunk } from '@shards/shared';
import { isPuddle, WATER_PIXEL_SIZE, waterGeometry, waterPixel } from '../apps/client/src/world/water-geometry';

function chunk(rows: string[]): WorldChunk {
  return { id: 'water-geometry', size: rows.length, season: 'spring', spawn: { x: 0, y: 0 }, exits: [], pois: [], structures: [],
    tiles: rows.flatMap(row => [...row].map(cell => ({ terrain: cell === '#' ? 'water' : 'path', walkable: cell !== '#', movementCost: 1 }))) };
}

describe('connected organic water geometry', () => {
  it.each([
    ['.....', '.....', '..#..', '.....', '.....'],
    ['......', '.####.', '.####.', '.####.', '......', '......'],
    ['......', '.#..#.', '.#..#.', '.####.', '......', '......'],
    ['.....', '##...', '.###.', '...##', '.....'],
  ])('preserves every cell centre and joins every cardinal water neighbour without gaps: %j', (...rows) => {
    const state = chunk(rows), before = JSON.stringify(state), geometry = waterGeometry(state);
    for (let y = 0; y < state.size; y++) for (let x = 0; x < state.size; x++) {
      const water = rows[y][x] === '#';
      expect(waterPixel(geometry, x * 32 + 16, y * 32 + 16), `centre ${x},${y}`).toBe(Number(water));
      if (!water) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (rows[y + dy]?.[x + dx] !== '#') continue;
        for (let step = 0; step <= 32; step += WATER_PIXEL_SIZE) {
          expect(waterPixel(geometry, x * 32 + 16 + dx * step, y * 32 + 16 + dy * step), `join ${x},${y}:${dx},${dy}:${step}`).toBe(1);
        }
      }
    }
    expect(JSON.stringify(state)).toBe(before);
  });

  it('keeps a one-cell dry crossing open between two separate ponds', () => {
    const state = chunk(['.......', '.##.##.', '.##.##.', '.##.##.', '.##.##.', '.##.##.', '.......']);
    const geometry = waterGeometry(state);
    expect(geometry.patches).toHaveLength(2);
    for (let y = 0; y < 7 * 32; y += WATER_PIXEL_SIZE) expect(waterPixel(geometry, 3 * 32 + 16, y)).toBe(0);
  });

  it('rounds square corners and breaks a long straight shore into an irregular connected contour', () => {
    const state = chunk(['.......', '.#####.', '.#####.', '.#####.', '.#####.', '.#####.', '.......']);
    const geometry = waterGeometry(state);
    expect(waterPixel(geometry, 33, 33)).toBe(0);
    expect(waterPixel(geometry, 48, 48)).toBe(1);
    const shoreHeights = new Set<number>();
    for (let x = 64; x < 160; x += WATER_PIXEL_SIZE) {
      for (let y = 20; y < 64; y += WATER_PIXEL_SIZE) if (waterPixel(geometry, x, y)) { shoreHeights.add(y); break; }
    }
    expect(shoreHeights.size).toBeGreaterThanOrEqual(3);
    expect(geometry.patches).toHaveLength(1);
  });

  it('widely rounds the outer bank of a four-by-three lake while retaining its corner cell centres', () => {
    const geometry = waterGeometry(chunk(['.......', '.####..', '.####..', '.####..', '.......', '.......', '.......']));
    let first = 0;
    while (first < 7 * 32 && !waterPixel(geometry, first, 33)) first += WATER_PIXEL_SIZE;
    expect(first - 32).toBeGreaterThanOrEqual(24);
    for (const x of [48, 144]) for (const y of [48, 112]) expect(waterPixel(geometry, x, y)).toBe(1);
  });

  it('uses exactly the same painted pixels in compact ripple masks, including inner holes', () => {
    const geometry = waterGeometry(chunk(['.......', '.#####.', '.#...#.', '.#...#.', '.#...#.', '.#####.', '.......']));
    const reconstructed = new Uint8Array(geometry.mask.length);
    for (const patch of geometry.patches) {
      expect(patch.bounds.width).toBeLessThan(7 * 32);
      expect(patch.bounds.height).toBeLessThan(7 * 32);
      for (const span of patch.spans) for (let x = span.x; x < span.x + span.width; x += WATER_PIXEL_SIZE) {
        expect(waterPixel(geometry, x, span.y)).toBeGreaterThan(0);
        reconstructed[span.y / WATER_PIXEL_SIZE * geometry.size + x / WATER_PIXEL_SIZE]++;
      }
    }
    expect(reconstructed).toEqual(geometry.mask);
    expect(waterPixel(geometry, 3 * 32 + 16, 3 * 32 + 16)).toBe(0);
  });

  it('caches geometry per immutable chunk and reproduces the mask after reloading the same data', () => {
    const state = chunk(['.....', '.###.', '.###.', '.....', '.....']);
    expect(waterGeometry(state)).toBe(waterGeometry(state));
    expect(waterGeometry(structuredClone(state)).mask).toEqual(waterGeometry(state).mask);
  });

  it('keeps structure floors dry in the shared mask, even over a decorative puddle', () => {
    const state = chunk(Array.from({ length: 8 }, () => '........'));
    state.tiles.forEach(tile => { tile.terrain = 'grass'; });
    const index = state.tiles.findIndex((tile, index) => isPuddle(tile, index % state.size, Math.floor(index / state.size)));
    expect(index).toBeGreaterThanOrEqual(0);
    const origin = { x: index % state.size, y: Math.floor(index / state.size) };
    const original = waterGeometry(state);
    expect(original.puddles.some(span => Math.floor(span.x / 32) === origin.x && Math.floor(span.y / 32) === origin.y)).toBe(true);
    const covered = structuredClone(state);
    covered.structures.push({ id: 'floor', kind: 'ruin', origin, width: 1, height: 1, blockedCells: [], approach: origin, variant: 0 });
    const geometry = waterGeometry(covered);
    for (let y = origin.y * 32; y < (origin.y + 1) * 32; y += WATER_PIXEL_SIZE) {
      for (let x = origin.x * 32; x < (origin.x + 1) * 32; x += WATER_PIXEL_SIZE) expect(waterPixel(geometry, x, y)).toBe(0);
    }
  });
});
