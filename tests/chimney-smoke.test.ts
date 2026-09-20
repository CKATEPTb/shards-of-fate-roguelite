import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { createChimneySmoke } from '../apps/client/src/world/chimneySmoke';
import { SMOKE_CYCLE_MS, SMOKE_PUFF_COUNT, SMOKE_TEXTURE, smokePuffAt, smokeTrailBounds } from '../apps/client/src/world/smokeMotion';

class SmokeImage {
  x = 0; y = 0; alpha = 1; scale = 1; depth = 0; visible = true;
  setOrigin = vi.fn(() => this);
  setDepth = vi.fn((depth: number) => { this.depth = depth; return this; });
  setScale = vi.fn((scale: number) => { this.scale = scale; return this; });
  setAlpha = vi.fn((alpha: number) => { this.alpha = alpha; return this; });
  setPosition = vi.fn((x: number, y: number) => { this.x = x; this.y = y; return this; });
  setVisible = vi.fn((visible: boolean) => { this.visible = visible; return this; });
  destroy = vi.fn();
}

function fakeScene() {
  const images: SmokeImage[] = [];
  const textures = new Set<string>();
  const art = { fillStyle: vi.fn(), fillRect: vi.fn(), generateTexture: vi.fn((key: string) => textures.add(key)), destroy: vi.fn() };
  art.fillStyle.mockReturnValue(art);
  art.fillRect.mockReturnValue(art);
  const scene = {
    textures: { exists: (key: string) => textures.has(key) },
    make: { graphics: vi.fn(() => art) },
    add: { image: vi.fn((x: number, y: number) => {
      const image = new SmokeImage(); image.x = x; image.y = y; images.push(image); return image;
    }) },
  };
  return { scene: scene as unknown as Phaser.Scene, images, art, add: scene.add, make: scene.make };
}

const source = { x: 500, y: 500 };
const appearance = (image: SmokeImage) => ({ x: image.x, y: image.y, alpha: image.alpha, scale: image.scale });

describe('chimney smoke motion', () => {
  it('starts with a visible rising stream, then broadens and disperses on a repeatable six-second cycle', () => {
    const initial = Array.from({ length: SMOKE_PUFF_COUNT }, (_, index) => smokePuffAt(source, 0, index));
    expect(initial.filter(puff => puff.alpha > 0)).toHaveLength(7);
    expect(Math.max(...initial.map(puff => puff.y)) - Math.min(...initial.map(puff => puff.y))).toBeGreaterThan(85);
    const younger = smokePuffAt(source, 0, 2);
    const older = smokePuffAt(source, 400, 2);
    expect(older.y).toBeLessThan(younger.y);
    expect(older.scale).toBeGreaterThan(younger.scale);
    expect(older.alpha).toBeLessThan(younger.alpha);
    expect(smokePuffAt(source, SMOKE_CYCLE_MS, 2)).toEqual(younger);
    expect(smokePuffAt(source, 400, 2)).toEqual(older);
  });

  it('contains every expanded puff in its full trail bounds, including the highest wisps', () => {
    for (const point of [source, { x: -83.25, y: 17.5 }]) {
      const bounds = smokeTrailBounds(point);
      for (let time = 0; time < SMOKE_CYCLE_MS; time += 47) for (let index = 0; index < SMOKE_PUFF_COUNT; index++) {
        const puff = smokePuffAt(point, time, index);
        const halfWidth = SMOKE_TEXTURE.width * puff.scale / 2;
        const halfHeight = SMOKE_TEXTURE.height * puff.scale / 2;
        expect(puff.x - halfWidth).toBeGreaterThanOrEqual(bounds.x);
        expect(puff.x + halfWidth).toBeLessThanOrEqual(bounds.x + bounds.width);
        expect(puff.y - halfHeight).toBeGreaterThanOrEqual(bounds.y);
        expect(puff.y + halfHeight).toBeLessThanOrEqual(bounds.y + bounds.height);
      }
    }
  });
});

describe('chimney smoke lifecycle', () => {
  it('allocates eight reused images per source above world lighting, with no per-frame image creation', () => {
    const fake = fakeScene();
    const smoke = createChimneySmoke(fake.scene, [source, { x: 200, y: 300 }]);
    expect(smoke.count).toBe(16);
    expect(fake.images.filter(image => image.alpha > 0)).toHaveLength(14);
    expect(fake.images.every(image => image.depth === 90001)).toBe(true);
    for (let frame = 0; frame < 120; frame++) smoke.update(100, false);
    expect(fake.add.image).toHaveBeenCalledTimes(16);
    expect(fake.images.every(image => image.destroy.mock.calls.length === 0)).toBe(true);
  });

  it('freezes the visible stream during reduced motion and resumes from the same phase', () => {
    const fake = fakeScene();
    const smoke = createChimneySmoke(fake.scene, [source]);
    smoke.update(360, false);
    const frozen = fake.images.map(appearance);
    smoke.update(9000, true);
    expect(fake.images.map(appearance)).toEqual(frozen);
    expect(fake.images.every(image => image.visible)).toBe(true);
    smoke.update(100, false);
    expect(appearance(fake.images[2])).toEqual(smokePuffAt(source, 460, 2));
  });

  it('keeps smoke visible when only its upper trail is onscreen and skips motion writes while culled', () => {
    const fake = fakeScene();
    const smoke = createChimneySmoke(fake.scene, [source]);
    smoke.update(150, false, { x: 490, y: 390, width: 30, height: 30 });
    expect(fake.images.every(image => image.visible)).toBe(true);
    const writes = fake.images[0].setPosition.mock.calls.length;
    smoke.update(250, false, { x: 0, y: 0, width: 100, height: 100 });
    expect(fake.images.every(image => !image.visible)).toBe(true);
    expect(fake.images[0].setPosition).toHaveBeenCalledTimes(writes);
    smoke.update(0, false);
    expect(appearance(fake.images[2])).toEqual(smokePuffAt(source, 400, 2));
  });

  it('destroys each image once and ignores updates after destruction', () => {
    const fake = fakeScene();
    const smoke = createChimneySmoke(fake.scene, [source]);
    smoke.destroy(); smoke.destroy();
    smoke.update(500, false);
    expect(fake.images.every(image => image.destroy.mock.calls.length === 1)).toBe(true);
    expect(fake.images.every(image => image.setPosition.mock.calls.length === 0 && image.setVisible.mock.calls.length === 0)).toBe(true);
  });

  it('reuses the shared texture between chunks and tolerates empty sources', () => {
    const fake = fakeScene();
    const empty = createChimneySmoke(fake.scene, []);
    empty.update(100, false); empty.destroy(); empty.destroy();
    expect(empty.count).toBe(0);
    expect(fake.make.graphics).not.toHaveBeenCalled();
    createChimneySmoke(fake.scene, [source]).destroy();
    createChimneySmoke(fake.scene, [source]).destroy();
    expect(fake.make.graphics).toHaveBeenCalledTimes(1);
    expect(fake.art.generateTexture).toHaveBeenCalledTimes(1);
  });
});
