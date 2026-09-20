import type { GridPoint, WorldChunk } from '@shards/shared';
import { containsPoint, entersHouse, houseVisibility, type HouseVisibility } from './house-visibility';
import type { Bounds } from './occlusion';
import { TILE_SIZE } from './projection';
import { wallElevation } from './wallGeometry';

interface HouseCover { house: HouseVisibility; walls: { depth: number; bounds: Bounds }[] }

/** Inspection obeys the same doorway policy as house rendering, never the mob's presence. */
export class RoamingVisibility {
  private covers: HouseCover[];
  private opened = new Set<string>();

  constructor(chunk: WorldChunk) {
    this.covers = chunk.structures.filter(structure => structure.kind === 'house').map(structure => ({
      house: houseVisibility(structure),
      walls: structure.blockedCells.map(point => ({
        depth: (point.y + 1) * TILE_SIZE - 2,
        bounds: { x: point.x * TILE_SIZE, y: point.y * TILE_SIZE - wallElevation('house'), width: TILE_SIZE, height: TILE_SIZE + wallElevation('house') - 2 },
      })),
    }));
  }

  updateHeroes(heroes: readonly GridPoint[]) {
    this.opened.clear();
    for (const { house } of this.covers) if (heroes.some(point => entersHouse(house, { point, width: 25, height: 43 }))) this.opened.add(house.id);
  }

  hidesInterior(feet: GridPoint): boolean {
    return this.covers.some(({ house }) => !this.opened.has(house.id) && containsPoint(house.interior, feet));
  }

  coversPoint(point: GridPoint, feet: GridPoint): boolean {
    return this.covers.some(({ house, walls }) => !this.opened.has(house.id) && (
      house.roofBase.y > feet.y && house.roofSilhouettes.some(shape => containsPoint(shape, point))
      || walls.some(wall => wall.depth > feet.y && containsPoint(wall.bounds, point))
    ));
  }
}

/** Perceptual red → amber → green, including exact sampled endpoints. */
export function victoryChanceColor(percent: number): string {
  const value = Math.max(0, Math.min(100, percent));
  const stops = [[243, 90, 90], [237, 193, 101], [111, 223, 132]];
  const index = value <= 50 ? 0 : 1;
  const fraction = (value - index * 50) / 50;
  return `#${stops[index].map((from, channel) => Math.round(from + (stops[index + 1][channel] - from) * fraction).toString(16).padStart(2, '0')).join('')}`;
}
