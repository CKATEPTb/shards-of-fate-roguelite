import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import type { GridPoint, WorldStructure } from '@shards/shared';
import { generateChunk, generateWorld } from '@shards/game-core';
import { OcclusionIndex, occlusionAlpha, type Occluder, type OcclusionProbe } from '../apps/client/src/world/occlusion';
import { WalkableGround } from '../apps/client/src/world/walkable-occlusion';
import { createStructures } from '../apps/client/src/world/structures';
import { TILE_SIZE, tileCenter } from '../apps/client/src/world/projection';
import { entersHouse, houseVisibility } from '../apps/client/src/world/house-visibility';

function walkableGround() {
  const size = 32;
  return new WalkableGround({ size, tiles: Array.from({ length: size * size }, () => ({ terrain: 'grass' as const, walkable: true, movementCost: 1 })) });
}

// A 5×4 house at tile (3,4): the inner 3×2 floor keeps the roof open.
// Only its actual doorway can reveal the roof before the feet enter that floor.
function roof(id = 1, offsetX = 0): Occluder {
  const bounds = { x: 88 + offsetX, y: 145, width: 176, height: 77 };
  return {
    id, base: { x: 176 + offsetX, y: 254 }, bounds, silhouettes: [bounds],
    house: { part: 'roof', geometry: {
      id: `house-${id}`, interior: { x: 128 + offsetX, y: 160, width: 96, height: 64 },
      entrances: [{ x: 160 + offsetX, y: 224, width: 32, height: 32 }],
      roofBase: { x: 176 + offsetX, y: 254 }, roofSilhouettes: [bounds],
    } },
  };
}

const hero = (point: GridPoint): OcclusionProbe => ({ point, width: 25, height: 43 });
const marker = (point: GridPoint): OcclusionProbe => ({ point, width: 9, height: 9, ground: true });
const inside = { x: 176, y: 192 };
const doorway = { x: 176, y: 240 };
const outside = { x: 176, y: 290 };

