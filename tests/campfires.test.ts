import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { createCampfires } from '../apps/client/src/world/campfires';

class CampfireImage {
  x: number; y: number; texture: string;
  alpha = 1; scaleX = 1; scaleY = 1; depth = 0; visible = true;
  constructor(x: number, y: number, texture: string) { this.x = x; this.y = y; this.texture = texture; }
  setOrigin = vi.fn(() => this);
  setDepth = vi.fn((depth: number) => { this.depth = depth; return this; });
  setScale = vi.fn((x: number, y = x) => { this.scaleX = x; this.scaleY = y; return this; });
  setAlpha = vi.fn((alpha: number) => { this.alpha = alpha; return this; });
  setTexture = vi.fn((texture: string) => { this.texture = texture; return this; });
  setPosition = vi.fn((x: number, y: number) => { this.x = x; this.y = y; return this; });
  setVisible = vi.fn((visible: boolean) => { this.visible = visible; return this; });
  destroy = vi.fn();
}

function fakeScene() {
  const images: CampfireImage[] = [];
  const textures = new Set<string>();
  const art = {
    fillStyle: vi.fn(), fillRect: vi.fn(), clear: vi.fn(),
    generateTexture: vi.fn((key: string) => textures.add(key)), destroy: vi.fn(),
  };
  art.fillStyle.mockReturnValue(art);
  art.fillRect.mockReturnValue(art);
  art.clear.mockReturnValue(art);
  const scene = {
    textures: { exists: (key: string) => textures.has(key) },
    make: { graphics: vi.fn(() => art) },
    add: { image: vi.fn((x: number, y: number, texture: string) => {
      const image = new CampfireImage(x, y, texture); images.push(image); return image;
    }) },
  };
  return { scene: scene as unknown as Phaser.Scene, images, art, add: scene.add, make: scene.make };
}

const source = { x: 500, y: 500 };
const appearance = (image: CampfireImage) => ({
  x: image.x, y: image.y, alpha: image.alpha, scaleX: image.scaleX, scaleY: image.scaleY, texture: image.texture,
});

