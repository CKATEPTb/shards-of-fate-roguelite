import type { ExplorationState, GridPoint, WorldChunk } from '@shards/shared';
import { applyCampfireObstacles, campfireTileIndices } from './campfires';
import { isWalkable, neighbors, samePoint, tileIndex } from './grid';
import { findPath } from './pathfinding';

function safeCampfireNeighbor(chunk: WorldChunk, origin: GridPoint, occupied: Set<number>): GridPoint {
  const candidates = [{ x: origin.x, y: origin.y + 1 }, ...neighbors(origin, chunk.size)];
  const position = candidates.find(point => isWalkable(chunk, point)
    && point.x > 0 && point.y > 0 && point.x < chunk.size - 1 && point.y < chunk.size - 1
    && !occupied.has(tileIndex(point, chunk.size))
    && !chunk.pois.some(poi => samePoint(poi.position, point)));
  if (!position) throw new Error('No safe position beside the campfire');
  return position;
}

/** Upgrade pre-obstacle saves and live development state without resetting the expedition. */
export function normalizeCampfireOccupancy(state: ExplorationState): ExplorationState {
  const fires = campfireTileIndices(state.chunk);
  if (!fires.size) return state;
  let chunk = state.chunk;
  if ([...fires].some(index => chunk.tiles[index].walkable) || fires.has(tileIndex(chunk.spawn, chunk.size))) {
    chunk = { ...chunk, tiles: [...chunk.tiles], spawn: { ...chunk.spawn } };
    // The obstacle helper owns the tile objects it changes, leaving prior states intact.
    for (const index of fires) chunk.tiles[index] = { ...chunk.tiles[index] };
    applyCampfireObstacles(chunk);
  }
  const onFire = (point: GridPoint) => fires.has(tileIndex(point, chunk.size));
  const occupied = new Set(state.actors.filter(actor => !onFire(actor.position)).map(actor => tileIndex(actor.position, chunk.size)));
  let changed = chunk !== state.chunk;
  const actors = state.actors.map(actor => {
    const displaced = onFire(actor.position);
    if (!displaced && !actor.path.some(onFire)) return actor;
    const position = displaced ? safeCampfireNeighbor(chunk, actor.position, occupied) : actor.position;
    occupied.add(tileIndex(position, chunk.size));
    const target = actor.path.at(-1);
    const path = target && isWalkable(chunk, target) ? findPath(chunk, position, target) : [];
    const keepProgress = !displaced && path[0] && actor.path[0] && samePoint(path[0], actor.path[0]);
    changed = true;
    return { ...actor, position, path, ...(actor.movement && !keepProgress ? { movement: { ...actor.movement, elapsedMs: 0 } } : {}) };
  });
  return changed ? { ...state, chunk, actors } : state;
}
