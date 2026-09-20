import type { GridPoint, WorldChunk, WorldPoi } from '@shards/shared';
import { isWalkable, neighbors } from './grid';

/** Campfires are approached from beside the fire; other points occupy walkable ground. */
export function poiApproachCells(chunk: WorldChunk, poi: WorldPoi): GridPoint[] {
  return poi.kind === 'campfire'
    ? neighbors(poi.position, chunk.size).filter(point => isWalkable(chunk, point))
    : [poi.position];
}
