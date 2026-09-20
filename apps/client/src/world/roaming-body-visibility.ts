import type { GridPoint } from '@shards/shared';
import { containsPoint } from './house-visibility';
import { LIGHT_STYLES } from './lightingGeometry';
import type { Bounds } from './occlusion';

export const MIN_MOB_TRANSMISSION = 0.02;
export const MOB_DETAIL_RADIUS = LIGHT_STYLES.hero.radius * 3;

export interface RoamingSight {
  heroes: readonly GridPoint[];
  viewport: Bounds;
  pointVisibility(point: GridPoint, depth: number): number;
}

export function inMobDetailRange(feet: GridPoint, heroes: readonly GridPoint[]): boolean {
  return heroes.some(hero => (hero.x - feet.x) ** 2 + (hero.y - feet.y) ** 2 <= MOB_DETAIL_RADIUS ** 2);
}

/** Only painted body samples count; transparent frame padding cannot reveal a hidden enemy. */
export function roamingBodyVisible(feet: GridPoint, samples: Iterable<GridPoint>, depth: number, sight: RoamingSight): boolean {
  if (!inMobDetailRange(feet, sight.heroes)) return false;
  for (const point of samples) {
    if (containsPoint(sight.viewport, point) && sight.pointVisibility(point, depth) > MIN_MOB_TRANSMISSION) return true;
  }
  return false;
}

/** A cached mask contains pixel centres above the sprite's ground origin, without atlas padding. */
export function opaqueBodyPixels(rgba: ArrayLike<number>, width: number, height: number, groundY: number): GridPoint[] {
  const points: GridPoint[] = [];
  for (let y = 0; y < Math.min(height, groundY); y++) for (let x = 0; x < width; x++) {
    if (rgba[(y * width + x) * 4 + 3] > 0) points.push({ x: x + 0.5, y: y + 0.5 });
  }
  // Most enemies are exposed at the torso: short-circuit that cheap case first.
  const centre = { x: width / 2, y: groundY * 0.6 };
  return points.sort((a, b) => (a.x - centre.x) ** 2 + (a.y - centre.y) ** 2 - (b.x - centre.x) ** 2 - (b.y - centre.y) ** 2);
}
