import type { ChunkExit, Direction, WorldGraph, WorldNode } from '@shards/shared';
import { createRng, drawRandom, hashString } from '../random';
import { CHUNK_SIZE, DIRECTIONS, OPPOSITE } from './grid';

/** Both sides read the same unordered edge stream, independently of generation order. */
export function gatesForNode(graph: WorldGraph, node: WorldNode): ChunkExit[] {
  return DIRECTIONS.flatMap(direction => {
    const targetNodeId = node.exits[direction];
    if (!targetNodeId) return [];
    const edge = [node.id, targetNodeId].sort().join('|');
    const rng = createRng(`seam-v3:${hashString(graph.seed)}:${edge}`);
    const random = () => drawRandom(rng, 'WORLD');
    const coordinates = [10 + Math.floor(random() * 4), 23 + Math.floor(random() * 4)];
    if (random() < 0.35) coordinates.push(18 + Math.floor(random() * 2));
    return coordinates.sort((a, b) => a - b).map((coordinate, index) => ({
      id: `${node.id}:${direction}:${index}`,
      returnGateId: `${targetNodeId}:${OPPOSITE[direction]}:${index}`,
      direction, targetNodeId, position: gatePosition(direction, coordinate),
    }));
  });
}

export function gatePosition(direction: Direction, coordinate: number) {
  const last = CHUNK_SIZE - 1;
  if (direction === 'north') return { x: coordinate, y: 0 };
  if (direction === 'south') return { x: coordinate, y: last };
  if (direction === 'west') return { x: 0, y: coordinate };
  return { x: last, y: coordinate };
}
