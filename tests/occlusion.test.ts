import { describe, expect, it } from 'vitest';
import { OcclusionIndex, occlusionAlpha, type Occluder } from '../apps/client/src/world/occlusion';
import { WalkableGround } from '../apps/client/src/world/walkable-occlusion';

function ground(blocked: [number, number][] = []): WalkableGround {
  const size = 32;
  const tiles = Array.from({ length: size * size }, () => ({ terrain: 'grass' as const, walkable: true, movementCost: 1 }));
  for (const [x, y] of blocked) tiles[y * size + x].walkable = false;
  return new WalkableGround({ size, tiles });
}

const tree = (id: number, x: number, y: number): Occluder => ({
  id, base: { x, y },
  bounds: { x: x - 30, y: y - 90, width: 60, height: 90 },
  silhouettes: [
    { x: x - 25, y: y - 87, width: 50, height: 55 },
    { x: x - 5, y: y - 32, width: 10, height: 32 },
  ],
});

describe('environment occlusion', () => {
  it('finds a tall foreground crown from its visual bounds, several cells above its base', () => {
    const index = new OcclusionIndex([tree(1, 160, 192)], ground(), 32);
    expect(index.find([{ point: { x: 165, y: 122 }, width: 8, height: 8, ground: true }])).toEqual(new Set([1]));
  });

  it('reveals every overlapping foreground prop for every hero, without fading trees behind them', () => {
    const index = new OcclusionIndex([tree(1, 100, 150), tree(2, 116, 163), tree(3, 240, 240), tree(4, 100, 100)], ground());
    const visible = index.find([
      { point: { x: 107, y: 119 }, width: 25, height: 43 },
      { point: { x: 240, y: 207 }, width: 25, height: 43 },
    ]);
    expect(visible).toEqual(new Set([1, 2, 3]));
  });

  it('excludes empty texture corners, unrelated distant props and nonoverlapping probes', () => {
    const index = new OcclusionIndex([tree(1, 100, 160), tree(2, 500, 550)], ground());
    expect(index.find([{ point: { x: 78, y: 155 }, width: 3, height: 3, ground: true }])).toEqual(new Set());
    expect(index.find([{ point: { x: 800, y: 900 }, width: 25, height: 43 }])).toEqual(new Set());
  });

  it('keeps ground routes and pointer probes visible even when a character depth rule would reject the prop', () => {
    const index = new OcclusionIndex([tree(1, 100, 150)], ground());
    const probe = { point: { x: 100, y: 153 }, width: 8, height: 8 };
    expect(index.find([probe])).toEqual(new Set());
    expect(index.find([{ ...probe, ground: true }])).toEqual(new Set([1]));
  });

  it('restores opacity after probes leave and fades consistently at different frame rates', () => {
    const at30 = Array.from({ length: 3 }).reduce<number>(alpha => occlusionAlpha(alpha, true, 100 / 3, false), 1);
    const at60 = Array.from({ length: 6 }).reduce<number>(alpha => occlusionAlpha(alpha, true, 100 / 6, false), 1);
    expect(at30).toBeCloseTo(at60, 10);
    expect(at30).toBeGreaterThan(0.27);
    expect(at30).toBeLessThan(1);
    expect(occlusionAlpha(at30, false, 100, false)).toBeGreaterThan(at30);
    expect(occlusionAlpha(at30, false, 1000, false)).toBe(1);
    expect(occlusionAlpha(1, true, 0, false)).toBe(1);
  });

  it('applies reduced-motion visibility changes immediately in both directions', () => {
    expect(occlusionAlpha(1, true, 16, true)).toBe(0.27);
    expect(occlusionAlpha(0.27, false, 16, true)).toBe(1);
  });

  it('does not reveal a dense blocked patch just because its crown covers the cursor or route', () => {
    const forest = [tree(1, 144, 185), tree(2, 164, 190)];
    const index = new OcclusionIndex(forest, ground([[4, 3]]));
    expect(index.find([{ point: { x: 144, y: 120.5 }, groundPoint: { x: 144, y: 120 }, width: 1, height: 1, ground: true }])).toEqual(new Set());
    expect(index.find([{ point: { x: 144, y: 112 }, width: 7, height: 7, ground: true }])).toEqual(new Set());
    expect(index.find([{ point: { x: 166, y: 120 }, width: 1, height: 1, ground: true }])).toEqual(new Set([1, 2]));
  });

  it('clips a broad ground marker at its walkable tile border instead of fading an adjacent blocked wall', () => {
    const wall: Occluder = {
      id: 1, base: { x: 144, y: 158 },
      bounds: { x: 128, y: 100, width: 32, height: 58 },
      silhouettes: [{ x: 128, y: 100, width: 32, height: 58 }],
    };
    const index = new OcclusionIndex([wall], ground([[4, 3]]));
    expect(index.find([{ point: { x: 127.9, y: 124 }, groundPoint: { x: 127.9, y: 120 }, width: 9, height: 9, ground: true }])).toEqual(new Set());
    expect(index.find([{ point: { x: 128.1, y: 120 }, width: 1, height: 1, ground: true }])).toEqual(new Set());
    const passableBehindWall = new OcclusionIndex([wall], ground());
    expect(passableBehindWall.find([{ point: { x: 130, y: 120 }, width: 1, height: 1, ground: true }])).toEqual(new Set([1]));
  });

  it('tests the real cursor position before its visual offset near a blocked row', () => {
    const prop = tree(1, 112, 200);
    const index = new OcclusionIndex([prop], ground([[3, 3]]));
    expect(index.find([{ point: { x: 112, y: 132 }, groundPoint: { x: 112, y: 127.9 }, width: 9, height: 9, ground: true }])).toEqual(new Set());
  });

  it('keeps interpolated heroes visible across two free cells while preserving their actual foot depth', () => {
    const prop = tree(1, 128, 184);
    // The sprite's head projects over a blocked northern tile; its feet are free.
    const index = new OcclusionIndex([prop], ground([[3, 3], [4, 3]]));
    for (const x of [127.99999, 128, 128.00001]) {
      expect(index.find([{ point: { x, y: 144 }, width: 25, height: 43 }])).toEqual(new Set([1]));
    }
    expect(index.find([{ point: { x: 128, y: 185 }, width: 25, height: 43 }])).toEqual(new Set());
    const blockedFeet = new OcclusionIndex([prop], ground([[3, 4]]));
    expect(blockedFeet.find([{ point: { x: 127.9, y: 144 }, width: 25, height: 43 }])).toEqual(new Set());
  });

  it('keeps low rocks opaque while allowing an overlapping high formation to reveal free ground', () => {
    const low = { ...tree(1, 144, 185), revealable: false };
    const high = { ...tree(2, 144, 185), revealable: true };
    const index = new OcclusionIndex([low, high], ground());
    expect(index.find([{ point: { x: 144, y: 120 }, width: 7, height: 7, ground: true }])).toEqual(new Set([2]));
    expect(index.find([{ point: { x: 144, y: 144 }, width: 25, height: 43 }])).toEqual(new Set([2]));
  });

  it('fades foliage around interpolated mobs without opening houses or low rocks', () => {
    const geometry = {
      id: 'house', interior: { x: 128, y: 128, width: 32, height: 32 }, entrances: [],
      roofBase: { x: 144, y: 185 }, roofSilhouettes: [{ x: 120, y: 90, width: 64, height: 75 }],
    };
    const roof: Occluder = { ...tree(3, 144, 185), house: { geometry, part: 'roof' } };
    const wall: Occluder = { ...tree(4, 144, 185), house: { geometry, part: 'wall' } };
    const index = new OcclusionIndex([
      tree(1, 144, 185), { ...tree(2, 144, 185), revealable: false }, roof, wall,
      tree(5, 144, 120),
    ], ground());
    for (const x of [143.5, 144, 144.5]) {
      const probe = { point: { x, y: 144 }, width: 32 * 1.65, height: 28 * 1.65 };
      expect(index.find([{ ...probe, revealHouses: false }])).toEqual(new Set([1]));
      // The same occupied room still opens for an actual hero.
      expect(index.find([probe])).toEqual(new Set([1, 3, 4]));
    }
    const blocked = new OcclusionIndex([tree(1, 144, 185)], ground([[4, 4]]));
    expect(blocked.find([{ point: { x: 144, y: 144 }, width: 52.8, height: 46.2, revealHouses: false }])).toEqual(new Set());
  });

  it('rejects invalid or outside ground positions before spatial queries', () => {
    const index = new OcclusionIndex([tree(1, 16, 80)], ground());
    for (const point of [{ x: -1, y: 16 }, { x: 1024, y: 16 }, { x: 16, y: Infinity }, { x: NaN, y: 16 }]) {
      expect(index.find([{ point, width: 25, height: 43 }])).toEqual(new Set());
    }
  });
});
