import type Phaser from 'phaser';
import type { GridPoint, Season, WorldChunk, WorldStructure } from '@shards/shared';
import { describe, expect, it } from 'vitest';
import { createStructures } from '../apps/client/src/world/structures';
import { TILE_SIZE } from '../apps/client/src/world/projection';

interface Rect { x: number; y: number; width: number; height: number; color: number; alpha: number }
interface Texture { width: number; height: number; opaque: Uint8Array; rectangles: Rect[] }

/** Rasterize opaque Graphics rectangles to inspect the actual painted roof, without Phaser/DOM. */
function recordingScene() {
  const textures = new Map<string, Texture>();
  const scene = {
    textures: { exists: (key: string) => textures.has(key) },
    make: { graphics: () => {
      let color = 0; let alpha = 1;
      const rectangles: Rect[] = [];
      return {
        fillStyle(nextColor: number, nextAlpha = 1) { color = nextColor; alpha = nextAlpha; return this; },
        fillRect(x: number, y: number, width: number, height: number) { rectangles.push({ x, y, width, height, color, alpha }); return this; },
        generateTexture(key: string, width: number, height: number) {
          const opaque = new Uint8Array(width * height);
          for (const rect of rectangles) {
            if (rect.alpha !== 1) continue;
            for (let y = Math.max(0, rect.y); y < Math.min(height, rect.y + rect.height); y++) {
              for (let x = Math.max(0, rect.x); x < Math.min(width, rect.x + rect.width); x++) opaque[y * width + x] = 1;
            }
          }
          textures.set(key, { width, height, opaque, rectangles });
        },
        destroy() {},
      };
    } },
    add: { image: (x: number, y: number, key: string) => ({
      x, y, key, depth: 0,
      setOrigin() { return this; },
      setDepth(depth: number) { this.depth = depth; return this; },
    }) },
  };
  return { scene: scene as unknown as Phaser.Scene, textures };
}

function house(width: number, height: number, variant: number, origin: GridPoint = { x: 7, y: 8 }): WorldStructure {
  const blockedCells: GridPoint[] = [];
  const door = 1 + variant % (width - 2);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if ((x === 0 || x === width - 1 || y === 0 || y === height - 1) && !(y === height - 1 && x === door)) {
      blockedCells.push({ x: origin.x + x, y: origin.y + y });
    }
  }
  return { id: 'roof-fixture', kind: 'house', origin, width, height, variant, blockedCells,
    approach: { x: origin.x + door, y: origin.y + height } };
}

function render(fake: ReturnType<typeof recordingScene>, structure: WorldStructure, season: Season) {
  const objects = createStructures(fake.scene, { structures: [structure], season } as WorldChunk);
  const roof = objects.find(object => object.occluder.house?.part === 'roof')!;
  const image = roof.images[0] as unknown as { x: number; y: number; key: string; depth: number };
  return { roof, image, texture: fake.textures.get(image.key)!, walls: objects.filter(object => object.occluder.house?.part === 'wall') };
}

describe('closed house roof geometry', () => {
  it.each<Season>(['spring', 'summer', 'autumn', 'winter'])('covers every rear/side wall pixel in %s for all variants and footprint sizes', season => {
    const fake = recordingScene();
    for (const width of [3, 4, 5]) for (const height of [3, 4, 5]) for (let variant = 0; variant < 4; variant++) {
      const structure = house(width, height, variant);
      const { roof, image, texture, walls } = render(fake, structure, season);
      const misses: GridPoint[] = [];
      for (const wall of walls) {
        // The south facade intentionally remains visible below the eave.
        if (wall.occluder.base.y === roof.occluder.base.y) continue;
        expect(image.depth).toBeGreaterThan(wall.images[0].depth);
        for (const shape of wall.occluder.silhouettes) {
          for (let y = shape.y; y < shape.y + shape.height; y++) for (let x = shape.x; x < shape.x + shape.width; x++) {
            const localX = x - image.x; const localY = y - image.y;
            if ((localX < 0 || localX >= texture.width || localY < 0 || localY >= texture.height || !texture.opaque[localY * texture.width + localX]) && misses.length < 8) misses.push({ x, y });
          }
        }
      }
      expect(misses, `${width}×${height}, variant ${variant}`).toEqual([]);
      expect(image.y + texture.height).toBe(roof.occluder.base.y - TILE_SIZE);
      expect(roof.occluder.house?.geometry.interior).toEqual({ x: (structure.origin.x + 1) * TILE_SIZE, y: (structure.origin.y + 1) * TILE_SIZE,
        width: (width - 2) * TILE_SIZE, height: (height - 2) * TILE_SIZE });
      // A stepped, pitched ridge remains above the covered walls rather than becoming a rectangle.
      expect(texture.opaque[0]).toBe(0);
      expect(texture.opaque[Math.floor(texture.width / 2)]).toBe(1);
      const opening = texture.rectangles.find(rect => rect.color === 0x192b23 && rect.alpha === 1 && rect.width === 11 && rect.height === 4)!;
      expect(roof.smokeSource).toEqual({ x: image.x + opening.x + opening.width / 2, y: image.y + opening.y });
    }
  });

  it('caches different house depths separately and translates cached chimney geometry with the house', () => {
    const fake = recordingScene();
    const short = render(fake, house(4, 3, 0), 'spring');
    const deep = render(fake, house(4, 4, 0), 'spring');
    expect(deep.image.key).not.toBe(short.image.key);
    expect(deep.texture.height - short.texture.height).toBe(TILE_SIZE);
    const moved = render(fake, house(4, 3, 0, { x: 17, y: 13 }), 'spring');
    expect(moved.texture).toBe(short.texture);
    expect(moved.roof.smokeSource).toEqual({ x: short.roof.smokeSource!.x + 10 * TILE_SIZE, y: short.roof.smokeSource!.y + 5 * TILE_SIZE });
  });
});
