import type Phaser from 'phaser';
import type { WorldChunk } from '@shards/shared';
import { grain, palettes, type WorldPalette } from './palette';
import type { Bounds } from './occlusion';
import { TILE_SIZE } from './projection';
import { isPuddle, waterGeometry, waterPixel, type WaterSpan } from './water-geometry';
export { isPuddle } from './water-geometry';

let nextWaterId = 0;
const RIPPLE_FRAMES = 8;
const color = (value: number) => `#${value.toString(16).padStart(6, '0')}`;

/** Static surface and animated glints consume exactly the same connected shoreline mask. */
export function drawWaterSurface(art: Phaser.GameObjects.Graphics, chunk: WorldChunk, palette: WorldPalette) {
  const geometry = waterGeometry(chunk);
  const paint = (spans: WaterSpan[], color: number, alpha = 1) => {
    art.fillStyle(color, alpha);
    for (const span of spans) art.fillRect(span.x, span.y, span.width, span.height);
  };
  paint(geometry.shore, palette.moss, 0.65);
  paint(geometry.water, palette.water[0]);
  paint(geometry.shallows, palette.water[1], 0.38);
  paint(geometry.puddles, palette.water[0], 0.8);
  for (let y = 0; y < chunk.size; y++) for (let x = 0; x < chunk.size; x++) {
    if (chunk.tiles[y * chunk.size + x].terrain !== 'water' || grain(x, y, chunk.season.length) % 4) continue;
    const px = x * TILE_SIZE + 16, py = y * TILE_SIZE + 16;
    if (waterPixel(geometry, px + 6, py + 2) !== 1) continue;
    art.fillStyle(palette.leaf[1], 0.8).fillRect(px, py, 7, 3).fillRect(px + 2, py - 2, 3, 2);
  }
}

function drawRipple(context: CanvasRenderingContext2D, palette: WorldPalette, frame: number) {
  const spread = frame % 4;
  context.fillStyle = color(palette.water[1]); context.globalAlpha = 0.65;
  context.fillRect(5 - spread, 8 + frame % 2, 17 + spread * 2, 2);
  context.fillStyle = color(palette.water[2]); context.globalAlpha = 0.55 - spread * 0.07;
  context.fillRect(7 - spread, 8 + frame % 2, 8 + spread, 1);
  context.fillStyle = color(palette.water[1]); context.globalAlpha = 0.5;
  context.fillRect(9 + spread, 23 - frame % 3, 14 - spread, 2);
  if (frame > 3) {
    context.fillStyle = color(palette.water[2]); context.globalAlpha = 0.3;
    context.fillRect(4, 17, 4, 1); context.fillRect(13, 18, 3, 1);
  }
}

export function intersectsViewport(a: Bounds, b?: Bounds): boolean {
  return !b || a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function createWater(scene: Phaser.Scene, chunk: WorldChunk) {
  const id = ++nextWaterId;
  const geometry = waterGeometry(chunk);
  const palette = palettes[chunk.season];
  const ripples = geometry.patches.map(({ bounds, spans }, patchIndex) => {
    const mask = document.createElement('canvas');
    mask.width = bounds.width; mask.height = bounds.height;
    const maskContext = mask.getContext('2d')!;
    maskContext.fillStyle = '#fff';
    for (const span of spans) maskContext.fillRect(span.x - bounds.x, span.y - bounds.y, span.width, span.height);
    const keys = Array.from({ length: RIPPLE_FRAMES }, (_, frame) => `water:${id}:${patchIndex}:${frame}`);
    for (let frame = 0; frame < keys.length; frame++) {
      const texture = scene.textures.createCanvas(keys[frame], bounds.width, bounds.height);
      if (!texture) throw new Error('Cannot create water ripples');
      const context = texture.getContext();
      context.imageSmoothingEnabled = false;
      for (let y = Math.floor(bounds.y / TILE_SIZE); y < Math.ceil((bounds.y + bounds.height) / TILE_SIZE); y++) {
        for (let x = Math.floor(bounds.x / TILE_SIZE); x < Math.ceil((bounds.x + bounds.width) / TILE_SIZE); x++) {
          const tile = chunk.tiles[y * chunk.size + x];
          const puddle = isPuddle(tile, x, y);
          if (tile.terrain !== 'water' && !puddle) continue;
          context.save();
          context.translate(x * TILE_SIZE - bounds.x, y * TILE_SIZE - bounds.y);
          if (puddle) { context.translate(5, 16); context.scale(0.7, 0.36); }
          drawRipple(context, palette, (frame + grain(x, y, 91) % RIPPLE_FRAMES) % RIPPLE_FRAMES);
          context.restore();
        }
      }
      // Bake the shared shoreline once into each cached frame; never read pixels while animating.
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'destination-in';
      context.drawImage(mask, 0, 0);
      context.globalCompositeOperation = 'source-over';
      texture.refresh();
    }
    mask.width = mask.height = 1;
    const image = scene.add.image(bounds.x, bounds.y, keys[0]).setOrigin(0).setDepth(1);
    return { image, bounds, keys, frame: 0 };
  });
  let time = 0;
  let destroyed = false;
  return {
    count: ripples.length,
    update(delta: number, reduced: boolean, viewport?: Bounds) {
      if (destroyed) return;
      if (!reduced) time += Math.max(0, delta);
      for (const ripple of ripples) {
        const visible = intersectsViewport(ripple.bounds, viewport);
        ripple.image.setVisible(visible);
        if (!visible || reduced) continue;
        const frame = Math.floor(time / 190) % RIPPLE_FRAMES;
        if (frame !== ripple.frame) {
          ripple.image.setTexture(ripple.keys[frame]);
          ripple.frame = frame;
        }
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const ripple of ripples) {
        ripple.image.destroy();
        ripple.keys.forEach(key => scene.textures.remove(key));
      }
    },
  };
}
