import type { GridPoint } from '@shards/shared';
import type { WalkableGround } from './walkable-occlusion';
import { entersHouse, overlapsBounds, probeBounds, type HouseVisibility } from './house-visibility';

export interface Bounds { x: number; y: number; width: number; height: number }
export interface Occluder {
  id: number;
  base: GridPoint;
  bounds: Bounds;
  /** Crown and trunk bounds exclude transparent corners of the texture. */
  silhouettes: Bounds[];
  /** Low rocks remain solid even when their outline touches a marker or character. */
  revealable?: boolean;
  /** Closed houses never reveal their contents to outside heroes or ground probes. */
  house?: { geometry: HouseVisibility; part: 'roof' | 'wall' };
}
export interface OcclusionProbe {
  point: GridPoint;
  width: number;
  height: number;
  /** Ground markers are beneath every prop; characters use their foot depth. */
  ground?: boolean;
  /** Separate the actual pointed-at ground from a marker's drawing offset. */
  groundPoint?: GridPoint;
  /** Roaming enemies can fade foliage, but only heroes may open house surfaces. */
  revealHouses?: boolean;
}

/** Index visual silhouettes, not collision cells: a tall crown spans several tiles. */
export class OcclusionIndex {
  private cells = new Map<string, Occluder[]>();
  private houses: Occluder[] = [];
  constructor(props: Occluder[], private ground: WalkableGround, private cellSize = 64) {
    for (const prop of props) {
      if (prop.revealable === false) continue;
      if (prop.house) { this.houses.push(prop); continue; }
      this.visitCells(prop.bounds, key => {
        const items = this.cells.get(key) ?? [];
        items.push(prop);
        this.cells.set(key, items);
      });
    }
  }

  find(probes: OcclusionProbe[]): Set<number> {
    const result = new Set<number>();
    for (const probe of probes) {
      const point = probe.groundPoint ?? probe.point;
      const tile = this.ground.at(point);
      if (!tile) continue;
      let bounds = probeBounds(probe);
      if (!probe.ground && probe.revealHouses !== false) {
        const entered = new Map<HouseVisibility, boolean>();
        for (const prop of this.houses) {
          const { geometry, part } = prop.house!;
          const inside = entered.get(geometry) ?? entersHouse(geometry, probe);
          entered.set(geometry, inside);
          if (!inside) continue;
          if (part === 'roof' || (prop.base.y > point.y && prop.silhouettes.some(shape => overlapsBounds(shape, bounds)))) result.add(prop.id);
        }
      }
      if (probe.ground) {
        // A marker may overlap a blocked neighbour. It can reveal only the free
        // cell it actually targets, rather than dissolving that neighbour's base.
        const x = Math.max(bounds.x, tile.x);
        const y = Math.max(bounds.y, tile.y);
        bounds = { x, y, width: Math.min(bounds.x + bounds.width, tile.x + tile.width) - x, height: Math.min(bounds.y + bounds.height, tile.y + tile.height) - y };
        if (bounds.width <= 0 || bounds.height <= 0) continue;
      }
      const candidates = new Set<Occluder>();
      this.visitCells(bounds, key => this.cells.get(key)?.forEach(prop => candidates.add(prop)));
      for (const prop of candidates) {
        if (!probe.ground && prop.base.y <= point.y) continue;
        if (prop.silhouettes.some(shape => overlapsBounds(shape, bounds))) result.add(prop.id);
      }
    }
    return result;
  }

  private visitCells(bounds: Bounds, visit: (key: string) => void) {
    const left = Math.floor(bounds.x / this.cellSize);
    const right = Math.floor((bounds.x + bounds.width) / this.cellSize);
    const top = Math.floor(bounds.y / this.cellSize);
    const bottom = Math.floor((bounds.y + bounds.height) / this.cellSize);
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) visit(`${x},${y}`);
  }
}

/** Exponential fade is independent of frame rate and also restores unoccluded props. */
export function occlusionAlpha(current: number, obscured: boolean, delta: number, reducedMotion: boolean, fadeTarget = 0.27): number {
  const target = obscured ? fadeTarget : 1;
  if (reducedMotion) return target;
  const next = current + (target - current) * (1 - Math.exp(-Math.max(0, delta) / 85));
  return Math.abs(next - target) < 0.002 ? target : next;
}