describe('house visibility follows real entrances and occupied interiors', () => {
  it('keeps the roof opaque for a cursor or planned route through the empty room', () => {
    const index = new OcclusionIndex([roof()], walkableGround());
    const pointer = { ...marker({ x: 176, y: 196 }), groundPoint: inside };
    const route = [144, 176, 208].map(x => marker({ x, y: 176 }));
    expect(index.find([pointer])).toEqual(new Set());
    expect(index.find(route)).toEqual(new Set());
    expect(index.find([marker(doorway)])).toEqual(new Set());
    expect(index.find([hero(outside), pointer, ...route])).toEqual(new Set());
  });

  it.each([
    { name: 'north of the room beneath the roof silhouette', point: { x: 176, y: 150 } },
    { name: 'beside the room with the sprite overlapping its floor', point: { x: 127.9, y: 192 } },
    { name: 'beside the doorway through a closed facade', point: { x: 150, y: 240 } },
  ])('keeps the whole roof opaque for a hero $name', ({ point }) => {
    const index = new OcclusionIndex([roof()], walkableGround());
    expect(index.find([hero(point)])).toEqual(new Set());
  });

  it('reveals a hero at the actual doorway with only the head behind the roof', () => {
    const index = new OcclusionIndex([roof()], walkableGround());
    expect(index.find([hero(doorway)])).toEqual(new Set([1]));
    expect(index.find([hero({ ...doorway, x: 159.9999 })])).toEqual(new Set());
    expect(index.find([hero({ ...doorway, x: 160 })])).toEqual(new Set([1]));
    expect(index.find([hero({ ...doorway, x: 191.9999 })])).toEqual(new Set([1]));
    expect(index.find([hero({ ...doorway, x: 192 })])).toEqual(new Set());
  });

  it.each([
    { name: 'above the whole building', point: { x: 176, y: 120 } },
    { name: 'in front of the roof depth with overlapping bounds', point: { x: 176, y: 254.0001 } },
    { name: 'fully away from the building', point: outside },
  ])('keeps the roof opaque for a hero $name', ({ point }) => {
    const index = new OcclusionIndex([roof()], walkableGround());
    expect(index.find([hero(point)])).toEqual(new Set());
  });

  it('reveals an overlapping hero at the same foot depth as the roof, whose draw depth includes its 0.1 offset', () => {
    const index = new OcclusionIndex([roof()], walkableGround());
    expect(index.find([hero({ x: 176, y: 254 })])).toEqual(new Set([1]));
    expect(index.find([hero({ x: 176, y: 254.0001 })])).toEqual(new Set());
  });

  it('requires an overlap with painted roof pixels at the doorway', () => {
    const stepped = roof();
    stepped.silhouettes = [{ x: 88, y: 145, width: 176, height: 30 }];
    stepped.house!.geometry.roofSilhouettes = stepped.silhouettes;
    const index = new OcclusionIndex([stepped], walkableGround());
    expect(index.find([hero(doorway)])).toEqual(new Set());
    const point = { ...doorway, y: 224 };
    expect(index.find([{ point, width: 25, height: 49 }])).toEqual(new Set());
    expect(index.find([{ point, width: 25, height: 50 }])).toEqual(new Set([1]));
  });

  it('reveals the room based on feet inside, even where the sprite does not overlap the roof pixels', () => {
    const index = new OcclusionIndex([roof()], walkableGround());
    expect(index.find([hero(inside)])).toEqual(new Set([1]));
    // This point is below the visual roof's bottom (222), still inside the floor.
    expect(index.find([{ point: { x: 208, y: 223.5 }, width: 1, height: 1 }])).toEqual(new Set([1]));
  });

  it('reveals covered or occupied houses for any party member and keeps other roofs independent', () => {
    const index = new OcclusionIndex([roof(1), roof(2, 256)], walkableGround());
    const secondInside = { x: inside.x + 256, y: inside.y };
    expect(index.find([hero(outside), hero(inside), hero({ x: 800, y: 300 })])).toEqual(new Set([1]));
    expect(index.find([hero(inside), hero(secondInside), marker({ x: 144, y: 176 })])).toEqual(new Set([1, 2]));
    expect(index.find([hero(doorway), hero(secondInside)])).toEqual(new Set([1, 2]));
    expect(index.find([hero(outside), hero({ x: 800, y: 300 }), hero(secondInside)])).toEqual(new Set([2]));
  });

  it.each([
    { point: { x: 127.9999, y: 192 }, revealed: false },
    { point: { x: 128, y: 192 }, revealed: true },
    { point: { x: 223.9999, y: 192 }, revealed: true },
    { point: { x: 224, y: 192 }, revealed: false },
    { point: { x: 176, y: 159.9999 }, revealed: false },
    { point: { x: 176, y: 160 }, revealed: true },
    { point: { x: 176, y: 223.9999 }, revealed: true },
    { point: { x: 176, y: 224 }, revealed: false },
  ])('uses the exact interior floor boundary at $point even without a silhouette overlap', ({ point, revealed }) => {
    const ridgeOnly = roof();
    ridgeOnly.silhouettes = [{ x: 88, y: 145, width: 176, height: 10 }];
    ridgeOnly.house!.geometry.roofSilhouettes = ridgeOnly.silhouettes;
    const index = new OcclusionIndex([ridgeOnly], walkableGround());
    expect(index.find([{ point, width: 1, height: 1 }]).has(1)).toBe(revealed);
  });

  it('stays open at the doorway, then restores after the last hero clears the roof even if the route stays indoors', () => {
    const index = new OcclusionIndex([roof()], walkableGround());
    const groundProbes = [marker(inside), marker({ x: 208, y: 176 })];
    const occupied = index.find([hero(inside), ...groundProbes]).has(1);
    const faded = occlusionAlpha(1, occupied, 1000, false);
    expect(faded).toBe(0.27);
    const atDoorway = index.find([hero(doorway), ...groundProbes]).has(1);
    expect(atDoorway).toBe(true);
    expect(occlusionAlpha(faded, atDoorway, 1000, false)).toBe(0.27);
    const empty = index.find([hero(outside), ...groundProbes]).has(1);
    expect(empty).toBe(false);
    expect(occlusionAlpha(faded, empty, 32, false)).toBeGreaterThan(faded);
    expect(occlusionAlpha(faded, empty, 1000, false)).toBe(1);
    expect(occlusionAlpha(faded, empty, 0, true)).toBe(1);
    expect(index.find([hero(inside), ...groundProbes])).toEqual(new Set([1]));
  });

  it('keeps tree ground-probe transparency independent of roof hero-probe transparency', () => {
    const bounds = { x: 148, y: 140, width: 56, height: 80 };
    const tree: Occluder = { id: 3, base: { x: 176, y: 220 }, bounds, silhouettes: [bounds] };
    const index = new OcclusionIndex([roof(), tree], walkableGround());
    expect(index.find([marker({ x: 176, y: 176 })])).toEqual(new Set([3]));
    expect(index.find([hero({ x: 176, y: 150 })])).toEqual(new Set([3]));
    expect(index.find([hero(inside)])).toEqual(new Set([1, 3]));
  });

  it('reveals house walls only when an entering or indoor hero is actually covered by that wall', () => {
    const houseRoof = roof();
    const bounds = { x: 120, y: 145, width: 100, height: 100 };
    const wall: Occluder = { id: 2, base: { x: 170, y: 250 }, bounds, silhouettes: [bounds],
      house: { geometry: houseRoof.house!.geometry, part: 'wall' } };
    const index = new OcclusionIndex([houseRoof, wall], walkableGround());
    expect(index.find([marker(inside), marker(doorway)])).toEqual(new Set());
    expect(index.find([hero({ x: 127.9, y: 192 })])).toEqual(new Set());
    expect(index.find([hero({ x: 176, y: 150 })])).toEqual(new Set());
    expect(index.find([hero(inside)])).toEqual(new Set([1, 2]));
    expect(index.find([hero(doorway)])).toEqual(new Set([1, 2]));
    expect(index.find([hero({ ...doorway, y: 252 })])).toEqual(new Set([1]));
    const separateWall = { ...wall, silhouettes: [{ x: 240, y: 150, width: 20, height: 80 }] };
    expect(new OcclusionIndex([houseRoof, separateWall], walkableGround()).find([hero(inside)])).toEqual(new Set([1]));
  });

  it('does not open a room when the hero feet are on blocked ground', () => {
    const size = 32;
    const tiles = Array.from({ length: size * size }, () => ({ terrain: 'grass' as const, walkable: true, movementCost: 1 }));
    tiles[Math.floor(inside.y / TILE_SIZE) * size + Math.floor(inside.x / TILE_SIZE)].walkable = false;
    const index = new OcclusionIndex([roof()], new WalkableGround({ size, tiles }));
    expect(index.find([hero(inside)])).toEqual(new Set());
  });

  it('gives rendered roofs the real generated house interiors rather than their roof silhouettes', () => {
    // Cached textures avoid a renderer: only image placement participates in this test.
    const scene = {
      textures: { exists: () => true },
      add: { image: () => ({ setOrigin() { return this; }, setDepth() { return this; } }) },
    } as unknown as Phaser.Scene;
    const chunk = generateChunk(generateWorld('FIRST-CAMPFIRE'), '0,0');
    const houses = chunk.structures.filter(structure => structure.kind === 'house');
    expect(houses.length).toBeGreaterThan(0);
    const structures = createStructures(scene, chunk);
    const chimneys = structures.filter(object => object.smokeSource);
    expect(chimneys).toHaveLength(houses.length);
    for (const object of chimneys) {
      const { x, y } = object.smokeSource!;
      const { bounds, house } = object.occluder;
      expect(house?.part).toBe('roof');
      expect(x).toBeGreaterThan(bounds.x);
      expect(x).toBeLessThan(bounds.x + bounds.width);
      expect(y).toBeGreaterThanOrEqual(bounds.y);
      expect(y).toBeLessThan(bounds.y + bounds.height / 2);
    }
    const occluders = structures.map((object, id) => ({ ...object.occluder, id }));
    const roofs = occluders.filter(item => item.house?.part === 'roof');
    expect(roofs).toHaveLength(houses.length);
    const index = new OcclusionIndex(occluders, new WalkableGround(chunk));
    for (const house of houses) {
      const room = {
        x: (house.origin.x + 1) * TILE_SIZE, y: (house.origin.y + 1) * TILE_SIZE,
        width: (house.width - 2) * TILE_SIZE, height: (house.height - 2) * TILE_SIZE,
      };
      const renderedRoof = roofs.find(item => item.house?.geometry.id === house.id)!;
      expect(renderedRoof).toBeDefined();
      expect(renderedRoof.house?.geometry.interior).toEqual(room);
      const walls = occluders.filter(item => item.house?.part === 'wall' && item.house.geometry.id === house.id);
      expect(walls.length).toBeGreaterThan(0);
      expect(walls.every(item => item.house?.geometry === renderedRoof.house?.geometry)).toBe(true);
      const feet = tileCenter({ x: house.origin.x + 1, y: house.origin.y + 1 });
      expect(index.find([marker(feet)]).has(renderedRoof.id)).toBe(false);
      expect(index.find([hero(feet)]).has(renderedRoof.id)).toBe(true);
      const doorFeet = tileCenter({ ...house.approach, y: house.approach.y - 1 });
      expect(doorFeet.y).toBeGreaterThanOrEqual(room.y + room.height);
      expect(index.find([marker(doorFeet)]).has(renderedRoof.id)).toBe(false);
      expect(index.find([hero(doorFeet)]).has(renderedRoof.id)).toBe(true);
      // Both positions are still on the walkable doorway tile. Crossing the
      // real roof foot depth changes which sprite is drawn in front.
      const depthEdge = { x: doorFeet.x, y: renderedRoof.base.y };
      expect(index.find([hero(depthEdge)]).has(renderedRoof.id)).toBe(true);
      expect(index.find([hero({ ...depthEdge, y: depthEdge.y + 0.1 })]).has(renderedRoof.id)).toBe(false);
      expect(index.find([hero(tileCenter(house.approach))]).has(renderedRoof.id)).toBe(false);
    }
  });
});

