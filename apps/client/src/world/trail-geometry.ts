import type { Direction } from '@shards/shared';
import { TILE_SIZE } from './projection';

export const TRAIL_WIDTH = 9;
export const TRAIL_FEATHER = 1.5;
const centre = TILE_SIZE / 2;
const ends: Record<Direction, { x: number; y: number }> = {
  north: { x: centre, y: 0 }, east: { x: TILE_SIZE, y: centre },
  south: { x: centre, y: TILE_SIZE }, west: { x: 0, y: centre },
};

/** The material changes colour and texture, never the width of the walking strip. */
export function trailCoverage(distance: number): number {
  const t = Math.max(0, Math.min(1, (distance - TRAIL_WIDTH / 2) / TRAIL_FEATHER));
  return 1 - t * t * (3 - 2 * t);
}

/** Shared centre and edge endpoints keep bends, junctions and paired gates continuous. */
export function trailDistance(directions: Direction[]): (x: number, y: number) => number {
  const segments = directions.map(direction => ends[direction]);
  return (x, y) => {
    let distance = Math.hypot(x - centre, y - centre);
    for (const end of segments) {
      const dx = end.x - centre;
      const dy = end.y - centre;
      const t = Math.max(0, Math.min(1, ((x - centre) * dx + (y - centre) * dy) / (dx * dx + dy * dy)));
      distance = Math.min(distance, Math.hypot(x - centre - dx * t, y - centre - dy * t));
    }
    return distance;
  };
}
