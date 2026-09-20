import { afterEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { RenderedVisibility, type AlphaMask, type VisibilityFrame, type VisibilityImage } from '../apps/client/src/world/rendered-visibility';
import { textureAlpha } from '../apps/client/src/world/texture-alpha';

function frame(): VisibilityFrame {
  return { cutWidth: 2, cutHeight: 2, realWidth: 2, realHeight: 2, x: 0, y: 0,
    customPivot: false, source: { resolution: 1 } };
}
function image(overrides: Partial<VisibilityImage<VisibilityFrame>> = {}): VisibilityImage<VisibilityFrame> {
  return { frame: frame(), x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1,
    displayOriginX: 0, displayOriginY: 0, flipX: false, flipY: false,
    alpha: 1, visible: true, depth: 20, ...overrides };
}
const mask = (...pixels: number[]): AlphaMask => ({ width: 2, height: 2, pixels: new Uint8Array(pixels) });
const solid = () => mask(255, 255, 255, 255);

describe('rendered foreground transmission', () => {
  it('uses actual alpha pixels, leaving transparent texture corners and nearby ground visible', () => {
    const visibility = new RenderedVisibility([image()], () => mask(0, 255, 128, 0));
    expect(visibility.pointVisibility({ x: 0.5, y: 0.5 }, 10)).toBe(1);
    expect(visibility.pointVisibility({ x: 1.5, y: 0.5 }, 10)).toBe(0);
    expect(visibility.pointVisibility({ x: 0.5, y: 1.5 }, 10)).toBeCloseTo(1 - 128 / 255);
    expect(visibility.pointVisibility({ x: 2.5, y: 0.5 }, 10)).toBe(1);
  });

  it('includes every opaque foreground surface regardless of whether it can fade', () => {
    const lowRock = image({ depth: 30 });
    const roof = image({ depth: 40, x: 4 });
    const wall = image({ depth: 50, x: 8 });
    const visibility = new RenderedVisibility([lowRock, roof, wall], solid);
    for (const x of [0.5, 4.5, 8.5]) expect(visibility.pointVisibility({ x, y: 0.5 }, 20)).toBe(0);
    expect(visibility.pointVisibility({ x: 0.5, y: 0.5 }, 30)).toBe(1);
    expect(visibility.pointVisibility({ x: 4.5, y: 0.5 }, 60)).toBe(1);
  });

  it('composes texture alpha with current image fades and all overlapping layers', () => {
    const first = image({ alpha: 0.5 }); const second = image({ alpha: 0.25 });
    const visibility = new RenderedVisibility([first, second], solid);
    expect(visibility.pointVisibility({ x: 0.5, y: 0.5 }, 10)).toBe(0.375);
    first.alpha = 0.27; second.visible = false; visibility.refresh();
    expect(visibility.pointVisibility({ x: 0.5, y: 0.5 }, 10)).toBe(0.73);
    first.alpha = 0; visibility.refresh();
    expect(visibility.pointVisibility({ x: 0.5, y: 0.5 }, 10)).toBe(1);
  });

  it('tracks scaled and rotated foliage with its ground origin when wind moves it between cells', () => {
    const crown = image({ x: 100, y: 200, scaleX: 2, scaleY: 3, rotation: Math.PI / 2,
      displayOriginX: 1, displayOriginY: 2 });
    const visibility = new RenderedVisibility([crown], () => mask(255, 0, 0, 0));
    expect(visibility.pointVisibility({ x: 104.5, y: 199 }, 10)).toBe(0);
    expect(visibility.pointVisibility({ x: 104.5, y: 201 }, 10)).toBe(1);
    crown.x += 70; visibility.refresh();
    expect(visibility.pointVisibility({ x: 104.5, y: 199 }, 10)).toBe(1);
    expect(visibility.pointVisibility({ x: 174.5, y: 199 }, 10)).toBe(0);
  });

  it('applies horizontal and vertical flips around a noncentral origin', () => {
    const surface = image({ x: 10, y: 20 });
    const visibility = new RenderedVisibility([surface], () => mask(255, 0, 0, 0));
    expect(visibility.pointVisibility({ x: 10.5, y: 20.5 }, 10)).toBe(0);
    surface.flipX = true; visibility.refresh();
    expect(visibility.pointVisibility({ x: 10.5, y: 20.5 }, 10)).toBe(1);
    expect(visibility.pointVisibility({ x: 11.5, y: 20.5 }, 10)).toBe(0);
    surface.flipY = true; visibility.refresh();
    expect(visibility.pointVisibility({ x: 11.5, y: 20.5 }, 10)).toBe(1);
    expect(visibility.pointVisibility({ x: 11.5, y: 21.5 }, 10)).toBe(0);
  });

  it('samples trimmed high-resolution frames at their rendered offset', () => {
    const trimmed = { ...frame(), x: 2, y: 3, realWidth: 6, realHeight: 7, source: { resolution: 2 } };
    const visibility = new RenderedVisibility([image({ frame: trimmed })], () => mask(255, 0, 0, 0));
    expect(visibility.pointVisibility({ x: 2.25, y: 3.25 }, 10)).toBe(0);
    expect(visibility.pointVisibility({ x: 2.75, y: 3.25 }, 10)).toBe(1);
    expect(visibility.pointVisibility({ x: 1.75, y: 3.25 }, 10)).toBe(1);
  });

  it('reuses alpha reads across many instances and queries, reading only a changed frame', () => {
    const shared = frame(); const first = image({ frame: shared }); const second = image({ frame: shared, x: 100 });
    const read = vi.fn(solid);
    const visibility = new RenderedVisibility([first, second], read);
    for (let index = 0; index < 100; index++) {
      first.x += 0.1; visibility.refresh();
      visibility.pointVisibility({ x: 0.5, y: 0.5 }, 10);
    }
    expect(read).toHaveBeenCalledTimes(1);
    first.frame = frame(); visibility.refresh();
    expect(read).toHaveBeenCalledTimes(2);
    visibility.destroy();
    expect(visibility.pointVisibility({ x: 100.5, y: 0.5 }, 10)).toBe(1);
  });

  it('removes hidden or zero-scale images and reindexes them when they return', () => {
    const surface = image(); const visibility = new RenderedVisibility([surface], solid);
    surface.scaleX = 0; visibility.refresh();
    expect(visibility.pointVisibility({ x: 0.5, y: 0.5 }, 10)).toBe(1);
    surface.scaleX = -1; visibility.refresh();
    expect(visibility.pointVisibility({ x: -0.5, y: 0.5 }, 10)).toBe(0);
    surface.visible = false; visibility.refresh();
    expect(visibility.pointVisibility({ x: -0.5, y: 0.5 }, 10)).toBe(1);
    surface.visible = true; surface.depth = 5; visibility.refresh();
    expect(visibility.pointVisibility({ x: -0.5, y: 0.5 }, 10)).toBe(1);
  });
});

describe('immutable environment texture masks', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('reads the source cut once and caches just the alpha bytes across environments', () => {
    const drawImage = vi.fn();
    const getImageData = vi.fn(() => ({ data: new Uint8ClampedArray([11, 22, 33, 0, 44, 55, 66, 192]) }));
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => ({ drawImage, getImageData })) };
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });
    const source = {};
    const cut = { cutX: 10, cutY: 20, cutWidth: 2, cutHeight: 1, source: { image: source } } as Phaser.Textures.Frame;
    const alpha = textureAlpha(cut);
    expect([...alpha.pixels]).toEqual([0, 192]);
    expect(drawImage).toHaveBeenCalledWith(source, 10, 20, 2, 1, 0, 0, 2, 1);
    expect(textureAlpha(cut)).toBe(alpha);
    expect(getImageData).toHaveBeenCalledTimes(1);
  });
});
