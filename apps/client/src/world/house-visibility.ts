import type { GridPoint, WorldStructure } from '@shards/shared';
import type { Bounds, OcclusionProbe } from './occlusion';
import { TILE_SIZE } from './projection';
import { houseRoofGeometry, type RoofGeometry } from './roofGeometry';

/** One shared description of the actual room and its entrances, in world pixels. */
export interface HouseVisibility {
  id: string;
  interior: Bounds;
  entrances: Bounds[];
  roofBase: GridPoint;
  roofSilhouettes: Bounds[];
}

export function containsPoint(bounds: Bounds, point: GridPoint): boolean {
  return point.x >= bounds.x && point.x < bounds.x + bounds.width
    && point.y >= bounds.y && point.y < bounds.y + bounds.height;
}

export function overlapsBounds(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function probeBounds(probe: OcclusionProbe): Bounds {
  return { x: probe.point.x - probe.width / 2, y: probe.point.y - probe.height, width: probe.width, height: probe.height };
}

export function houseVisibility(structure: WorldStructure, roof: RoofGeometry = houseRoofGeometry(structure)): HouseVisibility {
  const { origin, width, height } = structure;
  const blocked = new Set(structure.blockedCells.map(point => `${point.x},${point.y}`));
  const entrances: Bounds[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    // A doorway must share an edge with the interior, so a missing corner is
    // not an entrance and cannot open the roof for someone beside the house.
    const horizontal = (y === 0 || y === height - 1) && x > 0 && x < width - 1;
    const vertical = (x === 0 || x === width - 1) && y > 0 && y < height - 1;
    if ((!horizontal && !vertical) || blocked.has(`${origin.x + x},${origin.y + y}`)) continue;
    entrances.push({ x: (origin.x + x) * TILE_SIZE, y: (origin.y + y) * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE });
  }
  return {
    id: structure.id,
    interior: { x: (origin.x + 1) * TILE_SIZE, y: (origin.y + 1) * TILE_SIZE,
      width: (width - 2) * TILE_SIZE, height: (height - 2) * TILE_SIZE },
    entrances,
    roofBase: roof.base,
    roofSilhouettes: roof.courses.map(course => ({ ...course, x: roof.bounds.x + course.x, y: roof.bounds.y + course.y })),
  };
}

/** Looking behind a closed wall is different from crossing a real doorway. */
export function entersHouse(house: HouseVisibility, hero: OcclusionProbe): boolean {
  if (hero.ground) return false;
  if (containsPoint(house.interior, hero.point)) return true;
  if (hero.point.y > house.roofBase.y || !house.entrances.some(entrance => containsPoint(entrance, hero.point))) return false;
  const bounds = probeBounds(hero);
  return house.roofSilhouettes.some(shape => overlapsBounds(shape, bounds));
}
