import { findPath } from '@shards/game-core';
import type { ChunkExit, GridPoint, WorldChunk } from '@shards/shared';

export interface GateOption { exit: ChunkExit; label: string; distance: number; reachable: boolean }

export function gateLabel(chunk: WorldChunk, exit: ChunkExit): string {
  const horizontal = exit.direction === 'north' || exit.direction === 'south';
  const axis = horizontal ? 'x' : 'y';
  const siblings = chunk.exits.filter(item => item.direction === exit.direction).sort((a, b) => a.position[axis] - b.position[axis]);
  if (siblings.length === 1) return 'проход';
  const index = siblings.findIndex(item => item.id === exit.id);
  if (index === 0) return horizontal ? 'левый проход' : 'верхний проход';
  if (index === siblings.length - 1) return horizontal ? 'правый проход' : 'нижний проход';
  return siblings.length === 3 ? 'средний проход' : `проход ${index + 1}`;
}

export function gateOptions(chunk: WorldChunk, position: GridPoint): GateOption[] {
  return chunk.exits.map(exit => {
    const path = findPath(chunk, position, exit.position);
    const reachable = path.length > 0 || position.x === exit.position.x && position.y === exit.position.y;
    return { exit, label: gateLabel(chunk, exit), reachable, distance: reachable ? path.length : Infinity };
  });
}

export function nearestGate(options: GateOption[], targetNodeId: string): GateOption | undefined {
  return options.filter(option => option.reachable && option.exit.targetNodeId === targetNodeId)
    .sort((a, b) => a.distance - b.distance)[0];
}
