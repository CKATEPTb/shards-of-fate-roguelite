import type { WorldChunk, WorldGraph, WorldNode } from '@shards/shared';
import { inBounds, isWalkable, neighbors, tileIndex } from './grid';
import { createRng, hashString } from '../random';
import { worldDie } from './generation-dice';

/** One private die per node: fires grow rarer towards the outer seasonal rings. */
export function hasCampfire(graph: WorldGraph, node: WorldNode): boolean {
  if (node.id === graph.startId) return true;
  if ((graph.structureVersion ?? 1) < 3) return false;
  const sides = 4 + Math.ceil(Math.hypot(node.x, node.y) / 3);
  return worldDie(createRng(`campfire-v3:${hashString(graph.seed)}:${node.id}`), sides) === 1;
}

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
