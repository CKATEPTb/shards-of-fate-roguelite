import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { createHouseHeroReveal, type HeroAppearance } from '../apps/client/src/world/house-hero-reveal';
import type { EnvironmentObject } from '../apps/client/src/world/environmentObject';

function fixture() {
  const mask = { destroy: vi.fn() };
  const graphics = { fillStyle() { return this; }, fillRect: vi.fn(), createGeometryMask: () => mask, destroy: vi.fn() };
  const images: ReturnType<typeof image>[] = [];
  function image(key: string, frameName: string | number) {
    return {
      texture: { key }, frame: { name: frameName }, alpha: 1, visible: true, depth: 0,
      x: 0, y: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0, rotation: 0, flipX: false, flipY: false,
      mask: undefined as unknown,
      setTexture(key: string, name: string | number) { this.texture = { key }; this.frame = { name }; return this; },
      setMask(value: unknown) { this.mask = value; return this; },
      clearMask() { this.mask = undefined; return this; },
      setAlpha(value: number) { this.alpha = value; return this; },
      setVisible(value: boolean) { this.visible = value; return this; },
      setDepth(value: number) { this.depth = value; return this; },
      setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
      setScale(x: number, y: number) { this.scaleX = x; this.scaleY = y; return this; },
      setOrigin(x: number, y: number) { this.originX = x; this.originY = y; return this; },
      setRotation(value: number) { this.rotation = value; return this; },
      setFlip(x: boolean, y: boolean) { this.flipX = x; this.flipY = y; return this; },
      destroy: vi.fn(),
    };
  }
  const scene = {
    make: { graphics: vi.fn(() => graphics) },
    add: { image: vi.fn((_x: number, _y: number, key: string, frame: string | number) => {
      const created = image(key, frame); images.push(created); return created;
    }) },
  } as unknown as Phaser.Scene;
  const sprite = Object.assign(image('hero-atlas', 'north/walk/2'), {
    originX: 0.5, originY: 0.8,
    getWorldTransformMatrix: () => ({ tx: 160, ty: 150, scaleX: 1.65, scaleY: 1.65, rotation: 0 }),
  }) as unknown as Phaser.GameObjects.Sprite;
  const hero: HeroAppearance = { point: { x: 160, y: 150 }, sprite };
  const roofImage = image('closed-roof', 0).setDepth(310);
  const bounds = { x: 100, y: 100, width: 150, height: 180 };
  const object: EnvironmentObject = {
    images: [roofImage as unknown as Phaser.GameObjects.Image],
    occluder: { base: { x: 175, y: 300 }, bounds, silhouettes: [bounds], house: { part: 'roof', geometry: {
      id: 'house', interior: { x: 132, y: 200, width: 86, height: 64 }, entrances: [],
      roofBase: { x: 175, y: 300 }, roofSilhouettes: [bounds],
    } } },
  };
  return { renderer: createHouseHeroReveal(scene, [object]), hero, images, mask, graphics, roofImage, bounds };
}

describe('private exterior house visibility', () => {
  it('reveals only the animated hero inside the occluding surface, leaving the roof fully opaque', () => {
    const { renderer, hero, images, roofImage, mask, graphics, bounds } = fixture();
    renderer.update([hero], 16, true);
    expect(renderer.count).toBe(1);
    expect(roofImage.alpha).toBe(1);
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ texture: { key: 'hero-atlas' }, frame: { name: 'north/walk/2' }, mask,
      x: 160, y: 150, scaleX: 1.65, scaleY: 1.65, originX: 0.5, originY: 0.8, alpha: 0.68 });
    expect(images[0].depth).toBeGreaterThan(roofImage.depth);
    expect(graphics.fillRect).toHaveBeenCalledWith(bounds.x, bounds.y, bounds.width, bounds.height);
    hero.sprite.frame = { name: 'west/walk/1' } as Phaser.Textures.Frame;
    renderer.update([hero], 16, true);
    expect(images).toHaveLength(1);
    expect(images[0].frame.name).toBe('west/walk/1');
    expect(roofImage.alpha).toBe(1);
    renderer.destroy();
  });

  it('stops showing exterior silhouettes upon entry or departure and releases shared masks', () => {
    const { renderer, hero, images, mask, graphics, roofImage } = fixture();
    renderer.update([hero], 16, true);
    renderer.update([{ ...hero, point: { x: 160, y: 220 } }], 16, true);
    expect(renderer.count).toBe(0);
    expect(images[0].visible).toBe(false);
    renderer.update([hero], 16, true);
    expect(renderer.count).toBe(1);
    expect(images).toHaveLength(1);
    renderer.update([], 16, true);
    expect(images[0].destroy).toHaveBeenCalledOnce();
    expect(images[0].mask).toBeUndefined();
    expect(roofImage.alpha).toBe(1);
    renderer.destroy();
    expect(mask.destroy).toHaveBeenCalledOnce();
    expect(graphics.destroy).toHaveBeenCalledOnce();
  });

  it('preserves local overlap priority behind a roof, while a nearer ally stays in front', () => {
    const { renderer, hero, images, roofImage } = fixture();
    const local = { ...hero, controlled: true };
    const ally = { ...hero, sprite: { ...hero.sprite, texture: { key: 'ally-atlas' } } as Phaser.GameObjects.Sprite };
    renderer.update([local, ally], 16, true);
    const localReveal = images.find(image => image.texture.key === 'hero-atlas')!;
    const allyReveal = images.find(image => image.texture.key === 'ally-atlas')!;
    expect(localReveal.depth).toBeGreaterThan(allyReveal.depth);
    renderer.update([ally, local], 16, true);
    expect(localReveal.depth).toBeGreaterThan(allyReveal.depth);
    renderer.update([local, { ...ally, point: { ...ally.point, y: ally.point.y + 16 } }], 16, true);
    expect(allyReveal.depth).toBeGreaterThan(localReveal.depth);
    expect(roofImage.alpha).toBe(1);
    expect(images).toHaveLength(2);
    renderer.destroy();
  });
});
