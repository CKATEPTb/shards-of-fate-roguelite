import type { GridPoint } from '@shards/shared';
import type { Bounds } from './occlusion';
import { grain } from './palette';

export const SMOKE_PUFF_COUNT = 8;
export const SMOKE_CYCLE_MS = 6000;
export const SMOKE_RISE = 104;
export const SMOKE_TEXTURE = { width: 18, height: 14 } as const;

export interface SmokeStyle {
  count: number;
  cycle: number;
  rise: number;
  drift: number;
  curl: number;
  initialScale: number;
  expansion: number;
  opacity: number;
}

export const CHIMNEY_SMOKE: SmokeStyle = {
  count: SMOKE_PUFF_COUNT, cycle: SMOKE_CYCLE_MS, rise: SMOKE_RISE,
  drift: 11, curl: 6, initialScale: 0.45, expansion: 1.3, opacity: 0.42,
};
export const CAMPFIRE_SMOKE: SmokeStyle = {
  count: 5, cycle: 3600, rise: 54,
  drift: 7, curl: 4, initialScale: 0.25, expansion: 0.8, opacity: 0.44,
};

export interface SmokePuff extends GridPoint { scale: number; alpha: number }

/** Age, not frame count, controls a prefilled stream. Every puff is reused each cycle. */
export function smokePuffAt(source: GridPoint, elapsedMs: number, index: number, style = CHIMNEY_SMOKE): SmokePuff {
  const progress = ((elapsedMs / style.cycle + index / style.count) % 1 + 1) % 1;
  const phase = grain(Math.round(source.x), Math.round(source.y), 71) % 628 / 100;
  const curl = Math.sin(progress * 7 + phase) * progress * style.curl;
  return {
    x: source.x + progress * style.drift + curl,
    y: source.y - progress * style.rise,
    scale: style.initialScale + progress * style.expansion,
    alpha: style.opacity * Math.min(1, progress / 0.12) * (1 - progress) ** 1.5,
  };
}

/** Conservative bounds include the entire rising trail, even when its roof is offscreen. */
export function smokeTrailBounds(source: GridPoint, style = CHIMNEY_SMOKE): Bounds {
  const maxScale = style.initialScale + style.expansion;
  const halfWidth = SMOKE_TEXTURE.width * maxScale / 2;
  const halfHeight = SMOKE_TEXTURE.height * maxScale / 2;
  return { x: source.x - style.curl - halfWidth, y: source.y - style.rise - halfHeight,
    width: style.drift + style.curl * 2 + halfWidth * 2, height: style.rise + halfHeight * 2 };
}
