import type { GridPoint, WorldChunk, WorldPoi } from '@shards/shared';
import { isWalkable, neighbors } from './grid';

/** Fire is solid; portals, stairs, chests and well approaches remain ordinary walkable ground. */
export function poiApproachCells(chunk: WorldChunk, poi: WorldPoi): GridPoint[] {
  return poi.kind === 'campfire'
    ? neighbors(poi.position, chunk.size).filter(point => isWalkable(chunk, point))
    : [poi.position];
}
