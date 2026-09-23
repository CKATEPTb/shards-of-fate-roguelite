import { unitFrameMetrics, unitFramePixels } from './unitFrames';
import type { HeroBody } from '@shards/shared';
import { heroAppearanceKey } from './heroAppearance';
import { HERO_VISUAL_SLOTS, type HeroVisualLoadout } from './heroLoadout';
import type { Pixel } from './pixelCanvas';
export type { Pixel } from './pixelCanvas';

const portraits = new Map<string, Pixel[]>();

/** Portraits use the same front-facing resting art as animated units. */
export function spritePixels(sprite: string, role: string, enemy = false, body?: HeroBody, equipment?: HeroVisualLoadout) {
  const loadoutKey = enemy ? '' : HERO_VISUAL_SLOTS.map(slot => equipment?.[slot] === undefined ? '?' : equipment[slot] ?? '-').join('|');
  const key = `${enemy ? 'enemy' : 'hero'}:${sprite}:${role}:${enemy ? '' : heroAppearanceKey(body)}:${loadoutKey}`;
  const cached = portraits.get(key);
  if (cached) { portraits.delete(key); portraits.set(key, cached); return cached; }
  const offsetY = unitFrameMetrics(enemy).size / 8;
  const pixels = unitFramePixels(sprite, role, enemy, 'south', 'idle', 0, body, equipment).map((pixel) => ({ ...pixel, y: pixel.y - offsetY }));
  portraits.set(key, pixels);
  if (portraits.size > 64) portraits.delete(portraits.keys().next().value!);
  return pixels;
}
