import type { GridPoint, WorldChunk } from '@shards/shared';
import { inBounds, neighbors, pointAt, tileIndex } from '../world/grid';
import { chunkRegions, regionAt, type ChunkRegions } from '../world/regions';

interface Navigation { regions: ChunkRegions; points: GridPoint[]; gates: Set<number> }
const navigation = new WeakMap<WorldChunk, Navigation>();

/** Generated chunks are immutable, so all groups share one flood fill. */
export function roamingNavigation(chunk: WorldChunk): Navigation {
  let cached = navigation.get(chunk);
  if (!cached) {
    const gates = new Set(chunk.exits.map(exit => tileIndex(exit.position, chunk.size)));
    const points = chunk.tiles.flatMap((tile, index) => {
      const point = pointAt(index, chunk.size);
      return tile.walkable && !gates.has(index) && point.x > 0 && point.y > 0
        && point.x < chunk.size - 1 && point.y < chunk.size - 1 ? [point] : [];
    });
    cached = { regions: chunkRegions(chunk), points, gates };
    navigation.set(chunk, cached);
  }
  return cached;
}

export const distanceSquared = (a: GridPoint, b: GridPoint): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function sameRoamingRegion(chunk: WorldChunk, a: GridPoint, b: GridPoint): boolean {
  const { regions } = roamingNavigation(chunk);
  const region = regionAt(chunk, regions, a);
  return region >= 0 && region === regionAt(chunk, regions, b);
}

/** Supercover ray: even an exact diagonal corner cannot see through a wall. */
export function hasRoamingLineOfSight(chunk: WorldChunk, start: GridPoint, target: GridPoint): boolean {
  if (!inBounds(start, chunk.size) || !inBounds(target, chunk.size)) return false;
  const opaque = (x: number, y: number) => {
    const tile = chunk.tiles[y * chunk.size + x];
    return !tile || !tile.walkable && tile.terrain !== 'water';
  };
  if (opaque(start.x, start.y) || opaque(target.x, target.y)) return false;
  const dx = target.x - start.x; const dy = target.y - start.y;
  const nx = Math.abs(dx); const ny = Math.abs(dy);
  const sx = Math.sign(dx); const sy = Math.sign(dy);
  let x = start.x; let y = start.y; let ix = 0; let iy = 0;
  while (ix < nx || iy < ny) {
    const horizontal = (1 + 2 * ix) * ny;
    const vertical = (1 + 2 * iy) * nx;
    if (horizontal === vertical) {
      if (opaque(x + sx, y) || opaque(x, y + sy)) return false;
      x += sx; y += sy; ix++; iy++;
    } else if (horizontal < vertical) { x += sx; ix++; }
    else { y += sy; iy++; }
    if (opaque(x, y)) return false;
  }
  return true;
}

export function inRoamingRange(chunk: WorldChunk, a: GridPoint, b: GridPoint, radius: number): boolean {
  return distanceSquared(a, b) <= radius * radius && sameRoamingRegion(chunk, a, b)
    && hasRoamingLineOfSight(chunk, a, b);
}

/** Connected formation slots; gates are never patrol targets or shortcuts. */
export function formationPoints(chunk: WorldChunk, anchor: GridPoint, maxDistance = 3): GridPoint[] {
  const { gates } = roamingNavigation(chunk);
  const queue = [{ point: anchor, distance: 0 }];
  const seen = new Set([tileIndex(anchor, chunk.size)]);
  const result: GridPoint[] = [];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const { point, distance } = queue[cursor];
    result.push(point);
    if (distance >= maxDistance) continue;
    for (const next of neighbors(point, chunk.size)) {
      const index = tileIndex(next, chunk.size);
      if (seen.has(index) || gates.has(index) || !chunk.tiles[index].walkable
        || next.x <= 0 || next.y <= 0 || next.x >= chunk.size - 1 || next.y >= chunk.size - 1) continue;
      seen.add(index); queue.push({ point: next, distance: distance + 1 });
    }
  }
  return result;
}
