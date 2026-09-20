import type { ChunkExit, Direction, GridPoint, RngState, WorldNode } from '@shards/shared';
import { drawRandom } from '../random';
import { CHUNK_SIZE } from './grid';

export interface DetachedPocket { gate: ChunkExit; coordinate: number }

/** Adjacent chunks cannot both have a pocket: each side entrance opens onto a connected neighbor. */
export function choosePocket(node: WorldNode, exits: ChunkExit[], rng: RngState): DetachedPocket | null {
  if (node.x === 0 || node.y === 0 || (node.x + node.y) % 2 !== 0 || drawRandom(rng, 'WORLD') < 0.15) return null;
  const firstGates = exits.filter(exit => exit.id.endsWith(':0'));
  if (!firstGates.length) return null;
  const gate = firstGates[Math.floor(drawRandom(rng, 'WORLD') * firstGates.length)];
  return { gate, coordinate: gate.direction === 'north' || gate.direction === 'south' ? gate.position.x : gate.position.y };
}

export function fromBoundary(direction: Direction, depth: number, coordinate: number): GridPoint {
  const last = CHUNK_SIZE - 1;
  if (direction === 'north') return { x: coordinate, y: depth };
  if (direction === 'south') return { x: coordinate, y: last - depth };
  if (direction === 'west') return { x: depth, y: coordinate };
  return { x: last - depth, y: coordinate };
}

export function insidePocketMask(point: GridPoint, pocket: DetachedPocket | null): boolean {
  if (!pocket) return false;
  const direction = pocket.gate.direction;
  const coordinate = direction === 'north' || direction === 'south' ? point.x : point.y;
  const depth = direction === 'north' ? point.y : direction === 'south' ? CHUNK_SIZE - 1 - point.y : direction === 'west' ? point.x : CHUNK_SIZE - 1 - point.x;
  return depth <= 8 && Math.abs(coordinate - pocket.coordinate) <= 4;
}
