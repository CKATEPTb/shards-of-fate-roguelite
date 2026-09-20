import type Phaser from 'phaser';
import type { AlphaMask } from './rendered-visibility';

const masks = new WeakMap<Phaser.Textures.Frame, AlphaMask>();

/** Environment textures are immutable. Read once per frame, shared across chunks. */
export function textureAlpha(frame: Phaser.Textures.Frame): AlphaMask {
  const existing = masks.get(frame);
  if (existing) return existing;
  const width = frame.cutWidth; const height = frame.cutHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Cannot read environment texture alpha');
  context.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, width, height, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;
  const pixels = new Uint8Array(width * height);
  for (let index = 0; index < pixels.length; index++) pixels[index] = rgba[index * 4 + 3];
  const mask = { width, height, pixels };
  masks.set(frame, mask);
  return mask;
}
