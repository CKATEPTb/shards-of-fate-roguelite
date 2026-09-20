import type { Direction, GridPoint, Season, WorldChunk, WorldGraph } from '@shards/shared';
import { SEASONS } from './profile';

export const CHUNK_SIZE = 35;
export const DIRECTIONS: Direction[] = ['north', 'east', 'south', 'west'];
export const DELTAS: Record<Direction, GridPoint> = {
  north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 },
};
export const OPPOSITE: Record<Direction, Direction> = { north: 'south', east: 'west', south: 'north', west: 'east' };
export const nodeId = (point: GridPoint): string => `${point.x},${point.y}`;
export const samePoint = (left: GridPoint, right: GridPoint): boolean => left.x === right.x && left.y === right.y;
export const distance = (left: GridPoint, right: GridPoint): number => Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
export const tileIndex = (point: GridPoint, size: number): number => point.y * size + point.x;
export const pointAt = (index: number, size: number): GridPoint => ({ x: index % size, y: Math.floor(index / size) });
export const inBounds = (point: GridPoint, size: number): boolean => Number.isInteger(point.x) && Number.isInteger(point.y) && point.x >= 0 && point.y >= 0 && point.x < size && point.y < size;
export const isWalkable = (chunk: WorldChunk, point: GridPoint): boolean => inBounds(point, chunk.size) && chunk.tiles[tileIndex(point, chunk.size)].walkable;

export function seasonAt(point: GridPoint, profile: Pick<WorldGraph, 'seasonRings'>): Season {
  const distance = Math.hypot(point.x, point.y);
  let radius = 0;
  for (const season of SEASONS) {
    radius += profile.seasonRings[season];
    if (distance <= radius) return season;
  }
  return 'winter';
}

export function neighbors(point: GridPoint, size: number): GridPoint[] {
  return DIRECTIONS.map(direction => ({ x: point.x + DELTAS[direction].x, y: point.y + DELTAS[direction].y })).filter(next => inBounds(next, size));
}

/** Flood fill is also used to verify that every open tile belongs to the spawn region. */
export function reachableTiles(chunk: WorldChunk, start = chunk.spawn): Set<number> {
  if (!isWalkable(chunk, start)) return new Set();
  const seen = new Set([tileIndex(start, chunk.size)]);
  const queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    for (const next of neighbors(queue[cursor], chunk.size)) {
      const index = tileIndex(next, chunk.size);
      if (!seen.has(index) && chunk.tiles[index].walkable) { seen.add(index); queue.push(next); }
    }
  }
  return seen;
}
