import { HERO_LIGHT_RADIUS_TILES, WORLD_TILE_PIXELS, type GridPoint } from '@shards/shared';
import type { WorldProjection } from './projection';

export type WorldLightKind = 'hero' | 'campfire' | 'torch';
export const WORLD_DARKNESS = 0.82;
export const LIGHT_RESOLUTION = 0.5;
export const LIGHT_STYLES = {
  // Patrol bodies and heads must be legible before the five-tile pursuit radius.
  hero: { radius: HERO_LIGHT_RADIUS_TILES * WORLD_TILE_PIXELS, reveal: 0.95, warmth: 0.035, color: '237,190,122' },
  campfire: { radius: 212, reveal: 0.98, warmth: 0.085, color: '255,166,81' },
  torch: { radius: 148, reveal: 0.96, warmth: 0.07, color: '255,179,104' },
} satisfies Record<WorldLightKind, { radius: number; reveal: number; warmth: number; color: string }>;

export interface ScreenLight extends GridPoint {
  kind: WorldLightKind;
  radius: number;
}

/** Smooth falloff has no hard ring at the bright core or the outer edge. */
export function lightFalloff(normalizedDistance: number): number {
  const progress = Math.max(0, Math.min(1, (normalizedDistance - 0.22) / 0.78));
  return 1 - progress * progress * (3 - 2 * progress);
}

export function lightPulse(kind: WorldLightKind, elapsed: number, reducedMotion: boolean): number {
  if (kind === 'hero' || reducedMotion) return 1;
  return 0.975 + Math.sin(elapsed * 0.0031) * 0.016 + Math.sin(elapsed * 0.0073) * 0.009;
}

export function worldLightToScreen(point: GridPoint, projection: WorldProjection): GridPoint {
  return {
    x: (point.x - projection.scrollX - projection.width / 2) * projection.zoom + projection.width / 2,
    y: (point.y - projection.scrollY - projection.height / 2) * projection.zoom + projection.height / 2,
  };
}

/** Source points are interpolated world pixels, never tile coordinates. */
export function visibleWorldLights(heroes: readonly GridPoint[], campfires: readonly GridPoint[], projection: WorldProjection, torches: readonly GridPoint[] = []): ScreenLight[] {
  const lights: ScreenLight[] = [];
  const collect = (points: readonly GridPoint[], kind: WorldLightKind) => {
    const radius = LIGHT_STYLES[kind].radius * projection.zoom;
    for (const point of points) {
      const screen = worldLightToScreen(point, projection);
      if (screen.x + radius < 0 || screen.y + radius < 0 || screen.x - radius > projection.width || screen.y - radius > projection.height) continue;
      lights.push({ ...screen, kind, radius });
    }
  };
  collect(heroes, 'hero');
  collect(campfires, 'campfire');
  collect(torches, 'torch');
  return lights;
}

/** A scrollFactor=0 object is still zoomed about the camera's viewport centre. */
export function lightingOverlayPlacement(projection: WorldProjection) {
  return {
    x: projection.width * (1 - 1 / projection.zoom) / 2,
    y: projection.height * (1 - 1 / projection.zoom) / 2,
    width: projection.width / projection.zoom,
    height: projection.height / projection.zoom,
    canvasWidth: Math.max(1, Math.ceil(projection.width * LIGHT_RESOLUTION)),
    canvasHeight: Math.max(1, Math.ceil(projection.height * LIGHT_RESOLUTION)),
  };
}
