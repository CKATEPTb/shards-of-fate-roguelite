import type { GridPoint, WorldChunk } from '@shards/shared';
import { surfaceNodeIdForChunk } from '@shards/game-core';
import { grain } from './palette';

export interface RockFormation {
  id: string;
  origin: GridPoint;
  width: 1 | 2 | 3;
  height: 1 | 2 | 3;
  variant: number;
}

/** Pure visual packing: every blocked rock cell is covered once, without changing simulation. */
export function planRockLayout(chunk: WorldChunk): RockFormation[] {
  const occupied = new Uint8Array(chunk.tiles.length);
  const [nodeX, nodeY] = (chunk.surfaceNodeId ?? surfaceNodeIdForChunk(chunk.id)).split(',').map(Number);
  const salt = grain(Number.isFinite(nodeX) ? nodeX : 0, Number.isFinite(nodeY) ? nodeY : 0, chunk.season.length);
  const priority = (x: number, y: number, shape = 0) => grain(x, y, salt + shape);
  const fits = (x: number, y: number, width: number, height: number) => {
    if (x + width > chunk.size || y + height > chunk.size) return false;
    for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) {
      const index = (y + dy) * chunk.size + x + dx;
      if (occupied[index] || chunk.tiles[index].terrain !== 'rock' || chunk.tiles[index].walkable) return false;
    }
    return true;
  };
  const candidates: Array<{ x: number; y: number; width: 2 | 3; height: 2 | 3; rank: number }> = [];
  for (const [width, height] of [[3, 3], [3, 2], [2, 3], [2, 2]] as const) {
    for (let y = 0; y <= chunk.size - height; y++) for (let x = 0; x <= chunk.size - width; x++) {
      if (fits(x, y, width, height)) candidates.push({ x, y, width, height, rank: priority(x, y, width * 7 + height) });
    }
  }
  candidates.sort((left, right) => right.width * right.height - left.width * left.height
    || left.rank - right.rank || left.y - right.y || left.x - right.x || left.width - right.width);
  const formations: RockFormation[] = [];
  const add = (x: number, y: number, width: RockFormation['width'], height: RockFormation['height']) => {
    for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) occupied[(y + dy) * chunk.size + x + dx] = 1;
    formations.push({ id: `rock:${x},${y}:${width}x${height}`, origin: { x, y }, width, height, variant: priority(x, y) % 4 });
  };
  for (const candidate of candidates) if (fits(candidate.x, candidate.y, candidate.width, candidate.height)) add(candidate.x, candidate.y, candidate.width, candidate.height);
  for (let y = 0; y < chunk.size; y++) for (let x = 0; x < chunk.size; x++) if (fits(x, y, 1, 1)) add(x, y, 1, 1);
  return formations.sort((left, right) => left.origin.y - right.origin.y || left.origin.x - right.origin.x);
}