describe('campfire animation lifecycle', () => {
  it('flickers above a stationary base while the light smoke rises, expands and fades', () => {
    const fake = fakeScene();
    const fires = createCampfires(fake.scene, [source]);
    const flame = fake.images.find(image => image.texture.startsWith('campfire-flame:'))!;
    const puffs = fake.images.filter(image => image !== flame);
    expect(flame).toBeDefined();
    expect(puffs.length).toBeGreaterThan(0);
    const initialFlame = appearance(flame);
    const initialSmoke = puffs.map(appearance);
    expect(puffs.every(puff => puff.y < source.y && puff.alpha < 0.5)).toBe(true);
    const fadingPuff = puffs.findIndex(puff => puff.alpha > 0);
    expect(fadingPuff).toBeGreaterThanOrEqual(0);
    fires.update(200, false);
    expect(flame.texture).not.toEqual(initialFlame.texture);
    expect({ x: flame.x, y: flame.y }).toEqual({ x: initialFlame.x, y: initialFlame.y });
    for (let index = 0; index < puffs.length; index++) {
      expect(puffs[index].y).toBeLessThan(initialSmoke[index].y);
      expect(puffs[index].scaleX).toBeGreaterThan(initialSmoke[index].scaleX);
    }
    expect(puffs[fadingPuff].alpha).toBeLessThan(initialSmoke[fadingPuff].alpha);
  });

  it('animates already visible fires with a fixed allocation across many cycles', () => {
    const fake = fakeScene();
    const fires = createCampfires(fake.scene, [source, { x: 200, y: 300 }]);
    expect(fires.count).toBeGreaterThan(0);
    expect(fake.images.some(image => image.visible && image.alpha > 0)).toBe(true);
    const initial = fake.images.map(appearance);
    const allocations = fake.add.image.mock.calls.length;
    fires.update(250, false);
    expect(fake.images.map(appearance)).not.toEqual(initial);
    for (let frame = 0; frame < 120; frame++) fires.update(100, false);
    expect(fake.add.image).toHaveBeenCalledTimes(allocations);
    expect(fake.images.every(image => image.destroy.mock.calls.length === 0)).toBe(true);
  });

  it('freezes the current appearance during reduced motion and resumes without advancing the hidden time', () => {
    const fake = fakeScene();
    const reference = fakeScene();
    const fires = createCampfires(fake.scene, [source]);
    const continuous = createCampfires(reference.scene, [source]);
    fires.update(360, false);
    continuous.update(360, false);
    const frozen = fake.images.map(appearance);
    fires.update(9000, true);
    expect(fake.images.map(appearance)).toEqual(frozen);
    expect(fake.images.every(image => image.visible)).toBe(true);
    fires.update(150, false);
    continuous.update(150, false);
    expect(fake.images.map(appearance)).toEqual(reference.images.map(appearance));
    expect(fake.images.map(appearance)).not.toEqual(frozen);
  });

  it('culls offscreen effects without per-frame motion writes and restores them on return', () => {
    const fake = fakeScene();
    const reference = fakeScene();
    const fires = createCampfires(fake.scene, [source]);
    const continuous = createCampfires(reference.scene, [source]);
    fires.update(200, false);
    const writes = fake.images.map(image => ({ position: image.setPosition.mock.calls.length, texture: image.setTexture.mock.calls.length }));
    fires.update(300, false, { x: 0, y: 0, width: 100, height: 100 });
    expect(fake.images.every(image => !image.visible)).toBe(true);
    expect(fake.images.map(image => ({ position: image.setPosition.mock.calls.length, texture: image.setTexture.mock.calls.length }))).toEqual(writes);
    fires.update(0, false);
    continuous.update(500, false);
    expect(fake.images.every(image => image.visible)).toBe(true);
    expect(fake.images.map(appearance)).toEqual(reference.images.map(appearance));
  });

  it('keeps the upper smoke onscreen even when its campfire is below the viewport', () => {
    const fake = fakeScene();
    const fires = createCampfires(fake.scene, [source]);
    fires.update(200, false, { x: 495, y: 433, width: 20, height: 25 });
    const flame = fake.images.find(image => image.texture.startsWith('campfire-flame:'))!;
    const puffs = fake.images.filter(image => image !== flame);
    expect(flame.visible).toBe(false);
    expect(puffs.every(image => image.visible)).toBe(true);
    expect(puffs.some(image => image.y >= 433 && image.y < 458 && image.alpha > 0)).toBe(true);
  });

  it('releases all images exactly once, stops writes after destruction and reuses textures on the next chunk', () => {
    const fake = fakeScene();
    const fires = createCampfires(fake.scene, [source]);
    const oldImages = [...fake.images];
    fires.update(100, false);
    const writes = oldImages.map(image => image.setPosition.mock.calls.length + image.setTexture.mock.calls.length + image.setVisible.mock.calls.length);
    const texturesCreated = fake.art.generateTexture.mock.calls.length;
    expect(texturesCreated).toBeGreaterThan(0);
    fires.destroy(); fires.destroy(); fires.update(500, false);
    expect(oldImages.every(image => image.destroy.mock.calls.length === 1)).toBe(true);
    expect(oldImages.map(image => image.setPosition.mock.calls.length + image.setTexture.mock.calls.length + image.setVisible.mock.calls.length)).toEqual(writes);
    const next = createCampfires(fake.scene, [source]);
    expect(fake.art.generateTexture).toHaveBeenCalledTimes(texturesCreated);
    expect(fake.images.slice(oldImages.length).every(image => image.destroy.mock.calls.length === 0)).toBe(true);
    next.destroy();
    expect(fake.images.every(image => image.destroy.mock.calls.length === 1)).toBe(true);
  });

  it('does not allocate resources when the location has no campfires', () => {
    const fake = fakeScene();
    const fires = createCampfires(fake.scene, []);
    expect(fires.count).toBe(0);
    fires.update(200, false); fires.update(200, true); fires.destroy(); fires.destroy();
    expect(fake.add.image).not.toHaveBeenCalled();
    expect(fake.make.graphics).not.toHaveBeenCalled();
  });
});
