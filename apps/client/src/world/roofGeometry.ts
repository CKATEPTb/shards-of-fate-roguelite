import type { GridPoint, WorldStructure } from '@shards/shared';
import type { Bounds } from './occlusion';
import { TILE_SIZE } from './projection';
import { wallElevation } from './wallGeometry';

export interface RoofGeometry {
  base: GridPoint;
  bounds: Bounds;
  /** Opaque shingle courses in texture coordinates, including the stepped hip. */
  courses: Bounds[];
  chimneyOpening: Bounds;
}

const OVERHANG = 8;
const RIDGE_RISE = 24;
const REAR_CLEARANCE = 6;
const COURSE_HEIGHT = 8;

/** The hip reaches its full span before the rear wall, keeping both back corners covered. */
export function houseRoofGeometry(structure: Pick<WorldStructure, 'origin' | 'width' | 'height'>): RoofGeometry {
  const base = {
    x: (structure.origin.x + structure.width / 2) * TILE_SIZE,
    y: (structure.origin.y + structure.height) * TILE_SIZE - 2,
  };
  const width = structure.width * TILE_SIZE + OVERHANG * 2;
  const top = structure.origin.y * TILE_SIZE - wallElevation('house') - REAR_CLEARANCE - RIDGE_RISE;
  // Keep the lower wall and doorway visible below the front eave.
  const bottom = base.y - TILE_SIZE;
  const height = bottom - top;
  const courses: Bounds[] = [];
  for (let y = 0; y < height; y += COURSE_HEIGHT) {
    const inset = Math.max(0, RIDGE_RISE - y);
    courses.push({ x: inset, y, width: width - inset * 2, height: Math.min(COURSE_HEIGHT, height - y) });
  }
  return {
    base,
    bounds: { x: base.x - width / 2, y: top, width, height },
    courses,
    chimneyOpening: { x: width - 32, y: 9, width: 11, height: 4 },
  };
}