function fixtureHouse(doors: GridPoint[], width = 4, height = 3, variant = 0): WorldStructure {
  const origin = { x: 7, y: 7 };
  const blockedCells: GridPoint[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x !== 0 && y !== 0 && x !== width - 1 && y !== height - 1) continue;
    if (!doors.some(door => door.x === x && door.y === y)) blockedCells.push({ x: origin.x + x, y: origin.y + y });
  }
  return { id: 'doorway-fixture', kind: 'house', origin, width, height, blockedCells, variant,
    approach: { x: origin.x + 1, y: origin.y + height } };
}

describe('real house doorway geometry', () => {
  it.each([0, 1, 2, 3])('derives the actual doorway for variant %i, not the whole facade', variant => {
    const door = { x: 1 + variant % 2, y: 2 };
    const structure = fixtureHouse([door], 4, 3, variant);
    const geometry = houseVisibility(structure);
    expect(geometry.entrances).toEqual([{ x: (7 + door.x) * TILE_SIZE, y: 9 * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }]);
    const feet = tileCenter({ x: 7 + door.x, y: 9 });
    expect(entersHouse(geometry, hero(feet))).toBe(true);
    expect(entersHouse(geometry, marker(feet))).toBe(false);
    expect(entersHouse(geometry, hero({ ...feet, x: (7 + door.x) * TILE_SIZE - 0.001 }))).toBe(false);
    expect(entersHouse(geometry, hero({ ...feet, x: (8 + door.x) * TILE_SIZE }))).toBe(false);
    expect(entersHouse(geometry, hero({ ...feet, y: geometry.roofBase.y }))).toBe(true);
    expect(entersHouse(geometry, hero({ ...feet, y: geometry.roofBase.y + 0.001 }))).toBe(false);
  });

  it.each([
    { name: 'north', door: { x: 1, y: 0 } },
    { name: 'west', door: { x: 0, y: 1 } },
    { name: 'east', door: { x: 3, y: 1 } },
  ])('supports an actual $name entrance but never an adjacent closed wall', ({ door }) => {
    const structure = fixtureHouse([door]);
    const geometry = houseVisibility(structure);
    const feet = tileCenter({ x: 7 + door.x, y: 7 + door.y });
    expect(geometry.entrances).toHaveLength(1);
    expect(entersHouse(geometry, hero(feet))).toBe(true);
    const closed = houseVisibility(fixtureHouse([]));
    expect(entersHouse(closed, hero(feet))).toBe(false);
  });

  it('excludes missing corners that do not connect directly to the room', () => {
    const geometry = houseVisibility(fixtureHouse([{ x: 0, y: 0 }, { x: 3, y: 2 }]));
    expect(geometry.entrances).toEqual([]);
    expect(entersHouse(geometry, hero(tileCenter({ x: 7, y: 7 })))).toBe(false);
  });
});
