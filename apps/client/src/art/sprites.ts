import { unitFramePixels } from './unitFrames';
import type { HeroBody } from '@shards/shared';
export type { Pixel } from './pixelCanvas';

/** Portraits use the same front-facing resting art as animated units. */
export function spritePixels(sprite: string, role: string, enemy = false, body?: HeroBody) {
  return unitFramePixels(sprite, role, enemy, 'south', 'idle', 0, body).map((pixel) => ({ ...pixel, y: pixel.y - 4 }));
}
