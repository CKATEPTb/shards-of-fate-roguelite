import type { GridPoint, WorldChunk } from '@shards/shared';
import { distance, isWalkable, neighbors, pointAt, samePoint, tileIndex } from './grid';
import { PathHeap } from './heap';
import { terrainMovementCost, type MovementActor } from './movement-speed';

/** Local A*: four-way movement, terrain cost, no diagonal corner cutting or cross-map search. */
export function findPath(chunk: WorldChunk, start: GridPoint, target: GridPoint, actor?: MovementActor): GridPoint[] {
  if (!isWalkable(chunk, start) || !isWalkable(chunk, target) || samePoint(start, target)) return [];
  const startIndex = tileIndex(start, chunk.size);
  const targetIndex = tileIndex(target, chunk.size);
  const costs = new Float64Array(chunk.tiles.length).fill(Infinity);
  const previous = new Int32Array(chunk.tiles.length).fill(-1);
  const closed = new Uint8Array(chunk.tiles.length);
  const open = new PathHeap();
  const gates = new Set(chunk.exits.map(exit => tileIndex(exit.position, chunk.size)));
  costs[startIndex] = 0; open.push({ index: startIndex, priority: distance(start, target) });
  while (open.size) {
    const { index } = open.pop();
    if (closed[index]) continue;
    if (index === targetIndex) {
      const path: GridPoint[] = [];
      for (let cursor = index; cursor !== startIndex; cursor = previous[cursor]) path.push(pointAt(cursor, chunk.size));
      return path.reverse();
    }
    closed[index] = 1;
    for (const next of neighbors(pointAt(index, chunk.size), chunk.size)) {
      const nextIndex = tileIndex(next, chunk.size);
      const tile = chunk.tiles[nextIndex];
      // Stored costs include ordinary terrain penalties. Remove only the part
      // this actor ignores, preserving any other weight assigned to the tile.
      const terrainFactor = actor ? terrainMovementCost(tile.terrain, actor) / terrainMovementCost(tile.terrain) : 1;
      const nextCost = costs[index] + tile.movementCost * terrainFactor;
      if (!tile.walkable || closed[nextIndex] || nextCost >= costs[nextIndex] || (gates.has(nextIndex) && nextIndex !== targetIndex)) continue;
      costs[nextIndex] = nextCost; previous[nextIndex] = index;
      open.push({ index: nextIndex, priority: nextCost + distance(next, target) });
    }
  }
  return [];
}
