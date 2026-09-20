import type { WorldChunk } from '@shards/shared';
import { inBounds, isWalkable, neighbors, tileIndex } from './grid';

/** Fire occupies its ground tile without replacing the terrain underneath it. */
export function campfireTileIndices(chunk: Pick<WorldChunk, 'size' | 'pois'>): Set<number> {
  return new Set(chunk.pois
    .filter(poi => poi.kind === 'campfire' && inBounds(poi.position, chunk.size))
    .map(poi => tileIndex(poi.position, chunk.size)));
}

export function applyCampfireObstacles(chunk: WorldChunk): void {
  const fires = campfireTileIndices(chunk);
  for (const index of fires) chunk.tiles[index].walkable = false;
  if (!fires.has(tileIndex(chunk.spawn, chunk.size))) return;
  const besideFire = [{ x: chunk.spawn.x, y: chunk.spawn.y + 1 }, ...neighbors(chunk.spawn, chunk.size)]
    .find(point => isWalkable(chunk, point));
  if (besideFire) chunk.spawn = besideFire;
}
